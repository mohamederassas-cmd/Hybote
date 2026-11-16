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
 * - hochkant (Handy, iPad hochkant), `mode` `reel` (seit 16.11.2026): nichts hängt am Scroll. Unter dem Hero steht
 *   ein Bildschirm mit EINEM Film aus allen fünf Kapiteln (film/clips/reel.mp4), der von selbst läuft, sobald er im
 *   Bild ist; die Kapiteltexte laufen wie Untertitel mit (startReel). Verworfen am iPhone: Bildfolgen im Skript
 *   (ruckelten), Kapitel-Videos auf stehender Bühne mit Rastpunkten (Kapitel sprangen, hing vor jedem Start), fünf
 *   Videokarten im Seitenfluss (liefen flüssig, wirkten aber unprofessionell).
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
  /** Hochkant läuft ein Film von selbst (startReel), quer werden Bildfolgen gescrubbt */
  const mode = variant === 'phone' ? 'reel' : 'canvas';
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
  // stehenden Bühne (quer), im Film hochkant stehen die Kanäle als Zeile über dem Text. Das Filmbild wird auf Arabisch
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
   * Hochkant (`whileVisible`) läuft sie, solange der Hero zu sehen ist: er scrollt dort wie jeder Abschnitt aus dem
   * Bild, ein früh angehaltenes Video stünde als Standbild auf dem Schirm.
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

  /* ---------- Hochkant: ein Film auf einem Bildschirm ---------- */

  /** Sichtbarer Anteil des Films, ab dem er läuft, und unter dem er anhält */
  const PLAY_AT = 0.6;
  const STOP_AT = 0.25;
  /** Ruhe im Bild, bevor der Film startet (ms): beim schnellen Vorbeiwischen startet er nicht */
  const DWELL_MS = 160;
  /** Sekunden, über die die Texte eines Kapitels erscheinen (der Clip dauert 5 s, wie früher 85 % des Kapitels) */
  const TEXT_SPAN = 5.9;
  /** Leichte Fahrt über den ganzen Film (nur transform), damit die Ruhe nach jedem Kapitel nicht wie ein Hänger wirkt */
  const DRIFT = 1.06;
  const ICONS = {
    play: '<path d="M8.5 5.5v13l10-6.5z"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5"/><path d="M4.5 4.5V9H9"/>',
  };
  // Beschriftungen aus dem Wörterbuch der Seite (index.html: hyboteText), sonst englisch
  const LABELS = { play: 'Play video', pause: 'Pause video', replay: 'Play video again', chapter: 'Chapter {n} of 5', watch: 'Watch the film · {s} sec' };
  const say = (key) => (typeof window.hyboteText === 'function' && window.hyboteText(`film.${key}`)) || LABELS[key];
  const icon = (key) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>`;

  /**
   * Hochkant (Handy, iPad hochkant): ein Film (film/clips/reel.mp4, alle fünf Kapitel mit Ruhe zum Lesen dazwischen)
   * auf einem einzigen Bildschirm unter dem Hero. Er läuft von selbst, sobald er zu PLAY_AT im Bild steht, und hält
   * an, wenn man weiterscrollt. Nichts hängt am Scroll: die Seite scrollt nativ. Die Kapiteltexte laufen wie
   * Untertitel auf einer GSAP-Zeitleiste in Sekunden, die der Videozeit folgt (Pause, Sprung und Wiederholen stimmen
   * dadurch von selbst). Oben fünf Segmente (antippen springt ins Kapitel) und Pause/Weiter/Noch einmal; Tippen ins
   * Bild links/rechts geht ein Kapitel zurück/vor. Am Ende stehen letztes Bild, Slogan und Knopf; kein Loop.
   * Lehnt iOS play() ab (Stromsparmodus), steht das Poster mit dem ersten Kapitel und einem Knopf „Film ansehen“.
   * Vorher: Bildfolgen im Skript (ruckelten), Kapitel-Videos auf stehender Bühne (sprangen), fünf Videokarten im
   * Seitenfluss (liefen, wirkten aber unprofessionell; Abnahme 16.11.2026).
   */
  function startReel() {
    const R = M.reel;
    const list = root.querySelector('.beats');
    const end = root.querySelector('.film-end');
    if (!R || !R.marks || R.marks.length !== LAST || !gsap || !list || !end || beats.length !== LAST) return null;
    if (!('IntersectionObserver' in window)) return null;
    root.classList.add('is-reel');
    const file = (kind) => (kind === 'v' ? `/film/clips/reel.mp4?v=${R.v}` : `/film/clips/reel-${kind}.webp?v=${R[kind]}`);
    const make = (tag, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; return el; };
    const marks = R.marks;
    const lenOf = (k) => (k < LAST - 1 ? marks[k + 1] : R.dur) - marks[k];
    const info = { latency: 0, waiting: 0, blocked: false, state: 'idle' };

    // Aufbau: die vorhandenen Kapitel und der Schluss liegen über dem Video
    const box = make('div', 'reel');
    const move = make('div', 'reel-move');
    const poster = make('img', 'reel-poster');
    poster.alt = '';
    poster.decoding = 'async';
    poster.loading = 'lazy';
    poster.width = R.w;
    poster.height = R.h;
    poster.src = file('a');
    const video = make('video', 'reel-video');
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'none';
    video.disableRemotePlayback = true;
    video.setAttribute('aria-hidden', 'true');
    video.tabIndex = -1;
    move.append(poster, video);
    const bar = make('div', 'reel-bar');
    const rail = make('div', 'reel-rail');
    const segs = beats.map((_, k) => {
      const b = make('button', 'reel-seg');
      b.type = 'button';
      const track = make('i');
      track.appendChild(make('b'));
      b.appendChild(track);
      b.addEventListener('click', () => jump(k));
      rail.appendChild(b);
      return b;
    });
    // Füllung je Segment: die Zeitleiste skaliert sie von 0 auf 1, solange das Kapitel läuft
    const fills = segs.map((b) => b.querySelector('b'));
    const ctl = make('button', 'reel-ctl');
    ctl.type = 'button';
    bar.append(rail, ctl);
    // Tippflächen im Bild (für Maus und Tastatur gibt es die Segmente)
    const taps = ['prev', 'next'].map((dir) => {
      const t = make('button', `reel-tap reel-tap--${dir}`);
      t.type = 'button';
      t.tabIndex = -1;
      t.setAttribute('aria-hidden', 'true');
      t.addEventListener('click', () => step(dir === 'next' ? 1 : -1));
      return t;
    });
    const startBtn = make('button', 'reel-start btn btn--glass');
    startBtn.type = 'button';
    startBtn.addEventListener('click', () => start(true));
    list.before(box);
    box.append(move, list, end, ...taps, bar, startBtn);

    const label = () => {
      const secs = Math.round(R.dur / 5) * 5;
      segs.forEach((b, k) => {
        const name = beats[k].querySelector('.beat-label [data-i18n]');
        b.setAttribute('aria-label', `${say('chapter').replace('{n}', k + 1)}${name ? `: ${name.textContent}` : ''}`);
      });
      startBtn.innerHTML = `${icon('play')}<span>${say('watch').replace('{s}', secs)}</span>`;
      setCtl(true);
    };
    let ctlKey = '';
    const setCtl = (force) => {
      const key = info.state === 'playing' ? 'pause' : info.state === 'done' ? 'replay' : 'play';
      if (key === ctlKey && !force) return;
      ctlKey = key;
      ctl.setAttribute('aria-label', say(key));
      ctl.innerHTML = icon(key);
    };
    const setState = (s) => {
      info.state = s;
      box.dataset.state = s;
      setCtl();
    };

    // Zeitleiste der Texte in Sekunden; sie läuft mit dem Video und wird an seiner Zeit nachgeführt
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    beats.forEach((beat, k) => {
      const at = marks[k];
      tl.set(beat, { opacity: 1 }, at);
      beatTexts(tl, beat, (x) => at + TEXT_SPAN * x, (x) => TEXT_SPAN * x, 'opacity');
      tl.fromTo(fills[k], { scaleX: 0 }, { scaleX: 1, duration: lenOf(k) }, at);
    });
    beats.slice(0, -1).forEach((beat, k) => tl.to(beat, { opacity: 0, duration: 0.35 }, marks[k + 1] - 0.35));
    // Schluss: das letzte Kapitel geht, Slogan und Knopf kommen über dem letzten Bild
    const endAt = marks[LAST - 1] + (R.moves ? R.moves[LAST - 1] : 5) + 0.6;
    tl.to(beats[LAST - 1], { opacity: 0, duration: 0.4 }, endAt - 0.45)
      .fromTo(Array.from(end.children), { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.15, ease: 'power2.out' }, endAt)
      .fromTo(move, { scale: 1 }, { scale: DRIFT, duration: R.dur }, 0);
    tl.time(0.001);

    // Abspielen
    let loaded = false;
    let ratio = 0;
    let dwell = 0;
    let userPaused = false;
    let t0 = 0;
    const attach = () => {
      if (loaded) return;
      loaded = true;
      video.src = file('v');
      video.preload = 'auto';
      video.load();
    };
    const seek = (t) => {
      tl.time(Math.max(0.001, t));
      attach();
      if (video.readyState >= 1) video.currentTime = t;
      else video.addEventListener('loadedmetadata', () => { video.currentTime = t; }, { once: true });
    };
    const halt = (byUser) => {
      clearTimeout(dwell);
      if (byUser) userPaused = true;
      if (!video.paused) video.pause();
      tl.pause();
      if (info.state === 'playing') setState('paused');
    };
    function start(byUser) {
      clearTimeout(dwell);
      if (byUser) userPaused = false;
      attach();
      if (info.state === 'done' || video.ended) seek(0);
      t0 = performance.now();
      const p = video.play();
      setState('playing');
      (p && p.then ? p : Promise.resolve()).then(() => {
        info.blocked = false;
        box.classList.remove('is-blocked');
      }, (e) => {
        tl.pause();
        setState(info.state === 'done' ? 'done' : 'paused');
        if (e && e.name === 'NotAllowedError') blocked();
      });
    }
    /** Stromsparmodus: kein Autoplay mehr, Poster mit dem ersten Kapitel und dem Startknopf */
    function blocked() {
      info.blocked = true;
      box.classList.add('is-blocked');
      if (info.state === 'idle' || tl.time() < 0.5) tl.time(TEXT_SPAN * 0.6);
    }
    const chapterAt = (t) => { let k = 0; marks.forEach((m, i) => { if (t >= m - 0.01) k = i; }); return k; };
    function jump(k) {
      userPaused = false;
      seek(marks[k] + 0.001);
      start(true);
    }
    function step(dir) {
      const t = loaded ? video.currentTime : tl.time();
      const k = chapterAt(t);
      if (dir > 0) { if (k < LAST - 1) jump(k + 1); return; }
      jump(t - marks[k] > 1.2 ? k : Math.max(0, k - 1));
    }
    ctl.addEventListener('click', () => {
      if (info.state === 'playing') halt(true);
      else start(true);
    });

    video.addEventListener('playing', () => {
      tl.time(video.currentTime);
      tl.play();
      if (!video.classList.contains('is-on')) {
        const shown = () => { video.classList.add('is-on'); info.latency = Math.round(performance.now() - t0); };
        if (typeof video.requestVideoFrameCallback === 'function') video.requestVideoFrameCallback(shown);
        else requestAnimationFrame(() => requestAnimationFrame(shown));
      }
    });
    video.addEventListener('waiting', () => { info.waiting++; tl.pause(); });
    video.addEventListener('pause', () => tl.pause());
    video.addEventListener('seeked', () => tl.time(video.currentTime));
    // Gegen Abdrift: die Zeitleiste läuft mit 60 Bildern/s, das Video gibt den Takt vor
    video.addEventListener('timeupdate', () => {
      if (!video.paused && Math.abs(tl.time() - video.currentTime) > 0.12) tl.time(video.currentTime);
    });
    video.addEventListener('ended', () => {
      tl.time(R.dur);
      tl.pause();
      setState('done');
    });
    // In-App-Browser ohne Inline-Wiedergabe öffnen Videos im Vollbild: dann nur noch per Knopf
    video.addEventListener('webkitbeginfullscreen', () => {
      if (typeof video.webkitExitFullscreen === 'function') video.webkitExitFullscreen();
      halt(false);
      blocked();
    });

    /** Läuft der Film, wenn er weit genug im Bild ist; hält an, wenn er hinausscrollt */
    const pick = () => {
      clearTimeout(dwell);
      if (ratio < STOP_AT || document.hidden) { if (info.state === 'playing') halt(false); return; }
      if (ratio < PLAY_AT || info.state === 'playing' || info.state === 'done' || userPaused || info.blocked) return;
      dwell = setTimeout(() => { if (ratio >= PLAY_AT && !document.hidden) start(false); }, DWELL_MS);
    };
    new IntersectionObserver(([e]) => { ratio = e.isIntersecting ? e.intersectionRatio : 0; pick(); }, { threshold: [0, STOP_AT, PLAY_AT] }).observe(box);
    // Laden, sobald der Hero zu einem Drittel hinausgescrollt ist
    new IntersectionObserver(([e]) => { if (e.isIntersecting) attach(); }, { rootMargin: '0px 0px -33% 0px' }).observe(box);
    document.addEventListener('visibilitychange', pick);
    document.addEventListener('hybote:lang', label);
    label();
    setState('idle');

    // Hero: Poster und Schleife wie auf der Bühne ausgerichtet; die Schleife ist zugleich die Probe, ob iOS Video
    // abspielen lässt
    new ResizeObserver(() => placeMedia()).observe(frameEl);
    heroLoop((arm) => arm(), (e) => { if (e && e.name === 'NotAllowedError') blocked(); }, true);

    if (params.get('film') === 'hud') {
      const hud = createHud();
      setInterval(() => {
        const q = typeof video.getVideoPlaybackQuality === 'function' ? video.getVideoPlaybackQuality() : null;
        hud.textContent = [
          `reel · ${info.state}${info.blocked ? ' · Autoplay gesperrt' : ''}`,
          `Zeit ${video.currentTime.toFixed(2)}/${R.dur} s · Texte ${tl.time().toFixed(2)} · Kapitel ${chapterAt(video.currentTime) + 1}`,
          `bereit ${video.readyState} · Startverzug ${info.latency} ms · Hänger ${info.waiting}`,
          q ? `Bilder ${q.totalVideoFrames} · verworfen ${q.droppedVideoFrames}` : '',
          `sichtbar ${ratio.toFixed(2)}`,
        ].filter(Boolean).join('\n');
      }, 250);
    }
    return { box, video, tl, info };
  }

  function createHud() {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:8px;top:84px;z-index:300;pointer-events:none;white-space:pre;font:11px/1.35 ui-monospace,Menlo,monospace;color:#f5f1eb;background:rgba(7,11,22,.85);padding:6px 8px;border-radius:6px';
    document.body.appendChild(el);
    return el;
  }

  /* ---------- Kapiteltexte ---------- */

  /**
   * Einblendungen eines Kapitels auf Zeitleiste `T`. `pos(x)`/`len(x)` rechnen den Anteil x (0–1) des Kapitels in
   * Zeitleisten-Einheiten um: quer Anteile der Scrollstrecke, hochkant Sekunden des Films. `A` ist die Deckkraft-
   * Eigenschaft: quer `autoAlpha` (unsichtbare Kapitel kosten nichts), hochkant `opacity` (Texte bleiben für
   * Screenreader lesbar, der Film läuft ja ohne Zutun weiter).
   */
  function beatTexts(T, beat, pos, len, A) {
    const sub = (sel) => Array.from(beat.querySelectorAll(sel));
    // y: 0 ausdrücklich, sonst übernimmt GSAP den CSS-Startwert (translateY 110 %) zusätzlich als Pixel
    T.fromTo(sub('.mask > span'), { yPercent: 110, y: 0 }, { yPercent: 0, y: 0, duration: len(0.24), stagger: len(0.04), ease: 'power3.out' }, pos(0.03))
      .fromTo(sub('.beat-body'), { y: 24, [A]: 0 }, { y: 0, [A]: 1, duration: len(0.2), ease: 'power2.out' }, pos(0.12));
    sub('[data-in]').forEach((el) => {
      T.fromTo(el, { y: 14, [A]: 0 }, { y: 0, [A]: 1, duration: len(0.12), ease: 'power2.out' }, pos(parseFloat(el.dataset.in)));
    });
    // Kapitel 2: der Cyan-Impuls im Moment der Antwort
    sub('.pulse').forEach((el) => {
      T.fromTo(el, { scale: 0.2, [A]: 0.95 }, { scale: 2.8, [A]: 0, duration: len(0.3), ease: 'power2.out' }, pos(parseFloat(el.dataset.at || '0.4')));
    });
    // Kapitel 3: die Kanal-Linien wachsen an die Ebenen heran
    sub('.chan-line').forEach((el, i) => {
      T.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: len(0.12), ease: 'power2.out' }, pos(0.58 + i * 0.04));
    });
    // Kapitel 5: Begrüßungen in vielen Sprachen lösen einander ab, die letzte bleibt
    const words = sub('.greet > span');
    words.forEach((w, i) => {
      const t0 = 0.18 + i * 0.13;
      T.fromTo(w, { yPercent: 100, [A]: 0 }, { yPercent: 0, [A]: 1, duration: len(0.06), ease: 'power2.out' }, pos(t0));
      if (i < words.length - 1) T.to(w, { yPercent: -100, [A]: 0, duration: len(0.06), ease: 'power2.in' }, pos(t0 + 0.1));
    });
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
      // Film: der Clip des Kapitels läuft im ersten Teil (FILM_SHARE), danach steht sein End-Bild
      tl.fromTo(clock, { film: k }, { film: k + 1, duration: SLICE * FILM_SHARE[phone ? 'phone' : 'desktop'], ease: 'power1.inOut', immediateRender: false }, at);
      // Ob ein Kapitel zu sehen ist, entscheidet der Scroll; seine Texte laufen mit
      tl.set(beat, { autoAlpha: 1 }, at);
      beatTexts(tl, beat, (x) => at + SLICE * x, (x) => SLICE * x, 'autoAlpha');
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
  if (mode === 'reel') {
    const reel = startReel();
    if (!reel) return;
    window.HyboteFilm = { reel, mode };
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
