/**
 * Scroll-Film der Startseite (25.10.2026, nach dem Vorbild Bugal Immobilien).
 *
 * Der HYBOTE-Concierge in einer Fünf-Sterne-Lobby erzählt in fünf Kapiteln, wie aus einer Anfrage um 23:47 ein Termin wird.
 * Jedes Kapitel ist ein Higgsfield-Clip als WebP-Bildfolge (build/film-frames.mjs); das End-Bild eines Clips ist das
 * Start-Bild des nächsten. Die Szene `.film-scene` ist ein hoher Abschnitt mit stehender Bühne (position: sticky),
 * eine GSAP-Timeline wird vom Scroll gescrubbt und treibt die Filmuhr (0 → 5) und die Texte.
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
  const AHEAD_MAX = 18;
  const BEHIND = 2;
  /** Puffer beim Freigeben: knapp außerhalb des Fensters bleiben Bilder noch liegen */
  const KEEP = 2;
  /** Überblendet wird zwischen fertigen Bildern, die höchstens so weit auseinanderliegen */
  const MAX_GAP = 6;

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
   * der Scrollgeschwindigkeit wächst; fehlen Bilder zwischen zwei fertigen, wird über die Lücke überblendet.
   */
  class FrameSequence {
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

    /** Bildpaar für Fortschritt p (0–1): überblendet zwischen den fertigen Bildern darunter und darüber */
    pair(p) {
      const f = this.pos(p);
      this.focus(Math.round(f), true);
      let lo = -1;
      let hi = -1;
      for (let k = Math.floor(f); k >= 0 && k >= f - MAX_GAP; k--) if (this.frames.has(k)) { lo = k; break; }
      for (let k = Math.ceil(f); k < this.spec.count && k <= f + MAX_GAP; k++) if (this.frames.has(k)) { hi = k; break; }
      if (lo >= 0 && hi >= 0 && hi - lo <= MAX_GAP) {
        let t = hi === lo ? 0 : (f - lo) / (hi - lo);
        // Nachbarbilder: jedes Bild steht ein Viertel der Strecke an beiden Enden scharf, überblendet wird nur in der
        // Mitte. Sonst zeigt langsames Scrollen fast immer ein halbtransparentes Doppelbild (wirkt unscharf).
        if (hi - lo === 1) { t = Math.min(1, Math.max(0, (t - 0.25) / 0.5)); t = t * t * (3 - 2 * t); }
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

    trim() {
      this.frames.forEach(release);
      this.frames.clear();
      this.showing = [];
      this.focusAt = -1;
      this.speed = 0;
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
      this.frames.forEach((f, i) => {
        if (!this.inWindow(i) && this.showing.indexOf(i) < 0) { release(f); this.frames.delete(i); }
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
  const SHOTS = M.order;
  const LAST = SHOTS.length;
  const touch = mq('(pointer: coarse)');
  const html = document.documentElement;
  const stage = root.querySelector('.film-stage');
  const canvas = root.querySelector('.film-canvas');
  const poster = root.querySelector('.film-poster');
  const loop = root.querySelector('.film-loop');
  const beats = Array.from(root.querySelectorAll('.beat'));
  const clock = { film: 0 };

  /**
   * Bildausschnitt je Kapitel: [Start, Ende] als Zoom über „cover“. Die Lobby füllt immer die ganze Bühne (1 = randlos),
   * die Kamerafahrten stecken in den Clips selbst; der Zoom gibt nur eine leichte Fahrt dazu.
   */
  // Nahtstellen: das Ende eines Kapitels hat denselben Wert wie der Anfang des nächsten, sonst springt das Bild
  const ZOOM = {
    desktop: { light: [1, 1.03], turn: [1.03, 1.03], open: [1.03, 1], book: [1, 1.02], bell: [1.02, 1] },
    phone: { light: [1, 1.03], turn: [1.03, 1.03], open: [1.03, 1], book: [1, 1.02], bell: [1.02, 1] },
  };
  // Handy: Hochformat-Ausschnitt aus der Bildmitte, der Concierge steht etwas über der Mitte
  const FOCUS = { desktop: { fx: 0.5, fy: 0.5 }, phone: { fx: 0.5, fy: 0.45 } };
  const smoothstep = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
  function look(shot, p) {
    const [a, b] = ZOOM[variant][shot] || [1, 1];
    return { fit: 'cover', zoom: a + (b - a) * smoothstep(p), ...FOCUS[variant] };
  }

  /** Ladereihenfolge: der laufende Clip zuerst, dann der nächste, der vorige und so weiter */
  const rankFor = (k, at) => (k >= at ? (k - at) * 2 : (at - k) * 2 + 1);
  /** Dämpfung der Filmposition am Touch-Gerät (Zeitkonstante in s); am Desktop glättet Lenis */
  const FOLLOW_TAU = 0.12;

  function startFilm() {
    const ctx = canvas && canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    const seqs = SHOTS.map((shot) => {
      const sizes = M.shots[shot] || {};
      const v = sizes[variant] ? variant : sizes.desktop ? 'desktop' : null;
      return v ? new FrameSequence({ base: `/film/${shot}/${v}`, ...sizes[v] }) : null;
    });
    if (!seqs[0]) return null;
    const rankAll = (at) => seqs.forEach((s, k) => s && s.load(rankFor(k, at)));
    rankAll(0);

    // Zeichenfläche = CSS-Box des Canvas (100lvh): ändert sich nicht, wenn am Handy die Adressleiste ein- und ausfährt
    let cw = 0;
    let ch = 0;
    let dirty = true;
    const loopName = variant === 'phone' ? 'hero-phone' : 'hero';
    const loopSize = M.loops[loopName] || { w: 1600, h: 904 };
    // Arabisch: das Bild wird gespiegelt (CSS), damit der Concierge auf der anderen Seite der Textspalte steht
    const rtl = () => document.documentElement.dir === 'rtl';
    // Poster und Loop liegen exakt dort, wo der Canvas das erste Bild zeichnet
    const placeMedia = () => {
      const box = canvas.getBoundingClientRect();
      const r = rect(loopSize.w, loopSize.h, box.width, box.height, look(SHOTS[0], 0));
      for (const el of [poster, loop]) {
        if (!el) continue;
        el.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;right:auto;bottom:auto;transform:${rtl() ? 'scaleX(-1)' : 'none'};object-fit:fill`;
      }
      placeAnchors(box.width, box.height);
    };
    // Impuls und Kanal-Beschriftungen hängen an Punkten im Bild (data-x/-y, Anteile des 16:9-Clips). Die Handy-Fassung
    // ist ein Hochformat-Ausschnitt um den Concierge (Mitte bei `cx`, volle Höhe), deshalb wird x dafür umgerechnet.
    const anchors = Array.from(root.querySelectorAll('[data-anchor]'));
    const placeAnchors = (bw, bh) => {
      for (const el of anchors) {
        const shot = el.dataset.shot;
        const sizes = M.shots[shot] || {};
        const size = sizes[variant] || sizes.desktop;
        if (!size) continue;
        let u = Number(el.dataset.x);
        if (variant === 'phone' && sizes.phone && sizes.desktop) {
          const part = (sizes.phone.w / sizes.phone.h) / (sizes.desktop.w / sizes.desktop.h);
          u = (u - ((sizes.phone.cx ?? 0.5) - part / 2)) / part;
        }
        const r = rect(size.w, size.h, bw, bh, look(shot, 1));
        let left = r.x + u * r.w;
        if (rtl()) left = bw - left;
        // Kanal-Chips: data-side="before" heißt, die Beschriftung steht vor dem Punkt und die Linie zeigt auf den
        // Concierge; im gespiegelten Bild (Arabisch) dreht sich das um. Beschriftungen bleiben im Fenster.
        if (el.classList.contains('chan')) {
          const before = (el.dataset.side === 'before') !== rtl();
          el.classList.toggle('is-before', before);
          left = before ? Math.max(10, left - el.offsetWidth) : Math.min(left, bw - el.offsetWidth - 10);
        }
        el.style.left = `${left}px`;
        el.style.top = `${r.y + Number(el.dataset.y) * r.h}px`;
      }
    };
    const ro = new ResizeObserver(([e]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cw = Math.round(e.contentRect.width * dpr);
      ch = Math.round(e.contentRect.height * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      placeMedia();
      dirty = true;
    });
    ro.observe(canvas);
    document.addEventListener('hybote:lang', () => requestAnimationFrame(placeMedia));

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

    // Loop vor dem ersten Scroll: startet, wenn das erste Kapitel geladen ist (oder nach 6 s), läuft nur ganz oben
    if (loop) {
      const src = `/film/loops/${loopName}.mp4?v=${loopSize.v || ''}`;
      let armed = false;
      const arm = () => {
        if (armed) return;
        armed = true;
        loop.src = src;
        sync();
      };
      const sync = () => {
        if (!armed) return;
        const top = window.scrollY < vh * 0.1;
        if (top && loop.paused) loop.play().then(() => loop.classList.add('is-on'), () => {});
        else if (!top && !loop.paused) loop.pause();
      };
      window.addEventListener('scroll', sync, { passive: true });
      setTimeout(arm, 6000);
      const waitFirst = () => (seqs[0].complete ? arm() : setTimeout(waitFirst, 250));
      waitFirst();
    }

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
        `dekodieren ${stats.decodeMs.toFixed(1)} ms · verworfen ${stats.dropped}`,
        `${variant} ${cw}×${ch} · ${touch ? 'touch' : 'maus'}`,
      ].filter(Boolean).join('\n');
      stat.frames = 0;
      stat.worst = 0;
      stat.lag = 0;
      stat.since = at;
    });
    return { seqs };
  }

  function createHud() {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:8px;top:84px;z-index:300;pointer-events:none;white-space:pre;font:11px/1.35 ui-monospace,Menlo,monospace;color:#f5f1eb;background:rgba(7,11,22,.85);padding:6px 8px;border-radius:6px';
    document.body.appendChild(el);
    return el;
  }

  /* ---------- Timeline ---------- */

  // Anteile der Scrollstrecke: Hero geht, fünf Kapitel, am Ende schrumpft das Bild in ein Fenster
  const B0 = 0.05;
  const SLICE = 0.165;
  const END = B0 + LAST * SLICE;

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
      // Film: der Clip des Kapitels läuft in den ersten 60 %, danach steht sein End-Bild
      tl.fromTo(clock, { film: k }, { film: k + 1, duration: SLICE * 0.6, ease: 'power1.inOut', immediateRender: false }, at);
      tl.set(beat, { autoAlpha: 1 }, at)
        // y: 0 ausdrücklich, sonst übernimmt GSAP den CSS-Startwert (translateY 110 %) zusätzlich als Pixel
        .fromTo(sub('.mask > span'), { yPercent: 110, y: 0 }, { yPercent: 0, y: 0, duration: SLICE * 0.24, stagger: SLICE * 0.04, ease: 'power3.out' }, at + SLICE * 0.03)
        .fromTo(sub('.beat-body'), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: SLICE * 0.2, ease: 'power2.out' }, at + SLICE * 0.12);
      sub('[data-in]').forEach((el) => {
        tl.fromTo(el, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: SLICE * 0.12, ease: 'power2.out' }, at + SLICE * parseFloat(el.dataset.in));
      });
      // Kapitel 2: der Cyan-Impuls im Moment der Antwort
      sub('.pulse').forEach((el) => {
        tl.fromTo(el, { scale: 0.2, autoAlpha: 0.95 }, { scale: 2.8, autoAlpha: 0, duration: SLICE * 0.3, ease: 'power2.out' }, at + SLICE * parseFloat(el.dataset.at || '0.4'));
      });
      // Kapitel 3: die Kanal-Linien wachsen an die Ebenen heran
      sub('.chan-line').forEach((el, i) => {
        tl.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: SLICE * 0.12, ease: 'power2.out' }, at + SLICE * (0.58 + i * 0.04));
      });
      // Kapitel 5: Begrüßungen in vielen Sprachen lösen einander ab, die letzte bleibt
      const words = sub('.greet > span');
      words.forEach((w, i) => {
        const t0 = at + SLICE * (0.18 + i * 0.13);
        tl.fromTo(w, { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: SLICE * 0.06, ease: 'power2.out' }, t0);
        if (i < words.length - 1) tl.to(w, { yPercent: -100, autoAlpha: 0, duration: SLICE * 0.06, ease: 'power2.in' }, t0 + SLICE * 0.1);
      });
      if (k < LAST - 1) tl.to(beat, { autoAlpha: 0, duration: SLICE * 0.07 }, at + SLICE * 0.93);
    });

    // Schluss: das letzte Kapitel geht, der Slogan kommt, das Bild schrumpft in ein Fenster. Am Desktop liegt das
    // Fenster auf der Seite des Concierge (im gespiegelten Bild links), der Slogan steht daneben.
    // Funktionswert: GSAP liest ihn bei jedem Refresh neu (invalidateOnRefresh), also auch nach einem Sprachwechsel
    const windowed = () => (phone ? 'inset(14% 6% 38% 6% round 12px)'
      : document.documentElement.dir === 'rtl' ? 'inset(12% 40% 14% 5% round 12px)' : 'inset(12% 5% 14% 40% round 12px)');
    tl.to(beats[LAST - 1], { autoAlpha: 0, duration: 0.03 }, END)
      .fromTo(q('.film-frame'), { clipPath: 'inset(0% 0% 0% 0% round 0px)' }, { clipPath: windowed, duration: 0.1, ease: 'power1.inOut' }, END + 0.012)
      .fromTo(q('.film-end > *'), { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.05, stagger: 0.012, ease: 'power2.out' }, END + 0.04);
    if (tl.duration() < 1) tl.to({}, { duration: 1 - tl.duration() }, tl.duration());
  }

  /**
   * Szene: hoher Abschnitt, dessen Bühne stehen bleibt, während die Seite nativ daran vorbeiscrollt (keine
   * Wheel-Übernahme, die Scrollbar stimmt immer). Ohne .is-live ist sie ein normaler Abschnitt mit Standbildern.
   */
  const HOLD = { desktop: 6, phone: 6.5 };
  function scene() {
    const mm = gsap.matchMedia();
    // matchMedia ruft die Funktion nur, wenn mindestens eine Bedingung zutrifft: deshalb beide Breiten nennen
    mm.add({ phone: '(max-width: 767px)', wide: '(min-width: 768px)' }, (c) => {
      const phone = Boolean(c.conditions && c.conditions.phone);
      root.classList.add('is-live');
      root.style.setProperty('--hold', String(HOLD[phone ? 'phone' : 'desktop']));
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const beat = String(Math.max(-1, Math.min(LAST - 1, Math.floor((self.progress - B0) / SLICE))));
            if (root.dataset.beat !== beat) root.dataset.beat = beat;
          },
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
  const film = startFilm();
  if (!film) return;
  smooth();
  scene();
  // Sprachwechsel: Texthöhen und Schreibrichtung ändern sich, Schlussfenster und Anker neu berechnen
  document.addEventListener('hybote:lang', () => requestAnimationFrame(() => ScrollTrigger.refresh()));
  document.dispatchEvent(new Event('hybote:film'));

  // Schriften bestimmen die Höhen; danach einmal neu messen
  const refresh = () => ScrollTrigger.refresh();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  window.addEventListener('load', refresh);
  window.HyboteFilm = { clock, film, stats };
})();
