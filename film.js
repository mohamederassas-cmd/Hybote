/**
 * Scroll-Film der Startseite (25.10.2026, nach dem Vorbild Bugal Immobilien).
 *
 * Der HYBOTE-Concierge in einer Fünf-Sterne-Lobby erzählt in fünf Kapiteln, wie aus einer Anfrage um 23:47 ein Termin wird.
 * Jedes Kapitel ist ein Higgsfield-Clip (build/film-frames.mjs); das End-Bild eines Clips ist das Start-Bild des
 * nächsten.
 *
 * Zwei Wege:
 * - quer (Desktop, iPad quer), `mode` `canvas`: die Szene `.film-scene` ist ein hoher Abschnitt mit stehender Bühne
 *   (position: sticky), eine GSAP-Timeline wird vom Scroll gescrubbt und treibt die Filmuhr (0 → 5). WebP-Bildfolgen
 *   im Canvas, Überblendung nur zwischen direkten Nachbarbildern, höchstens MAX_LIVE dekodierte Bilder.
 * - hochkant (Handy, iPad hochkant), `mode` `flow` (seit 16.11.2026): nichts hängt am Scroll. Die Seite scrollt
 *   nativ, die fünf Kapitel stehen als normale Blöcke untereinander (Aufbau der Fassung ohne Film), jedes mit seinem
 *   Video (film/clips), das von selbst einmal läuft, sobald es im Bild ist, und auf dem letzten Bild stehen bleibt.
 *   Vorher: Handy-Bildfolgen (1440×1920, im Skript dekodiert) ruckelten am iPhone; danach Kapitel-Videos auf
 *   stehender Bühne mit Rastpunkten: ein Wisch übersprang Kapitel, vor jedem Videostart stand das Bild (Abnahme
 *   16.11.2026). Am iPhone bleiben nur natives Scrollen und von selbst laufende Videos wirklich flüssig.
 *
 * Portiert aus Bugal: lib/film/sequence.ts (Laden, Worker-Dekodierung, Überblendung), components/film/FilmCanvas.tsx
 * (Zeichnen, Touch-Glättung), lib/scenes/stage.ts (Bühne, Lenis), components/home/HomeMotion.tsx (Timeline).
 *
 * Ohne Film (reduzierte Bewegung, Datensparmodus, `?film=off`, quer ohne Bibliotheken) bleibt die Szene ein normaler
 * Abschnitt: Hero mit Standbild, darunter die fünf Kapitel mit je einem Standbild (CSS `.film-scene:not(.is-live)`).
 * `?film=hud` zeigt Messwerte am Bildschirm, zum Prüfen am Handy ohne Web-Inspektor.
 */
(function () {
  'use strict';

  const M = window.HYBOTE_FILM;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const root = document.querySelector('.film-scene');
  if (!M || !root) return;

  const GROUND = '#070b16';
  const GROUND_CLEAR = 'rgba(7,11,22,0)';
  const mq = (q) => window.matchMedia(q).matches;
  const params = new URLSearchParams(window.location.search);

  /* ---------- Fassung ---------- */

  /** Keine bei reduzierter Bewegung, Datensparmodus oder `?film=off`, sonst hochkant fürs Handy, quer für alles andere. */
  function pickVariant() {
    if (mq('(prefers-reduced-motion: reduce)')) return null;
    if (params.get('film') === 'off') return null;
    if (navigator.connection && navigator.connection.saveData) return null;
    return window.innerWidth / window.innerHeight < 1 ? 'phone' : 'desktop';
  }

  /* ---------- Bildfolge ---------- */

  /** Gleichzeitige Abrufe über alle Clips zusammen (im langsamen Mobilnetz weniger) */
  const FETCH_SLOTS = 6;
  const FETCH_SLOTS_SLOW = 4;
  const DECODE_CONCURRENCY = 4;
  /** Dekodierfenster: mindestens so viele Bilder in Scrollrichtung voraus, so viele zurück */
  const AHEAD = 6;
  const AHEAD_MAX = 12;
  const BEHIND = 2;
  /** Puffer beim Freigeben: knapp außerhalb des Fensters bleiben Bilder noch liegen */
  const KEEP = 2;
  /**
   * Höchstens so viele dekodierte Bilder über alle Clips (plus laufende Dekodierungen). Ein Desktop-Bild belegt
   * 1920×1072×4 Byte ≈ 8 MB; ohne Grenze lagen bis zu 35 im Speicher, Safari räumt dann selbst auf und ruckelt.
   */
  const MAX_LIVE = 20;
  /** Ab diesem Filmtempo (Bilder/s) wird zwischen Nachbarbildern linear überblendet; das Tempo klingt mit TEMPO_TAU (s) ab */
  const TEMPO_FULL = 6;
  const TEMPO_TAU = 0.25;

  const stats = { decodeMs: 0, decoded: 0, dropped: 0 };
  const noteDecode = (ms) => {
    stats.decodeMs = stats.decoded ? stats.decodeMs * 0.9 + ms * 0.1 : ms;
    stats.decoded++;
  };

  /** Erst erstes und letztes Bild, dann jedes 16., 8., 4., 2., zuletzt jedes: früh scrubbar, danach feiner */
  function loadOrder(count) {
    const out = [];
    const seen = new Set();
    const push = (i) => { if (i >= 0 && i < count && !seen.has(i)) { seen.add(i); out.push(i); } };
    push(0);
    push(count - 1);
    for (const step of [16, 8, 4, 2, 1]) for (let i = 0; i < count; i += step) push(i);
    return out;
  }

  const fetchSlots = () => (/2g|3g/.test((navigator.connection && navigator.connection.effectiveType) || '') ? FETCH_SLOTS_SLOW : FETCH_SLOTS);
  const release = (f) => { if (f && typeof f.close === 'function') f.close(); };

  /** Blob → Bild im Haupt-Thread (nur Rückfallweg ohne Worker) */
  function decodeHere(blob) {
    if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => img.decode().catch(() => undefined).then(() => { URL.revokeObjectURL(url); resolve(img); });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }

  // Dekodiert wird in Web Workern: der Haupt-Thread zeichnet nur. Safari dekodiert createImageBitmap sonst im
  // Haupt-Thread, mitten im Scroll-Frame; das ruckelt.
  const WORKER_SRC = `
self.onmessage = async ({ data: m }) => {
  if (typeof createImageBitmap !== "function") return self.postMessage({ id: m.id, ok: false, unsupported: true });
  const t = performance.now();
  try {
    const bitmap = await createImageBitmap(m.blob);
    self.postMessage({ id: m.id, ok: true, bitmap, ms: performance.now() - t }, [bitmap]);
  } catch (e) {
    self.postMessage({ id: m.id, ok: false });
  }
};`;

  class Decoder {
    constructor(worker) {
      this.worker = worker;
      this.nextId = 1;
      this.waiting = new Map();
      worker.onmessage = (e) => {
        const done = this.waiting.get(e.data.id);
        this.waiting.delete(e.data.id);
        if (done) done(e.data);
      };
    }
    get busy() { return this.waiting.size; }
    decode(blob) {
      return new Promise((resolve) => {
        const id = this.nextId++;
        this.waiting.set(id, resolve);
        this.worker.postMessage({ id, blob });
      }).then((r) => {
        if (r.bitmap) { noteDecode(r.ms || 0); return r.bitmap; }
        return r.unsupported ? decodeHere(blob) : null;
      });
    }
  }

  let pool;
  function decoders() {
    if (pool !== undefined) return pool;
    try {
      const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
      const n = (navigator.hardwareConcurrency || 2) >= 4 ? 2 : 1;
      pool = Array.from({ length: n }, () => new Decoder(new Worker(url)));
    } catch (e) {
      pool = null;
    }
    return pool;
  }

  function decode(blob) {
    const workers = decoders();
    if (workers) return workers.reduce((a, b) => (b.busy < a.busy ? b : a)).decode(blob);
    const t = performance.now();
    return decodeHere(blob).then((f) => { noteDecode(performance.now() - t); return f; });
  }

  /**
   * Ein Clip als Bildfolge. Alle Clips teilen sich eine Ladeschlange: der mit dem kleinsten Rang (der laufende, dann
   * der nächste) bekommt die Verbindungen zuerst. Dekodiert wird nur ein Fenster um die aktuelle Position, das mit
   * der Scrollgeschwindigkeit wächst. Überblendet wird nur zwischen direkten Nachbarbildern; fehlt eines, steht das
   * nächste fertige Bild (über eine Lücke überblendet entstand beim Kopfdrehen ein Geisterbild).
   */
  class FrameSequence {
    /** Dekodierte und gerade dekodierende Bilder aller Clips zusammen */
    static used() {
      let n = 0;
      FrameSequence.all.forEach((s) => { n += s.frames.size + s.decoding.size; });
      return n;
    }

    /**
     * Platz für Bild i von `seq` schaffen: freigegeben wird das Bild, das am weitesten vom Blick entfernt ist, Bilder
     * anderer Clips zuerst. Nie ein gezeigtes und nie eines, das näher liegt als das gewünschte (sonst Pendeln).
     */
    static evictFor(seq, i) {
      const need = Math.abs(i - seq.focusAt);
      let worst = null;
      let score = -1;
      FrameSequence.all.forEach((s) => s.frames.forEach((_, j) => {
        if (s.showing.indexOf(j) >= 0) return;
        const d = s === seq ? Math.abs(j - s.focusAt) : 1000 + Math.abs(j - Math.max(0, s.focusAt));
        if (d > score) { score = d; worst = [s, j]; }
      }));
      if (!worst || score <= need) return false;
      worst[0].drop(worst[1]);
      return true;
    }

    static pumpFetches() {
      const slots = fetchSlots();
      while (FrameSequence.active < slots) {
        const next = Array.from(FrameSequence.loading).filter((s) => s.queue.length).sort((a, b) => a.rank - b.rank)[0];
        if (!next) return;
        FrameSequence.active++;
        next.fetchNext().then(() => { FrameSequence.active--; FrameSequence.pumpFetches(); });
      }
    }

    constructor(spec) {
      this.spec = spec;
      this.blobs = new Array(spec.count).fill(null);
      this.have = new Array(spec.count).fill(false);
      this.count = 0;
      this.settled = 0;
      this.frames = new Map();
      this.decoding = new Set();
      this.queue = [];
      this.rank = Infinity;
      this.started = false;
      this.focusAt = -1;
      this.dir = 1;
      this.speed = 0;
      this.ahead = AHEAD;
      this.behind = BEHIND;
      this.showing = [];
      this.tempo = 0;
      this.lastF = -1;
      this.lastAt = 0;
      FrameSequence.all.add(this);
    }

    drop(i) {
      release(this.frames.get(i));
      this.frames.delete(i);
    }

    url(i) { return `${this.spec.base}/${String(i + 1).padStart(3, '0')}.webp?v=${this.spec.v}`; }

    /** Startet das Laden mit Rang `rank` (0 = wird gerade gebraucht). Ein weiterer Aufruf ändert nur den Rang. */
    load(rank) {
      this.rank = rank;
      if (!this.started) {
        this.started = true;
        this.queue = loadOrder(this.spec.count);
        FrameSequence.loading.add(this);
      }
      FrameSequence.pumpFetches();
    }

    get loaded() { return this.count; }
    get complete() { return this.settled >= this.spec.count; }
    get ready() { return this.have[0]; }
    pos(p) { return Math.min(1, Math.max(0, p)) * (this.spec.count - 1); }

    /** Bildpaar für Fortschritt p (0–1): überblendet zwischen den beiden Nachbarbildern, wenn beide fertig sind */
    pair(p) {
      const f = this.pos(p);
      this.track(f);
      this.focus(Math.round(f), true);
      const lo = Math.floor(f);
      const hi = Math.ceil(f);
      if (this.frames.has(lo) && this.frames.has(hi)) {
        let t = hi === lo ? 0 : (f - lo) / (hi - lo);
        // Nachbarbilder: in Bewegung linear überblenden (gleichmäßiger Lauf ohne Halten-Springen-Takt). Wird der Film
        // langsamer, wächst an beiden Enden eine Zone, in der ein Bild scharf steht; im Stillstand rastet er weich auf
        // dem nächsten Bild ein, ein halbtransparentes Doppelbild bleibt nie stehen (wirkt unscharf).
        if (hi - lo === 1) {
          const hold = 0.5 * Math.max(0, 1 - this.tempo / TEMPO_FULL);
          t = hold >= 0.499 ? (t < 0.5 ? 0 : 1) : Math.min(1, Math.max(0, (t - hold) / (1 - 2 * hold)));
          t += (t * t * (3 - 2 * t) - t) * 2 * hold;
        }
        this.showing = t <= 0.02 ? [lo] : t >= 0.98 ? [hi] : [lo, hi];
        if (t <= 0.02) return { a: this.frames.get(lo), b: null, t: 0, shown: lo, want: f };
        if (t >= 0.98) return { a: this.frames.get(hi), b: null, t: 0, shown: hi, want: f };
        return { a: this.frames.get(lo), b: this.frames.get(hi), t, shown: f, want: f };
      }
      const one = this.nearest(Math.round(f));
      this.showing = one ? [one.i] : [];
      return one ? { a: one.frame, b: null, t: 0, shown: one.i, want: f } : null;
    }

    /** Nur die Bilder um p bereithalten (Nachbar-Clip an der Nahtstelle), ohne zu zeichnen */
    prime(p) { this.focus(Math.round(this.pos(p)), false); }

    /** Filmtempo in Bildern/s aus der stetigen Position: springt auf jeden höheren Wert, klingt sonst mit TEMPO_TAU ab */
    track(f) {
      const now = performance.now();
      const dt = (now - this.lastAt) / 1000;
      if (this.lastF < 0 || dt > 0.25) this.tempo = 0;
      else if (dt > 0) this.tempo = Math.max(Math.abs(f - this.lastF) / dt, this.tempo * Math.exp(-dt / TEMPO_TAU));
      this.lastF = f;
      this.lastAt = now;
    }

    trim() {
      this.frames.forEach(release);
      this.frames.clear();
      this.showing = [];
      this.focusAt = -1;
      this.speed = 0;
      this.tempo = 0;
      this.lastF = -1;
    }

    nearest(want) {
      const at = (i) => (this.frames.has(i) ? { frame: this.frames.get(i), i } : null);
      const exact = at(want);
      if (exact) return exact;
      const n = this.spec.count;
      // erst hinter dem Ziel (Richtung, aus der man kommt), dann davor: der Film läuft nie rückwärts
      for (let d = 1; d < n; d++) {
        const f = at(want - d * this.dir);
        if (f) return f;
        if (d > 3) continue;
        const g = at(want + d * this.dir);
        if (g) return g;
      }
      for (let d = 4; d < n; d++) { const g = at(want + d * this.dir); if (g) return g; }
      return null;
    }

    focus(want, active) {
      if (active) {
        const step = this.focusAt >= 0 ? Math.abs(want - this.focusAt) : 0;
        this.speed = Math.max(step, this.speed * 0.9);
        if (this.focusAt >= 0 && want !== this.focusAt) this.dir = want > this.focusAt ? 1 : -1;
        this.ahead = Math.min(AHEAD_MAX, AHEAD + Math.round(this.speed * 3));
        this.behind = BEHIND;
      } else {
        this.ahead = 1;
        this.behind = 1;
      }
      if (want === this.focusAt && !this.decoding.size && this.frames.has(want)) return;
      this.focusAt = want;
      this.frames.forEach((_, i) => {
        if (!this.inWindow(i) && this.showing.indexOf(i) < 0) this.drop(i);
      });
      this.pump();
    }

    inWindow(i) {
      if (this.focusAt < 0) return false;
      const lo = this.focusAt - (this.dir > 0 ? this.behind : this.ahead) - 1 - KEEP;
      const hi = this.focusAt + (this.dir > 0 ? this.ahead : this.behind) + 1 + KEEP;
      return i >= lo && i <= hi;
    }

    /** Das aktuelle Bild und sein Nachbar, dann voraus; bei Tempo zuerst jedes 2.–4. Bild, danach die Lücken */
    wanted() {
      const at = this.focusAt;
      const stride = Math.min(4, 1 + Math.floor(this.speed));
      const out = [at, at + this.dir];
      for (let d = stride; d <= this.ahead; d += stride) out.push(at + d * this.dir);
      for (let d = 2; d <= this.ahead; d++) out.push(at + d * this.dir);
      for (let d = 1; d <= this.behind; d++) out.push(at - d * this.dir);
      return out.filter((i) => i >= 0 && i < this.spec.count);
    }

    pump() {
      if (this.focusAt < 0) return;
      for (const i of this.wanted()) {
        if (this.decoding.size >= DECODE_CONCURRENCY) return;
        if (!this.have[i] || this.frames.has(i) || this.decoding.has(i)) continue;
        // Wanted() ist nach Nähe sortiert: ist kein Platz frei, bekommt auch kein weiter entferntes Bild welchen
        if (FrameSequence.used() >= MAX_LIVE && !FrameSequence.evictFor(this, i)) return;
        this.decoding.add(i);
        decode(this.blobs[i]).then(
          (frame) => {
            this.decoding.delete(i);
            if (!frame) return this.pump();
            if (!this.inWindow(i)) { release(frame); stats.dropped++; } else this.frames.set(i, frame);
            this.pump();
          },
          () => { this.decoding.delete(i); this.pump(); }
        );
      }
    }

    fetchNext() {
      const i = this.queue.shift();
      if (i === undefined) return Promise.resolve();
      return fetch(this.url(i))
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null)
        .then((blob) => {
          this.settled++;
          if (!blob) return;
          this.blobs[i] = blob;
          this.have[i] = true;
          this.count++;
          if (this.inWindow(i)) this.pump();
        });
    }
  }
  FrameSequence.loading = new Set();
  FrameSequence.active = 0;
  FrameSequence.all = new Set();

  /* ---------- Zeichnen ---------- */

  /**
   * Lage des Bildes im Canvas. Desktop: cover, Handy: contain (das quadratische Bild füllt die Breite), jeweils mal
   * `zoom`, Fokus fx/fy. Dieselbe Rechnung setzt Poster und Loop-Video, damit beim Übergang nichts springt.
   */
  function rect(iw, ih, cw, ch, o) {
    const base = o.fit === 'contain' ? Math.min(cw / iw, ch / ih) : Math.max(cw / iw, ch / ih);
    const s = base * o.zoom;
    const w = iw * s;
    const h = ih * s;
    return { x: (cw - w) * o.fx, y: (ch - h) * o.fy, w, h };
  }

  /**
   * Zeichnet ein Bild (optional mit dem Nachbarbild überblendet). Deckt es den Canvas nicht, füllt der Seitengrund den
   * Rest und ein weicher Verlauf verdeckt die Bildkante: die Clips haben am Rand fast, aber nicht exakt den Grundton.
   */
  function draw(ctx, img, cw, ch, o, next, t) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const r = rect(iw, ih, cw, ch, o);
    const covers = r.x <= 0 && r.y <= 0 && r.x + r.w >= cw && r.y + r.h >= ch;
    if (!covers) { ctx.fillStyle = GROUND; ctx.fillRect(0, 0, cw, ch); }
    ctx.drawImage(img, r.x, r.y, r.w, r.h);
    if (next && t > 0) {
      ctx.globalAlpha = t;
      ctx.drawImage(next, r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 1;
    }
    const f = Math.min(r.w, r.h) * 0.2;
    const edge = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, GROUND);
      g.addColorStop(1, GROUND_CLEAR);
      ctx.fillStyle = g;
      ctx.fillRect(rx, ry, rw, rh);
    };
    // Weiche Kante nur, wo das Bild die Bühne nicht ganz deckt (bildfüllend: nie, sonst dunkelt sie den Rand ab)
    if (r.x > 0.5) edge(r.x, 0, r.x + f, 0, r.x, r.y, f, r.h);
    if (r.x + r.w < cw - 0.5) edge(r.x + r.w, 0, r.x + r.w - f, 0, r.x + r.w - f, r.y, f, r.h);
    if (r.y > 0.5) edge(0, r.y, 0, r.y + f, r.x, r.y, r.w, f);
    if (r.y + r.h < ch - 0.5) edge(0, r.y + r.h, 0, r.y + r.h - f, r.x, r.y + r.h - f, r.w, f);
  }

  /* ---------- Bühne ---------- */

  let lenis = null;
  /** Gewichtetes Mausrad-Scrollen am Desktop (Lenis); aus für Touch und reduzierte Bewegung */
  function smooth() {
    if (lenis || !window.Lenis || mq('(prefers-reduced-motion: reduce)') || mq('(pointer: coarse)')) return;
    lenis = new window.Lenis({ lerp: 0.16, smoothWheel: true, anchors: { offset: -64 }, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis && lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    document.documentElement.classList.add('is-smooth');
    window.HyboteLenis = lenis;
  }

  /* ---------- Film ---------- */

  const variant = pickVariant();
  /** Hochkant stehen die Kapitel im Seitenfluss, ihre Videos laufen von selbst; quer werden Bildfolgen gescrubbt */
  const mode = variant === 'phone' ? 'flow' : 'canvas';
  const SHOTS = M.order;
  const LAST = SHOTS.length;
  const touch = mq('(pointer: coarse)');
  const html = document.documentElement;
  const frameEl = root.querySelector('.film-frame');
  const canvas = root.querySelector('.film-canvas');
  const poster = root.querySelector('.film-poster');
  const loop = root.querySelector('.film-loop');
  const beats = Array.from(root.querySelectorAll('.beat'));
  const clock = { film: 0 };

  /**
   * Bildausschnitt je Kapitel (nur Bildfolgen): [Start, Ende] als Zoom über „cover“. Die Lobby füllt immer die ganze
   * Bühne (1 = randlos), die Kamerafahrten stecken in den Clips selbst; der Zoom gibt nur eine leichte Fahrt dazu.
   * Nahtstellen: das Ende eines Kapitels hat denselben Wert wie der Anfang des nächsten, sonst springt das Bild.
   */
  const ZOOM = { light: [1, 1.03], turn: [1.03, 1.03], open: [1.03, 1], book: [1, 1.02], bell: [1.02, 1] };
  // Hochkant: Ausschnitt aus der Bildmitte, der Concierge steht etwas über der Mitte
  const FOCUS = { desktop: { fx: 0.5, fy: 0.5 }, phone: { fx: 0.5, fy: 0.45 } };
  /** Höchste Pixeldichte des Canvas: mehr kostet jedes Bild, ohne dass man es sieht */
  const DPR_MAX = 1.5;
  const smoothstep = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
  function look(shot, p) {
    const [a, b] = ZOOM[shot] || [1, 1];
    return { fit: 'cover', zoom: a + (b - a) * smoothstep(p), ...FOCUS[variant] };
  }

  /** Ladereihenfolge: der laufende Clip zuerst, dann der nächste, der vorige und so weiter */
  const rankFor = (k, at) => (k >= at ? (k - at) * 2 : (at - k) * 2 + 1);
  /** Dämpfung der Filmposition am Touch-Gerät (Zeitkonstante in s); am Desktop glättet Lenis */
  const FOLLOW_TAU = 0.12;

  /* ---------- Poster, Loop, Anker ---------- */

  const loopName = variant === 'phone' ? 'hero-phone' : 'hero';
  const loopSize = M.loops[loopName] || { w: 1600, h: 904 };
  /** Bildgröße eines Kapitels (Bildfolge quer) */
  const sizeOf = (shot) => (M.shots[shot] || {}).desktop;

  // Impuls und Kanal-Beschriftungen hängen an Punkten im Bild (data-x/-y, Anteile des 16:9-Clips); nur auf der
  // stehenden Bühne (quer), im Seitenfluss stehen die Kanäle als Zeile unter dem Text. Das Filmbild wird auf Arabisch
  // nicht gespiegelt (das Namensschild stünde sonst spiegelverkehrt), die Anker also auch nicht.
  const anchors = Array.from(root.querySelectorAll('[data-anchor]'));
  function placeAnchors(bw, bh) {
    if (mode !== 'canvas') return;
    for (const el of anchors) {
      const shot = el.dataset.shot;
      const size = sizeOf(shot);
      if (!size) continue;
      const u = Number(el.dataset.x);
      const r = rect(size.w, size.h, bw, bh, look(shot, 1));
      let left = r.x + u * r.w;
      // Kanal-Chips: data-side="before" heißt, die Beschriftung steht vor dem Punkt und die Linie zeigt auf den
      // Concierge. Beschriftungen bleiben im Fenster.
      if (el.classList.contains('chan')) {
        const before = el.dataset.side === 'before';
        el.classList.toggle('is-before', before);
        left = before ? Math.max(10, left - el.offsetWidth) : Math.min(left, bw - el.offsetWidth - 10);
      }
      el.style.left = `${left}px`;
      el.style.top = `${r.y + Number(el.dataset.y) * r.h}px`;
    }
  }

  /** Poster und Loop liegen exakt dort, wo das erste Filmbild liegt (dieselbe Rechnung wie der Canvas) */
  function placeMedia() {
    if (!frameEl) return;
    const box = frameEl.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const r = rect(loopSize.w, loopSize.h, box.width, box.height, look(SHOTS[0], 0));
    for (const el of [poster, loop]) {
      if (!el) continue;
      el.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;right:auto;bottom:auto;object-fit:fill`;
    }
    placeAnchors(box.width, box.height);
  }
  document.addEventListener('hybote:lang', () => requestAnimationFrame(placeMedia));

  /**
   * Hero-Schleife. `armWhen(arm)` bestimmt, wann sie lädt; `probe` erfährt, ob iOS Video abspielen lässt (im
   * Stromsparmodus lehnt Safari play() ab). Auf der stehenden Bühne läuft sie nur ganz oben, vor dem ersten Scroll.
   * Im Seitenfluss (`whileVisible`) läuft sie, solange der Hero zu sehen ist: er scrollt dort wie jeder Abschnitt aus
   * dem Bild, ein früh angehaltenes Video stünde als Standbild auf dem Schirm.
   */
  function heroLoop(armWhen, probe, whileVisible) {
    if (!loop) return;
    const src = `/film/loops/${loopName}.mp4?v=${loopSize.v || ''}`;
    let armed = false;
    let seen = true;
    const sync = () => {
      if (!armed) return;
      const top = whileVisible
        ? seen && !document.hidden
        : window.scrollY < window.innerHeight * 0.1 && !(Number(root.dataset.beat) >= 0);
      if (top && loop.paused) {
        loop.play().then(
          () => { loop.classList.add('is-on'); if (probe) probe(null); },
          (e) => { if (probe) probe(e); }
        );
      } else if (!top && !loop.paused) loop.pause();
    };
    const arm = () => {
      if (armed) return;
      armed = true;
      loop.src = src;
      sync();
    };
    if (whileVisible) {
      new IntersectionObserver(([e]) => { seen = e.isIntersecting; sync(); }, { threshold: 0.05 }).observe(frameEl);
      document.addEventListener('visibilitychange', sync);
    } else window.addEventListener('scroll', sync, { passive: true });
    armWhen(arm);
  }

  /* ---------- Quer: Bildfolgen im Canvas ---------- */

  function startFilm() {
    const ctx = canvas && canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    const seqs = SHOTS.map((shot) => {
      const spec = (M.shots[shot] || {}).desktop;
      return spec ? new FrameSequence({ base: `/film/${shot}/desktop`, ...spec }) : null;
    });
    if (!seqs[0]) return null;
    const rankAll = (at) => seqs.forEach((s, k) => s && s.load(rankFor(k, at)));
    rankAll(0);

    // Zeichenfläche = CSS-Box des Canvas (100lvh): ändert sich nicht, wenn am Handy die Adressleiste ein- und ausfährt
    let cw = 0;
    let ch = 0;
    let dirty = true;
    const ro = new ResizeObserver(([e]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
      cw = Math.round(e.contentRect.width * dpr);
      ch = Math.round(e.contentRect.height * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      placeMedia();
      dirty = true;
    });
    ro.observe(canvas);

    // Lage der Szene, gemessen nach jedem Refresh: im Takt wird nur scrollY gelesen (kein Layout pro Frame)
    let geo = { top: 0, h: 0 };
    let vh = window.innerHeight;
    const measure = () => {
      vh = window.innerHeight;
      const r = root.getBoundingClientRect();
      geo = { top: r.top + window.scrollY, h: r.height };
      dirty = true;
    };
    measure();
    ScrollTrigger.addEventListener('refresh', measure);

    // Loop: startet, wenn das erste Kapitel geladen ist (oder nach 6 s), damit er dem Film keine Leitung wegnimmt
    heroLoop((arm) => {
      setTimeout(arm, 6000);
      const waitFirst = () => (seqs[0].complete ? arm() : setTimeout(waitFirst, 250));
      waitFirst();
    });

    const hud = params.get('film') === 'hud' ? createHud() : null;
    const stat = { frames: 0, worst: 0, lag: 0, since: performance.now(), last: performance.now() };
    let eased = clock.film;
    let lastShot = -1;
    let lastA = null;
    let lastB = null;
    let lastKey = '';
    let wasOn = false;

    const frame = (dt) => {
      const sy = window.scrollY;
      const on = root.classList.contains('is-live') && sy + vh > geo.top && sy < geo.top + geo.h;
      if (!on || !cw) { wasOn = false; return null; }
      // Am Touch-Gerät folgt der Film der Scroll-Uhr leicht gedämpft; beim Betreten und bei Sprüngen sofort
      const target = clock.film;
      if (!touch || !wasOn || Math.abs(target - eased) > 1) eased = target;
      else {
        eased += (target - eased) * (1 - Math.exp(-dt / 1000 / FOLLOW_TAU));
        if (Math.abs(target - eased) < 0.0005) eased = target;
      }
      wasOn = true;
      const c = Math.min(LAST, Math.max(0, eased));
      const k = Math.min(LAST - 1, Math.floor(c));
      const p = c >= LAST ? 1 : c - k;
      if (k !== lastShot) {
        rankAll(k);
        seqs.forEach((s, j) => {
          if (!s || j === k) return;
          if (j === k + 1) s.prime(0);
          else if (j === k - 1) s.prime(1);
          else s.trim();
        });
        lastShot = k;
      }
      const seq = seqs[k];
      if (!seq) return null;
      const pair = seq.pair(p);
      if (!pair) return { k, seq, pair };
      const o = look(SHOTS[k], p);
      // Überblendung in 1/24-Schritten: feiner sieht man nicht, so wird nicht jeder Frame gezeichnet
      const t = Math.round(pair.t * 24) / 24;
      const key = `${cw}x${ch}|${o.zoom.toFixed(3)}|${t}`;
      if (!dirty && pair.a === lastA && pair.b === lastB && key === lastKey) return { k, seq, pair };
      dirty = false;
      lastA = pair.a;
      lastB = pair.b;
      lastKey = key;
      draw(ctx, pair.a, cw, ch, o, pair.b, t);
      if (!html.classList.contains('film-ready')) html.classList.add('film-ready');
      return { k, seq, pair };
    };

    gsap.ticker.add((_time, dt) => {
      const now = frame(dt);
      if (!hud) return;
      // Messwerte viermal pro Sekunde: fps, längster Frame, größter Verzug (gewünscht ↔ gezeigt)
      const at = performance.now();
      stat.frames++;
      stat.worst = Math.max(stat.worst, at - stat.last);
      stat.last = at;
      if (now && now.pair) stat.lag = Math.max(stat.lag, Math.abs(now.pair.want - now.pair.shown));
      const ms = at - stat.since;
      if (ms < 250) return;
      hud.textContent = [
        `${Math.round((stat.frames * 1000) / ms)} fps · max ${Math.round(stat.worst)} ms`,
        now ? `${SHOTS[now.k]} ${now.pair ? now.pair.want.toFixed(1) : '-'} → ${now.pair ? now.pair.shown.toFixed(1) : '-'}` : 'kein Clip',
        `Verzug max ${stat.lag.toFixed(1)} Bilder`,
        now ? `geladen ${now.seq.loaded}/${now.seq.spec.count}` : '',
        `dekodieren ${stats.decodeMs.toFixed(1)} ms · verworfen ${stats.dropped} · im Speicher ${FrameSequence.used()}/${MAX_LIVE}`,
        `canvas ${cw}×${ch} · ${touch ? 'touch' : 'maus'}`,
      ].filter(Boolean).join('\n');
      stat.frames = 0;
      stat.worst = 0;
      stat.lag = 0;
      stat.since = at;
    });
    return { seqs };
  }

  /* ---------- Hochkant: Kapitel im Seitenfluss ---------- */

  /** Sichtbarer Anteil der Videokarte, ab dem ihr Video läuft, und unter dem es anhält */
  const PLAY_AT = 0.6;
  const STOP_AT = 0.25;
  /** Ruhe im Bild, bevor ein Video startet (ms): beim schnellen Wischen lädt und startet keines */
  const DWELL_MS = 160;
  const ICONS = {
    play: '<path d="M8.5 5.5v13l10-6.5z"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 4.5V9H9"/>',
  };
  // Beschriftung des Knopfs: aus dem Wörterbuch der Seite (index.html: hyboteText), sonst englisch
  const LABELS = { play: 'Play video', pause: 'Pause video', replay: 'Play video again' };
  const say = (key) => (typeof window.hyboteText === 'function' && window.hyboteText(`film.${key}`)) || LABELS[key];

  /**
   * Hochkant: nichts hängt am Scroll. Die Szene bleibt ein normaler Abschnitt (kein .is-live, keine stehende Bühne,
   * kein ScrollTrigger, keine Rastpunkte), die Seite scrollt nativ. Jedes Kapitel bekommt in seiner Karte
   * `.beat-media` ein Video (film/clips) über dem ersten Bild des Clips als Poster. Ist die Karte zu PLAY_AT im Bild
   * und steht kurz (DWELL_MS), läuft ihr Video einmal von vorn und bleibt auf dem letzten Bild stehen; scrollt sie
   * hinaus, hält es an. Es läuft immer nur eines, geladen sind höchstens das laufende und seine Nachbarn. Der Knopf
   * in der Karte hält an, setzt fort oder spielt noch einmal (Apple: kein Autoplay ohne Bedienung). Lehnt iOS play()
   * ab (Stromsparmodus), bleibt das Poster stehen und der Knopf startet das Video per Antippen.
   */
  function startFlow() {
    const C = M.clips || {};
    const stillEls = beats.map((beat) => beat.querySelector('.beat-still'));
    if (!('IntersectionObserver' in window) || beats.length !== LAST || !SHOTS.every((s) => C[s]) || stillEls.some((s) => !s)) return null;
    root.classList.add('is-flow');
    const url = (k, kind) => {
      const shot = SHOTS[k];
      return kind === 'v' ? `/film/clips/${shot}.mp4?v=${C[shot].v}` : `/film/clips/${shot}-${kind}.webp?v=${C[shot][kind]}`;
    };
    const info = { latency: 0, waiting: 0, blocked: false };
    const byBox = new Map();
    let current = null; // Kapitel, dessen Video zuletzt gestartet wurde
    let dwell = 0;

    const busy = (it) => it.state === 'playing' || it.state === 'starting';
    // Zustände: idle (Poster), starting, playing, paused, done (letztes Bild)
    const setState = (it, state) => {
      it.state = state;
      const key = busy(it) ? 'pause' : state === 'done' ? 'replay' : 'play';
      if (it.btn.dataset.icon === key) return;
      it.btn.dataset.icon = key;
      it.btn.dataset.i18nAria = `film.${key}`;
      it.btn.setAttribute('aria-label', say(key));
      it.btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>`;
    };
    const attach = (it) => {
      if (it.loaded) return;
      it.loaded = true;
      it.video.src = url(it.k, 'v');
      it.video.preload = 'auto';
      it.video.load();
    };
    /** Video freigeben: darunter steht das Poster (noch nicht gelaufen) oder das letzte Bild (gelaufen) */
    const release = (it) => {
      if (!it.loaded) return;
      it.loaded = false;
      it.gen++;
      it.video.classList.remove('is-on');
      it.video.removeAttribute('src');
      it.video.load();
      if (it.state !== 'done') setState(it, 'idle');
    };
    const halt = (it) => {
      it.gen++;
      if (!it.video.paused) it.video.pause();
      if (it.state === 'playing') setState(it, 'paused');
      else if (it.state === 'starting') setState(it, 'idle');
    };
    /** Läuft ein Kapitel, bleiben nur seine Nachbarn geladen; das nächste lädt vor */
    const tidy = (it) => {
      items.forEach((o) => { if (Math.abs(o.k - it.k) > 1) release(o); });
      const next = items[it.k + 1];
      if (next && !info.blocked) setTimeout(() => { if (current === it && next.state === 'idle') attach(next); }, 400);
    };
    const start = (it, byUser) => {
      clearTimeout(dwell);
      if (current && current !== it) halt(current);
      current = it;
      attach(it);
      const el = it.video;
      const again = it.state === 'done';
      if (again || el.ended) { try { el.currentTime = 0; } catch (e) { /* noch keine Metadaten */ } }
      if (byUser) it.userPaused = false;
      const g = ++it.gen;
      const t0 = performance.now();
      setState(it, 'starting');
      el.play().then(() => {
        if (g !== it.gen) return;
        setState(it, 'playing');
        const shown = () => {
          if (g !== it.gen) return;
          el.classList.add('is-on');
          info.latency = Math.round(performance.now() - t0);
          tidy(it);
        };
        if (typeof el.requestVideoFrameCallback === 'function') el.requestVideoFrameCallback(shown);
        else requestAnimationFrame(() => requestAnimationFrame(shown));
      }, (e) => {
        if (g !== it.gen) return;
        // Stromsparmodus: kein Autoplay mehr versuchen, der Knopf startet per Antippen
        if (e && e.name === 'NotAllowedError') info.blocked = true;
        setState(it, again ? 'done' : 'idle');
      });
    };
    /** Welches Video soll laufen? Das erste noch nicht gelaufene, dessen Karte weit genug im Bild ist. */
    const pick = () => {
      clearTimeout(dwell);
      items.forEach((it) => { if (busy(it) && it.ratio < STOP_AT) halt(it); });
      if (info.blocked || document.hidden) return;
      if (current && busy(current) && current.ratio >= PLAY_AT) return;
      const next = items.find((it) => it.ratio >= PLAY_AT && !it.userPaused && !busy(it) && it.state !== 'done');
      if (!next) return;
      dwell = setTimeout(() => { if (next.ratio >= PLAY_AT && !document.hidden) start(next, false); }, DWELL_MS);
    };

    const items = beats.map((beat, k) => {
      const still = stillEls[k];
      const box = document.createElement('div');
      box.className = 'beat-media';
      still.before(box);
      box.appendChild(still);
      // Poster = erstes Bild des Clips (aus dem fertigen Video gezogen): beim Start springt nichts
      still.width = C[SHOTS[k]].w;
      still.height = C[SHOTS[k]].h;
      still.src = url(k, 'a');
      const video = document.createElement('video');
      video.className = 'beat-clip';
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.preload = 'none';
      video.disableRemotePlayback = true;
      video.setAttribute('aria-hidden', 'true');
      video.tabIndex = -1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'beat-ctl';
      box.append(video, btn);
      const it = { k, box, still, video, btn, state: 'idle', ratio: 0, gen: 0, loaded: false, userPaused: false };
      setState(it, 'idle');
      video.addEventListener('waiting', () => { info.waiting++; });
      // Am Ende bleibt das Video auf seinem letzten Bild stehen; darunter liegt dann dasselbe Bild als Standbild
      video.addEventListener('ended', () => {
        still.src = url(k, 'z');
        setState(it, 'done');
        pick();
      });
      // In-App-Browser ohne Inline-Wiedergabe öffnen Videos im Vollbild: dann nur noch per Knopf
      video.addEventListener('webkitbeginfullscreen', () => {
        if (typeof video.webkitExitFullscreen === 'function') video.webkitExitFullscreen();
        info.blocked = true;
        halt(it);
      });
      btn.addEventListener('click', () => {
        if (busy(it)) { it.userPaused = true; halt(it); } else start(it, true);
      });
      byBox.set(box, it);
      return it;
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const it = byBox.get(e.target);
        if (it) it.ratio = e.isIntersecting ? e.intersectionRatio : 0;
      });
      pick();
    }, { threshold: [0, STOP_AT, PLAY_AT] });
    items.forEach((it) => io.observe(it.box));
    // Weit weg von den Kapiteln (Rest der Seite) bleibt kein Video geladen
    const list = root.querySelector('.beats');
    if (list) new IntersectionObserver(([e]) => { if (!e.isIntersecting) items.forEach(release); }).observe(list);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) pick();
      else if (current) halt(current);
    });

    // Hero: Poster und Schleife wie auf der Bühne ausgerichtet; die Schleife ist zugleich die Probe, ob iOS Video
    // abspielen lässt
    new ResizeObserver(() => placeMedia()).observe(frameEl);
    heroLoop((arm) => arm(), (e) => { if (e && e.name === 'NotAllowedError') info.blocked = true; }, true);

    if (params.get('film') === 'hud') {
      const hud = createHud();
      setInterval(() => {
        const el = current && current.video;
        const q = el && typeof el.getVideoPlaybackQuality === 'function' ? el.getVideoPlaybackQuality() : null;
        hud.textContent = [
          `flow · ${info.blocked ? 'Autoplay gesperrt' : 'Video'}`,
          current ? `${SHOTS[current.k]} ${current.state} ${el.currentTime.toFixed(2)}/${C[SHOTS[current.k]].dur} s · bereit ${el.readyState}` : 'kein Video',
          `Startverzug ${info.latency} ms · Hänger ${info.waiting}`,
          q ? `Bilder ${q.totalVideoFrames} · verworfen ${q.droppedVideoFrames}` : '',
          `geladen ${items.filter((it) => it.loaded).map((it) => SHOTS[it.k]).join(' / ') || '-'}`,
          `sichtbar ${items.map((it) => it.ratio.toFixed(2)).join(' ')}`,
        ].filter(Boolean).join('\n');
      }, 250);
    }
    return { items, info };
  }

  function createHud() {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:8px;top:84px;z-index:300;pointer-events:none;white-space:pre;font:11px/1.35 ui-monospace,Menlo,monospace;color:#f5f1eb;background:rgba(7,11,22,.85);padding:6px 8px;border-radius:6px';
    document.body.appendChild(el);
    return el;
  }

  /* ---------- Timeline (nur quer) ---------- */

  /** Anteile der Scrollstrecke: Hero geht, fünf Kapitel, am Ende schrumpft das Bild in ein Fenster */
  const B0 = 0.05;
  const SLICE = 0.165;
  const END = B0 + LAST * SLICE;
  // Anteil des Kapitels, in dem sein Clip läuft; danach steht das End-Bild. Schmal länger: die Bühne ist niedriger,
  // bei 60 % käme beim Wischen in jedem Takt ein Sprung über mehrere Bilder
  const FILM_SHARE = { desktop: 0.6, phone: 0.85 };

  function build(tl, phone) {
    const q = (sel) => Array.from(root.querySelectorAll(sel));
    gsap.set(beats, { autoAlpha: 0 });
    // Ziele sind die inneren Hüllen: die äußeren (.ch-left/.ch-right) sind per transform positioniert
    tl.to(q('.film-loop-wrap'), { autoAlpha: 0, duration: 0.03 }, 0)
      .to(q('.hero-head, .hero-foot, .ticker'), { yPercent: -24, autoAlpha: 0, duration: 0.045, stagger: 0.005 }, 0.004)
      .to(q('.film-cue'), { autoAlpha: 0, duration: 0.02 }, 0);

    beats.forEach((beat, k) => {
      const at = B0 + k * SLICE;
      const sub = (sel) => Array.from(beat.querySelectorAll(sel));
      const pos = (x) => at + SLICE * x;
      const len = (x) => SLICE * x;
      // Film: der Clip des Kapitels läuft im ersten Teil (FILM_SHARE), danach steht sein End-Bild
      tl.fromTo(clock, { film: k }, { film: k + 1, duration: SLICE * FILM_SHARE[phone ? 'phone' : 'desktop'], ease: 'power1.inOut', immediateRender: false }, at);
      // Ob ein Kapitel zu sehen ist, entscheidet der Scroll; seine Texte laufen mit
      tl.set(beat, { autoAlpha: 1 }, at);
      // y: 0 ausdrücklich, sonst übernimmt GSAP den CSS-Startwert (translateY 110 %) zusätzlich als Pixel
      tl.fromTo(sub('.mask > span'), { yPercent: 110, y: 0 }, { yPercent: 0, y: 0, duration: len(0.24), stagger: len(0.04), ease: 'power3.out' }, pos(0.03))
        .fromTo(sub('.beat-body'), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: len(0.2), ease: 'power2.out' }, pos(0.12));
      sub('[data-in]').forEach((el) => {
        tl.fromTo(el, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: len(0.12), ease: 'power2.out' }, pos(parseFloat(el.dataset.in)));
      });
      // Kapitel 2: der Cyan-Impuls im Moment der Antwort
      sub('.pulse').forEach((el) => {
        tl.fromTo(el, { scale: 0.2, autoAlpha: 0.95 }, { scale: 2.8, autoAlpha: 0, duration: len(0.3), ease: 'power2.out' }, pos(parseFloat(el.dataset.at || '0.4')));
      });
      // Kapitel 3: die Kanal-Linien wachsen an die Ebenen heran
      sub('.chan-line').forEach((el, i) => {
        tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: len(0.12), ease: 'power2.out' }, pos(0.58 + i * 0.04));
      });
      // Kapitel 5: Begrüßungen in vielen Sprachen lösen einander ab, die letzte bleibt
      const words = sub('.greet > span');
      words.forEach((w, i) => {
        const t0 = 0.18 + i * 0.13;
        tl.fromTo(w, { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: len(0.06), ease: 'power2.out' }, pos(t0));
        if (i < words.length - 1) tl.to(w, { yPercent: -100, autoAlpha: 0, duration: len(0.06), ease: 'power2.in' }, pos(t0 + 0.1));
      });
      if (k < LAST - 1) tl.to(beat, { autoAlpha: 0, duration: SLICE * 0.07 }, at + SLICE * 0.93);
    });

    // Schluss: das letzte Kapitel geht, der Slogan kommt, das Bild schrumpft in ein Fenster. Schmal liegt das Fenster
    // oben, breit beim Concierge (rechts), der Slogan steht daneben.
    const windowed = phone ? 'inset(14% 6% 38% 6% round 12px)' : 'inset(12% 5% 14% 40% round 12px)';
    tl.to(beats[LAST - 1], { autoAlpha: 0, duration: 0.03 }, END)
      .to(q('.film-nav'), { autoAlpha: 0, duration: 0.02 }, END)
      .fromTo(q('.film-frame'), { clipPath: 'inset(0% 0% 0% 0% round 0px)' }, { clipPath: windowed, duration: 0.1, ease: 'power1.inOut' }, END + 0.012)
      .fromTo(q('.film-end > *'), { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.05, stagger: 0.012, ease: 'power2.out' }, END + 0.04);
    if (tl.duration() < 1) tl.to({}, { duration: 1 - tl.duration() }, tl.duration());
  }

  /**
   * Szene (nur quer): hoher Abschnitt, dessen Bühne stehen bleibt, während die Seite nativ daran vorbeiscrollt (keine
   * Wheel-Übernahme, die Scrollbar stimmt immer). Ohne .is-live ist sie ein normaler Abschnitt mit Standbildern.
   * HOLD = Scrollstrecke in Bildschirmhöhen.
   */
  const HOLD = { desktop: 6, phone: 6.5 };
  function scene() {
    const mm = gsap.matchMedia();
    // matchMedia ruft die Funktion nur, wenn mindestens eine Bedingung zutrifft: deshalb beide Breiten nennen
    mm.add({ phone: '(max-width: 767px)', wide: '(min-width: 768px)' }, (c) => {
      const phone = Boolean(c.conditions && c.conditions.phone);
      root.classList.add('is-live');
      root.style.setProperty('--hold', String(HOLD[phone ? 'phone' : 'desktop']));
      const sync = (self) => {
        const k = Math.max(-1, Math.min(LAST - 1, Math.floor((self.progress - B0) / SLICE)));
        const beat = String(k);
        if (root.dataset.beat !== beat) root.dataset.beat = beat;
      };
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: sync,
          onRefresh: sync,
        },
      });
      build(tl, phone);
      return () => {
        root.classList.remove('is-live');
        root.style.removeProperty('--hold');
        gsap.set(beats, { clearProps: 'all' });
      };
    });
  }

  if (!variant) return;
  if (mode === 'flow') {
    const flow = startFlow();
    if (!flow) return;
    window.HyboteFilm = { flow, mode };
    document.dispatchEvent(new Event('hybote:film'));
    return;
  }
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  const film = startFilm();
  if (!film) return;
  smooth();
  scene();
  // „Film überspringen“: sofort (ohne Gleiten durch den ganzen Film) zum Benchmark, Fokus dorthin
  const skip = root.querySelector('.film-skip');
  const after = document.getElementById('benchmark');
  if (skip && after) {
    skip.addEventListener('click', (e) => {
      e.preventDefault();
      if (lenis) lenis.scrollTo(after, { immediate: true, offset: -72 });
      else after.scrollIntoView({ behavior: 'instant', block: 'start' });
      after.focus({ preventScroll: true });
    });
  }
  // Sprachwechsel: Texthöhen ändern sich, Anker neu berechnen
  document.addEventListener('hybote:lang', () => requestAnimationFrame(() => ScrollTrigger.refresh()));
  document.dispatchEvent(new Event('hybote:film'));

  // Schriften bestimmen die Höhen; danach einmal neu messen
  const refresh = () => ScrollTrigger.refresh();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  window.addEventListener('load', refresh);
  window.HyboteFilm = { clock, film, stats, mode };
})();
