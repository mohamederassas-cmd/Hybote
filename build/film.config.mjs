/**
 * Was `node build/film-frames.mjs` aus dem Rohmaterial in assets-src/film/ baut (Vorlage: Bugal, scripts/film.config.mjs).
 * Rohmaterial (nicht im Repo, nicht auf Vercel): Higgsfield-Clips in raw/, Schlüsselbilder in keys/, Prompts und Job-IDs in shots.json.
 */

/** Der Concierge steht in allen Schlüsselbildern rechts (Kopfmitte bei ~82 % der Bildbreite); der Handy-Ausschnitt liegt bei 78 %, damit er nicht über den Rand ragt */
const CX = 0.78;
/** Hochformat 3:4 aus dem 16:9-Clip, volle Höhe, Mitte bei CX */
const PHONE_CROP = `ih*3/4:ih:iw*${CX}-ih*3/8:0`;

export default {
  /** Scroll-Kapitel in Filmreihenfolge: raw/<name>.mp4 → film/<name>/<variant>/NNN.webp */
  shots: ["light", "turn", "open", "book", "bell"],
  /**
   * Desktop: ganzes 16:9-Bild, bildfüllend (film.js: cover). Handy: Hochformat-Ausschnitt um den Concierge;
   * `cx` landet im Manifest, damit film.js die Anker (data-x) in den Ausschnitt umrechnen kann.
   */
  variants: {
    desktop: { width: 1920, quality: 66 },
    phone: { width: 900, quality: 62, crop: PHONE_CROP, cx: CX },
  },
  /** Bilder pro Sekunde fürs Scrubbing (5-s-Clip → 75 Frames; bei 10 lagen die Bilder für langsames Scrollen zu weit auseinander) */
  fps: 15,
  /**
   * Tiefstes Schwarz der Clips → Seitengrund #070b16, damit die Bühne unten nahtlos in die Seite übergeht.
   * Alles bis `source` wird exakt zum Seitengrund, darüber wird linear angehoben.
   */
  source: [4, 8, 11],
  ground: [7, 11, 22],
  /** Endlos-Loops: raw/loop-<name>.mp4 → film/loops/<name>.mp4 (vor + zurück) + Poster */
  loops: { width: 1920, crf: 27, sizes: { "hero-phone": { width: 900, crf: 26, crop: PHONE_CROP } } },
  /** Standbilder (ohne Bewegung) aus Schlüsselbildern: aspect = Ausschnitt, fx/fy = Fokus (0–1) */
  stills: [
    { name: "lit", src: "keys/k1-light.png", aspect: "4:3", fx: 1, width: 1200 },
    { name: "turned", src: "keys/k2-turn.png", aspect: "4:3", fx: 1, width: 1200 },
    { name: "open", src: "keys/k3-open.png", aspect: "4:3", fx: 1, width: 1200 },
    { name: "book", src: "keys/k4-book.png", aspect: "4:3", fx: 1, width: 1200 },
    { name: "bell", src: "keys/k5-bell.png", aspect: "4:3", fx: 1, width: 1200 },
    /** Hintergrund des Kontakts: der Concierge im Morgengrauen */
    { name: "dawn", src: "keys/k5-bell.png", width: 1600, quality: 70 },
  ],
};
