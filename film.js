/**
 * Scroll-Film der Startseite (25.10.2026, nach dem Vorbild Bugal Immobilien).
 *
 * Der HYBOTE-Concierge in einer Fünf-Sterne-Lobby erzählt in fünf Kapiteln, wie aus einer Anfrage um 23:47 ein Termin wird.
 * Jedes Kapitel ist ein Higgsfield-Clip (build/film-frames.mjs); das End-Bild eines Clips ist das Start-Bild des
 * nächsten. Die Szene `.film-scene` ist ein hoher Abschnitt mit stehender Bühne (position: sticky), eine
 * GSAP-Timeline wird vom Scroll gescrubbt.
 *
 * Zwei Wege (seit 15.11.2026):
 * - quer (Desktop, iPad quer): WebP-Bildfolgen im Canvas, die Timeline treibt die Filmuhr (0 → 5), Überblendung nur
 *   zwischen direkten Nachbarbildern, höchstens MAX_LIVE dekodierte Bilder.
 * - hochkant (Handy, iPad hochkant): je Kapitel ein Video (film/clips), das beim Betreten des Kapitels von vorn läuft
 *   und auf seinem letzten Bild stehen bleibt; die Texte laufen dann auf eigener Zeitleiste in Sekunden mit. Die
 *   früheren Handy-Bildfolgen (1440×1920, im Skript dekodiert) ruckelten am iPhone; den Videochip nicht.
 *
 * Portiert aus Bugal: lib/film/sequence.ts (Laden, Worker-Dekodierung, Überblendung), components/film/FilmCanvas.tsx
 * (Zeichnen, Touch-Glättung), lib/scenes/stage.ts (Bühne, Lenis), components/home/HomeMotion.tsx (Timeline).
 *
 * Ohne Film (reduzierte Bewegung, Datensparmodus, `?film=off`, fehlende Bibliotheken) bleibt die Szene ein normaler
 * Abschnitt: Hero mit Standbild, darunter die fünf Kapitel mit je einem Standbild (CSS `.film-scene:not(.is-live)`).
 * `?film=hud` zeigt Messwerte am Bildschirm, zum Prüfen am Handy ohne Web-Inspektor.
 */
(function () {
  'use strict';

  const M = window.HYBOTE_FILM;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const root = document.querySelector('.film-scene');
  if (!M || !gsap || !ScrollTrigger || !root) return;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

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
  /** Hochkant laufen Kapitel-Videos (der Videochip spielt sie flüssig ab), quer werden Bildfolgen gescrubbt */
  let mode = variant === 'phone' ? 'clips' : 'canvas';
  const SHOTS = M.order;
  const LAST = SHOTS.length;
  const touch = mq('(pointer: coarse)');
  const html = document.documentElement;
  const frameEl = root.querySelector('.film-frame');
  const canvas = root.querySelector('.film-canvas');
  const poster = root.querySelector('.film-poster');
  const loop = root.querySelector('.film-loop');
  const clipsBox = root.querySelector('.film-clips');
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
    const [a, b] = mode === 'clips' ? [1, 1] : ZOOM[shot] || [1, 1];
    return { fit: 'cover', zoom: a + (b - a) * smoothstep(p), ...FOCUS[variant] };
  }

  /** Ladereihenfolge: der laufende Clip zuerst, dann der nächste, der vorige und so weiter */
  const rankFor = (k, at) => (k >= at ? (k - at) * 2 : (at - k) * 2 + 1);
  /** Dämpfung der Filmposition am Touch-Gerät (Zeitkonstante in s); am Desktop glättet Lenis */
  const FOLLOW_TAU = 0.12;

  /* ---------- Poster, Loop, Anker ---------- */

  const loopName = variant === 'phone' ? 'hero-phone' : 'hero';
  const loopSize = M.loops[loopName] || { w: 1600, h: 904 };
  /** Bildgröße eines Kapitels: Clip (hochkant) oder Bildfolge (quer) */
  const sizeOf = (shot) => (mode === 'clips' ? (M.clips || {})[shot] : (M.shots[shot] || {}).desktop);
  const onPlace = [];

  // Impuls und Kanal-Beschriftungen hängen an Punkten im Bild (data-x/-y, Anteile des 16:9-Clips). Der Hochkant-Clip
  // ist ein Ausschnitt um den Concierge (Mitte bei `cx`, volle Höhe), deshalb wird x dafür umgerechnet. Das Filmbild
  // wird auf Arabisch nicht gespiegelt (das Namensschild stünde sonst spiegelverkehrt), die Anker also auch nicht.
  const anchors = Array.from(root.querySelectorAll('[data-anchor]'));
  function placeAnchors(bw, bh) {
    for (const el of anchors) {
      const shot = el.dataset.shot;
      const size = sizeOf(shot);
      if (!size) continue;
      let u = Number(el.dataset.x);
      if (mode === 'clips') {
        const part = (size.w / size.h) / (16 / 9);
        u = (u - ((size.cx ?? 0.5) - part / 2)) / part;
      }
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

  /** Poster und Loop liegen exakt dort, wo das erste Filmbild liegt (dieselbe Rechnung wie Canvas und Clips) */
  function placeMedia() {
    if (!frameEl) return;
    const box = frameEl.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const r = rect(loopSize.w, loopSize.h, box.width, box.height, look(SHOTS[0], 0));
    for (const el of [poster, loop]) {
      if (!el) continue;
      el.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;right:auto;bottom:auto;object-fit:fill`;
    }
    onPlace.forEach((fn) => fn(box.width, box.height));
    placeAnchors(box.width, box.height);
  }
  document.addEventListener('hybote:lang', () => requestAnimationFrame(placeMedia));

  /**
   * Hero-Schleife vor dem ersten Scroll: läuft nur ganz oben. `armWhen(arm)` bestimmt, wann sie lädt; `probe` erfährt,
   * ob iOS Video abspielen lässt (im Stromsparmodus lehnt Safari play() ab).
   */
  function heroLoop(armWhen, probe) {
    if (!loop) return;
    const src = `/film/loops/${loopName}.mp4?v=${loopSize.v || ''}`;
    let armed = false;
    const sync = () => {
      if (!armed) return;
      const top = window.scrollY < window.innerHeight * 0.1 && !(Number(root.dataset.beat) >= 0);
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
    window.addEventListener('scroll', sync, { passive: true });
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

  /* ---------- Hochkant: Kapitel-Videos ---------- */

  /** Ruhe nach dem Kapitelwechsel, bevor der Clip startet: beim schnellen Wischen startet nur das Zielkapitel */
  const SETTLE_MS = 140;
  /** Überblendungen der Standbilder (ms): vorwärts, rückwärts, ohne Video (Stromsparmodus) */
  const FADE_IN = 220;
  const FADE_BACK = 350;
  const FADE_STILLS = 900;

  /**
   * Hochkant: je Kapitel ein Video (film/clips), das beim Hineinscrollen von vorn läuft und auf seinem letzten Bild
   * stehen bleibt. Der Videochip dekodiert es, das bleibt am iPhone flüssig und scharf; die früheren Bildfolgen
   * (1440×1920 je Bild, im Skript dekodiert) ruckelten. Unter den Videos liegen erstes und letztes Bild als
   * Standbild: sie überbrücken das Laden, decken das Rückwärtsscrollen ab (Videos laufen nie rückwärts) und ersetzen
   * das Video, wenn iOS kein Abspielen erlaubt (Stromsparmodus); dann blenden die Standbilder ineinander über.
   * Zwei Video-Elemente wechseln sich ab: eines zeigt, das andere lädt das nächste Kapitel vor.
   */
  function startClips() {
    const C = M.clips || {};
    if (!clipsBox || !SHOTS.every((s) => C[s])) return null;
    const players = Array.from(clipsBox.querySelectorAll('.film-clip'));
    if (players.length < 2) return null;
    root.classList.add('is-clips');
    const url = (k, kind) => {
      const shot = SHOTS[k];
      return kind === 'v' ? `/film/clips/${shot}.mp4?v=${C[shot].v}` : `/film/clips/${shot}-${kind}.webp?v=${C[shot][kind]}`;
    };
    const info = { latency: 0, waiting: 0, stillsOnly: false };

    // Zwei Standbilder zum Überblenden; das obere (z 2) ist das zuletzt gezeigte
    const stills = [0, 1].map(() => {
      const img = document.createElement('img');
      img.className = 'film-still';
      img.alt = '';
      img.decoding = 'async';
      clipsBox.insertBefore(img, players[0]);
      return img;
    });
    let front = 0;
    let shownStill = '';
    let stillGen = 0;
    const showStill = (src, ms) => {
      if (src === shownStill) return;
      shownStill = src;
      const g = ++stillGen;
      const next = stills[1 - front];
      const prev = stills[front];
      next.src = src;
      const ready = typeof next.decode === 'function' ? next.decode().catch(() => undefined) : Promise.resolve();
      ready.then(() => {
        if (g !== stillGen) return;
        // Erst unsichtbar machen (liegt noch unter dem oberen Bild), dann oben einblenden
        next.style.transitionDuration = '0ms';
        next.classList.remove('is-on');
        void next.offsetWidth;
        next.style.transitionDuration = `${ms}ms`;
        next.style.zIndex = '2';
        prev.style.zIndex = '1';
        next.classList.add('is-on');
        front = 1 - front;
        setTimeout(() => { if (g === stillGen) prev.classList.remove('is-on'); }, ms + 60);
      });
    };
    const hideStills = (ms) => {
      shownStill = '';
      stillGen++;
      for (const s of stills) { s.style.transitionDuration = `${ms}ms`; s.classList.remove('is-on'); }
    };

    const vids = players.map((el) => {
      el.muted = true;
      el.defaultMuted = true;
      el.playsInline = true;
      el.setAttribute('webkit-playsinline', '');
      el.disableRemotePlayback = true;
      const v = { el, k: -1 };
      el.addEventListener('waiting', () => { info.waiting++; });
      // Am Ende bleibt das Video auf seinem letzten Bild stehen; darunter dasselbe Bild als Standbild
      el.addEventListener('ended', () => { if (active === v) showStill(url(v.k, 'z'), 0); });
      // In-App-Browser ohne Inline-Wiedergabe öffnen Videos im Vollbild: dann nur noch Standbilder
      el.addEventListener('webkitbeginfullscreen', () => {
        if (typeof el.webkitExitFullscreen === 'function') el.webkitExitFullscreen();
        noVideo();
      });
      return v;
    });

    let beat = -2; // -2 = noch keine Kapitelwahl, -1 = Hero
    let gen = 0; // jede Kapitelwahl beginnt eine Runde; Rückmeldungen älterer Runden zählen nicht
    let active = null; // Spieler des laufenden Kapitels
    let lastShown = null; // Spieler, der zuletzt sichtbar war (wird nicht sofort neu beladen: er blendet noch aus)
    let settle = 0;
    let inScene = true;
    let texts = []; // Zeitleisten der Kapiteltexte (build), je Kapitel eine

    const hideVideos = (ms) => {
      for (const v of vids) {
        v.el.style.transitionDuration = `${ms}ms`;
        v.el.classList.remove('is-on', 'is-warm');
        if (!v.el.paused) v.el.pause();
      }
    };
    const load = (v, k) => {
      if (v.k === k) return;
      v.k = k;
      v.el.src = url(k, 'v');
      v.el.preload = 'auto';
      v.el.load();
    };
    const preloadNext = (k) => {
      if (info.stillsOnly || k + 1 >= LAST) return;
      const spare = vids.find((v) => v !== active && !v.el.classList.contains('is-on'));
      if (spare) load(spare, k + 1);
    };
    function noVideo() {
      info.stillsOnly = true;
      hideVideos(FADE_BACK);
      active = null;
      if (beat >= 0) showStill(url(beat, 'z'), FADE_STILLS);
    }

    const play = (k, g) => {
      if (info.stillsOnly) { showStill(url(k, 'z'), FADE_STILLS); return; }
      const v = vids.find((x) => x.k === k) || vids.find((x) => x !== lastShown) || vids[0];
      active = v;
      load(v, k);
      const el = v.el;
      if (el.currentTime > 0.05) { try { el.currentTime = 0; } catch (e) { /* noch keine Metadaten */ } }
      el.style.transitionDuration = '160ms';
      el.classList.add('is-warm');
      const t0 = performance.now();
      const shown = () => {
        if (g !== gen) return;
        el.classList.add('is-on');
        el.classList.remove('is-warm');
        lastShown = v;
        info.latency = Math.round(performance.now() - t0);
        setTimeout(() => { if (g === gen) preloadNext(k); }, 400);
      };
      el.play().then(() => {
        if (g !== gen) return;
        if (typeof el.requestVideoFrameCallback === 'function') el.requestVideoFrameCallback(() => shown());
        else requestAnimationFrame(() => requestAnimationFrame(shown));
      }, (e) => {
        if (g !== gen) return;
        el.classList.remove('is-warm');
        if (e && e.name === 'NotAllowedError') noVideo();
        // Kein Video (Stromsparmodus, kein Netz): das Kapitel erzählen die Standbilder
        else showStill(url(k, 'z'), FADE_STILLS);
      });
    };

    // Schlussfenster: dasselbe letzte Bild in einem Fenster mit runden Ecken (fester Zuschnitt, nur die Deckkraft
    // wird animiert; ein animierter clip-path auf der Bühne kostet Safari bei jedem Scrollschritt ein Neuzeichnen)
    const win = document.createElement('div');
    win.className = 'film-window';
    win.setAttribute('aria-hidden', 'true');
    const winImg = document.createElement('img');
    winImg.alt = '';
    winImg.decoding = 'async';
    win.appendChild(winImg);
    frameEl.after(win);

    onPlace.push((bw, bh) => {
      const c = C[SHOTS[0]];
      const r = rect(c.w, c.h, bw, bh, look(SHOTS[0], 0));
      const css = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
      clipsBox.style.cssText = css;
      winImg.style.cssText = css;
    });
    const ro = new ResizeObserver(() => placeMedia());
    ro.observe(frameEl);

    /** Kapitel k betreten (-1 = Hero). Vorwärts: Startbild, nach kurzer Ruhe läuft der Clip. Rückwärts: Endbild. */
    const enter = (k) => {
      if (k === beat) return;
      const from = beat;
      beat = k;
      const g = ++gen;
      clearTimeout(settle);
      if (k >= LAST - 2 && !winImg.getAttribute('src')) winImg.src = url(LAST - 1, 'z');
      if (k < 0) {
        hideVideos(FADE_BACK);
        hideStills(FADE_BACK);
        active = null;
        return;
      }
      // Erster Aufruf mitten im Film (Neuladen): Kapitel steht schon auf seinem Endbild, kein Start
      const forward = from >= -1 && k > from;
      // Texte: vorwärts laufen sie mit dem Clip an, rückwärts stehen sie fertig da
      if (texts[k]) { if (forward) texts[k].restart(); else texts[k].progress(1); }
      if (forward) {
        showStill(url(k, 'a'), FADE_IN);
        hideVideos(FADE_IN);
        active = null;
        settle = setTimeout(() => { if (g === gen && inScene) play(k, g); }, SETTLE_MS);
      } else {
        showStill(url(k, 'z'), FADE_BACK);
        hideVideos(FADE_BACK);
        active = null;
        setTimeout(() => { if (g === gen) preloadNext(k); }, FADE_BACK + 60);
      }
    };
    const leave = () => {
      inScene = false;
      if (active && !active.el.paused) active.el.pause();
    };
    const enterBack = () => {
      inScene = true;
      if (active && active.el.paused && !active.el.ended) active.el.play().catch(() => showStill(url(active.k, 'z'), FADE_BACK));
    };
    document.addEventListener('visibilitychange', () => {
      if (!active) return;
      if (document.hidden) active.el.pause();
      else if (inScene && !active.el.ended) active.el.play().catch(() => showStill(url(active.k, 'z'), FADE_BACK));
    });

    // Hero-Schleife sofort laden (es gibt keine Bildfolge, der sie Leitung wegnähme); sie ist zugleich die Probe,
    // ob iOS Video abspielen lässt
    heroLoop((arm) => arm(), (e) => { if (e && e.name === 'NotAllowedError') noVideo(); });
    html.classList.add('film-ready');

    if (params.get('film') === 'hud') {
      const hud = createHud();
      setInterval(() => {
        const el = active && active.el;
        const q = el && typeof el.getVideoPlaybackQuality === 'function' ? el.getVideoPlaybackQuality() : null;
        hud.textContent = [
          `clips · Kapitel ${beat} · ${info.stillsOnly ? 'nur Standbilder' : 'Video'}`,
          el ? `${SHOTS[active.k]} ${el.currentTime.toFixed(2)}/${C[SHOTS[active.k]].dur} s · bereit ${el.readyState}${el.ended ? ' · Ende' : el.paused ? ' · Pause' : ''}` : 'kein Video',
          `Startverzug ${info.latency} ms · Hänger ${info.waiting}`,
          q ? `Bilder ${q.totalVideoFrames} · verworfen ${q.droppedVideoFrames}` : '',
          `Spieler ${vids.map((v) => (v.k >= 0 ? SHOTS[v.k] : '-')).join(' / ')}`,
          `${Math.round(frameEl.clientWidth)}×${Math.round(frameEl.clientHeight)} · ${touch ? 'touch' : 'maus'}`,
        ].filter(Boolean).join('\n');
      }, 250);
    }
    return {
      enter,
      leave,
      enterBack,
      info,
      // build() reicht die Text-Zeitleisten nach (bei jedem Wechsel der Breite neu); das laufende Kapitel steht fertig
      texts(list) { texts = list; if (beat >= 0 && texts[beat]) texts[beat].progress(1); },
    };
  }

  function createHud() {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:8px;top:84px;z-index:300;pointer-events:none;white-space:pre;font:11px/1.35 ui-monospace,Menlo,monospace;color:#f5f1eb;background:rgba(7,11,22,.85);padding:6px 8px;border-radius:6px';
    document.body.appendChild(el);
    return el;
  }

  /* ---------- Timeline ---------- */

  /**
   * Anteile der Scrollstrecke: Hero geht, fünf Kapitel, am Ende schrumpft das Bild in ein Fenster. Mit Clips ist die
   * Strecke kürzer (HOLD), die Kapitel bekommen etwas mehr von ihr.
   */
  const TIMING = { canvas: { B0: 0.05, SLICE: 0.165 }, clips: { B0: 0.06, SLICE: 0.16 } };
  let B0 = TIMING.canvas.B0;
  let SLICE = TIMING.canvas.SLICE;
  let END = B0 + LAST * SLICE;
  // Anteil des Kapitels, in dem sein Clip läuft (nur Bildfolgen); danach steht das End-Bild. Schmal länger: die Bühne
  // ist niedriger, bei 60 % käme beim Wischen in jedem Takt ein Sprung über mehrere Bilder
  const FILM_SHARE = { desktop: 0.6, phone: 0.85 };

  /**
   * Mit Clips: Sekunden, über die die Texte eines Kapitels erscheinen. Der Clip (5 s) entspricht dann wie früher
   * 85 % des Kapitels, Antwort-Impuls und zweite Sprechblase kommen im selben Moment des Films wie vorher.
   */
  const TEXT_SPAN = 5.9;

  function build(tl, phone, clips) {
    const q = (sel) => Array.from(root.querySelectorAll(sel));
    gsap.set(beats, { autoAlpha: 0 });
    // Ziele sind die inneren Hüllen: die äußeren (.ch-left/.ch-right) sind per transform positioniert
    tl.to(q('.film-loop-wrap'), { autoAlpha: 0, duration: 0.03 }, 0)
      .to(q('.hero-head, .hero-foot, .ticker'), { yPercent: -24, autoAlpha: 0, duration: 0.045, stagger: 0.005 }, 0.004)
      .to(q('.film-cue'), { autoAlpha: 0, duration: 0.02 }, 0);

    const texts = [];
    beats.forEach((beat, k) => {
      const at = B0 + k * SLICE;
      const sub = (sel) => Array.from(beat.querySelectorAll(sel));
      // Film (nur Bildfolgen): der Clip des Kapitels läuft im ersten Teil (FILM_SHARE), danach steht sein End-Bild.
      // Clips laufen von selbst, sobald das Kapitel beginnt (startClips).
      if (mode === 'canvas') {
        tl.fromTo(clock, { film: k }, { film: k + 1, duration: SLICE * FILM_SHARE[phone ? 'phone' : 'desktop'], ease: 'power1.inOut', immediateRender: false }, at);
      }
      // Ob ein Kapitel zu sehen ist, entscheidet immer der Scroll. Seine Texte laufen bei Bildfolgen mit dem Scroll,
      // bei Clips auf einer eigenen Zeitleiste in Sekunden, die startet, sobald das Kapitel beginnt: der Clip läuft ja
      // auch von selbst, sonst stünden halb eingeblendete Überschriften neben dem laufenden Film.
      tl.set(beat, { autoAlpha: 1 }, at);
      const own = mode === 'clips' ? gsap.timeline({ paused: true }) : null;
      const T = own || tl;
      const pos = (x) => (own ? x * TEXT_SPAN : at + SLICE * x);
      const len = (x) => (own ? x * TEXT_SPAN : SLICE * x);
      if (own) texts[k] = own;
      // y: 0 ausdrücklich, sonst übernimmt GSAP den CSS-Startwert (translateY 110 %) zusätzlich als Pixel
      T.fromTo(sub('.mask > span'), { yPercent: 110, y: 0 }, { yPercent: 0, y: 0, duration: len(0.24), stagger: len(0.04), ease: 'power3.out' }, pos(0.03))
        .fromTo(sub('.beat-body'), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: len(0.2), ease: 'power2.out' }, pos(0.12));
      sub('[data-in]').forEach((el) => {
        T.fromTo(el, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: len(0.12), ease: 'power2.out' }, pos(parseFloat(el.dataset.in)));
      });
      // Kapitel 2: der Cyan-Impuls im Moment der Antwort
      sub('.pulse').forEach((el) => {
        T.fromTo(el, { scale: 0.2, autoAlpha: 0.95 }, { scale: 2.8, autoAlpha: 0, duration: len(0.3), ease: 'power2.out' }, pos(parseFloat(el.dataset.at || '0.4')));
      });
      // Kapitel 3: die Kanal-Linien wachsen an die Ebenen heran
      sub('.chan-line').forEach((el, i) => {
        T.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: len(0.12), ease: 'power2.out' }, pos(0.58 + i * 0.04));
      });
      // Kapitel 5: Begrüßungen in vielen Sprachen lösen einander ab, die letzte bleibt
      const words = sub('.greet > span');
      words.forEach((w, i) => {
        const t0 = 0.18 + i * 0.13;
        T.fromTo(w, { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: len(0.06), ease: 'power2.out' }, pos(t0));
        if (i < words.length - 1) T.to(w, { yPercent: -100, autoAlpha: 0, duration: len(0.06), ease: 'power2.in' }, pos(t0 + 0.1));
      });
      if (k < LAST - 1) tl.to(beat, { autoAlpha: 0, duration: SLICE * 0.07 }, at + SLICE * 0.93);
    });
    if (clips) clips.texts(texts);

    // Schluss: das letzte Kapitel geht, der Slogan kommt, das Bild schrumpft in ein Fenster. Schmal liegt das Fenster
    // oben, breit beim Concierge (rechts), der Slogan steht daneben.
    const windowed = phone ? 'inset(14% 6% 38% 6% round 12px)' : 'inset(12% 5% 14% 40% round 12px)';
    tl.to(beats[LAST - 1], { autoAlpha: 0, duration: 0.03 }, END)
      .to(q('.film-nav'), { autoAlpha: 0, duration: 0.02 }, END);
    const win = root.querySelector('.film-window');
    if (mode === 'clips' && win) {
      // Fester Zuschnitt, animiert wird nur die Deckkraft: das Fenster kommt, die Bühne drumherum geht
      win.style.clipPath = windowed;
      win.style.webkitClipPath = windowed;
      tl.fromTo(win, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08, ease: 'power1.inOut' }, END + 0.012)
        .fromTo(q('.film-frame'), { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.1, ease: 'power1.inOut' }, END + 0.012);
    } else {
      tl.fromTo(q('.film-frame'), { clipPath: 'inset(0% 0% 0% 0% round 0px)' }, { clipPath: windowed, duration: 0.1, ease: 'power1.inOut' }, END + 0.012);
    }
    tl.fromTo(q('.film-end > *'), { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.05, stagger: 0.012, ease: 'power2.out' }, END + 0.04);
    if (tl.duration() < 1) tl.to({}, { duration: 1 - tl.duration() }, tl.duration());
  }

  /**
   * Szene: hoher Abschnitt, dessen Bühne stehen bleibt, während die Seite nativ daran vorbeiscrollt (keine
   * Wheel-Übernahme, die Scrollbar stimmt immer). Ohne .is-live ist sie ein normaler Abschnitt mit Standbildern.
   * HOLD = Scrollstrecke in Bildschirmhöhen. Mit Clips 6 (Szene 7 Höhen, je Kapitel knapp eine Höhe): mit 3,5
   * waren es je Kapitel nur ~450 px, ein Wisch am iPhone übersprang ein bis drei Kapitel (Abnahme 15.11.2026).
   */
  const HOLD = { desktop: 6, phone: 6.5, clips: 6 };
  /**
   * Hochkant: Rastpunkte (CSS scroll-snap), an denen Safari das Scrollen anhält, einer je Kapitel kurz nach seinem
   * Beginn, dazu Hero und Schlussbild. scroll-snap-stop: always lässt einen Wisch nicht über einen Punkt hinweg
   * laufen: ein Wisch, ein Kapitel. Nur „proximity“, damit der Rest der Seite (keine Punkte) frei scrollt.
   */
  const SNAP_INTO = 0.3;
  function scene(clips) {
    const mm = gsap.matchMedia();
    // matchMedia ruft die Funktion nur, wenn mindestens eine Bedingung zutrifft: deshalb beide Breiten nennen
    mm.add({ phone: '(max-width: 767px)', wide: '(min-width: 768px)' }, (c) => {
      const phone = Boolean(c.conditions && c.conditions.phone);
      root.classList.add('is-live');
      root.style.setProperty('--hold', String(mode === 'clips' ? HOLD.clips : HOLD[phone ? 'phone' : 'desktop']));
      const sync = (self) => {
        const k = Math.max(-1, Math.min(LAST - 1, Math.floor((self.progress - B0) / SLICE)));
        const beat = String(k);
        if (root.dataset.beat !== beat) root.dataset.beat = beat;
        if (clips) clips.enter(k);
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
          onLeave: () => clips && clips.leave(),
          onEnterBack: () => clips && clips.enterBack(),
        },
      });
      build(tl, phone, clips);
      // Rastpunkte (nur Clips): Lage aus der tatsächlichen Scrollstrecke der Timeline, nach jedem Refresh neu
      const snaps = [];
      let placeSnaps = null;
      if (mode === 'clips') {
        // letzter Punkt erst, wenn das Schlussfenster ganz steht (Ausblendung endet bei END + 0,112)
        const at = [0, ...beats.map((_, k) => B0 + SLICE * (k + SNAP_INTO)), Math.min(0.99, END + 0.125)];
        for (let i = 0; i < at.length; i++) {
          const d = document.createElement('div');
          d.className = 'film-snap';
          d.setAttribute('aria-hidden', 'true');
          root.appendChild(d);
          snaps.push(d);
        }
        placeSnaps = () => {
          const st = tl.scrollTrigger;
          if (!st) return;
          const top = root.getBoundingClientRect().top + window.scrollY;
          snaps.forEach((d, i) => { d.style.top = `${Math.round(st.start + (st.end - st.start) * at[i] - top)}px`; });
        };
        ScrollTrigger.addEventListener('refresh', placeSnaps);
        placeSnaps();
        html.classList.add('film-snap-on');
      }
      return () => {
        root.classList.remove('is-live');
        root.style.removeProperty('--hold');
        gsap.set(beats, { clearProps: 'all' });
        snaps.forEach((d) => d.remove());
        if (placeSnaps) ScrollTrigger.removeEventListener('refresh', placeSnaps);
        html.classList.remove('film-snap-on');
      };
    });
  }

  if (!variant) return;
  let clips = null;
  let film = null;
  if (mode === 'clips') clips = startClips();
  if (!clips) { mode = 'canvas'; film = startFilm(); }
  if (!clips && !film) return;
  ({ B0, SLICE } = TIMING[mode]);
  END = B0 + LAST * SLICE;
  smooth();
  scene(clips);
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
  window.HyboteFilm = { clock, film, clips, stats, mode };
})();
