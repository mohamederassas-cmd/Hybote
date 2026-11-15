/**
 * Was `node build/film-frames.mjs` aus dem Rohmaterial in assets-src/film/ baut (Vorlage: Bugal, scripts/film.config.mjs).
 * Rohmaterial (nicht im Repo, nicht auf Vercel): Higgsfield-Clips in raw/, Schlüsselbilder in keys/, Prompts und Job-IDs in shots.json.
 */

/** Der Concierge steht in allen Schlüsselbildern rechts (Kopfmitte bei ~82 % der Bildbreite); der Handy-Ausschnitt liegt bei 78 %, damit er nicht über den Rand ragt */
const CX = 0.78;
/** Hochformat 3:4 aus dem 16:9-Clip, volle Höhe, Mitte bei CX */
const PHONE_CROP = `ih*3/4:ih:iw*${CX}-ih*3/8:0`;
/**
 * Handy: Aus den 1928×1076-Clips blieben für den Ausschnitt nur ~807×1076 Pixel, am iPhone fast dreifach vergrößert
 * (zu weich). Die Handy-Fassung kommt deshalb aus raw-4k/: dieselben Clips per Higgsfield/Topaz auf 3840×2160
 * hochgerechnet (02.11.2026, Job-IDs in shots.json), Ausschnitt ~1620×2160. 1440 breit passt 1:1 auf den Canvas
 * (film.js: DPR bis 2), ohne Nachschärfen.
 */
const PHONE_WIDTH = 1440;
const PHONE_RAW = "raw-4k";

export default {
  /** Scroll-Kapitel in Filmreihenfolge: raw/<name>.mp4 → film/<name>/<variant>/NNN.webp */
  shots: ["light", "turn", "open", "book", "bell"],
  /**
   * Bildfolgen fürs Scrubbing, nur noch quer (Desktop, iPad quer): ganzes 16:9-Bild, bildfüllend (film.js: cover).
   * `raw` = Ordner der Rohclips (sonst raw/), `sharpen` = optionale unsharp-Werte. Hochkant laufen seit 11/2026
   * Kapitel-Videos (`clips`), die Handy-Bildfolgen ruckelten am iPhone (1440×1920 je Bild, zu viel zum Dekodieren).
   */
  variants: {
    desktop: { width: 1920, quality: 66 },
  },
  /**
   * Jedes `step`-te Bild der 24-fps-Clips (121 Bilder): 2 → 61 Bilder je Kapitel, gleichmäßig 12 pro Sekunde.
   * Früher `fps=15`: ffmpeg ließ dann abwechselnd ein und zwei Bilder aus, das ruckelte bei jedem Scrolltempo.
   * Das letzte Bild (Nr. 121) bleibt dabei erhalten, die Nahtstellen zum nächsten Kapitel stimmen weiter.
   */
  sourceFps: 24,
  step: 2,
  /**
   * Hochkant (Handy, iPad hochkant): je Kapitel ein H.264-Video, das der Videochip abspielt, plus erstes und letztes
   * Bild als WebP (film.js zeigt sie, bis das Video läuft, und im Stromsparmodus). `width` 1440 wie die Hero-Schleife;
   * wirkt der Start am iPhone träge, auf 1080 senken (Level dann 4.1). `cx` landet im Manifest für die Anker.
   */
  clips: { width: PHONE_WIDTH, crf: 23, level: "5.0", raw: PHONE_RAW, crop: PHONE_CROP, cx: CX },
  /**
   * Tiefstes Schwarz der Clips → Seitengrund #070b16, damit die Bühne unten nahtlos in die Seite übergeht.
   * Alles bis `source` wird exakt zum Seitengrund, darüber wird linear angehoben.
   */
  source: [4, 8, 11],
  ground: [7, 11, 22],
  /** Endlos-Loops: raw/loop-<name>.mp4 → film/loops/<name>.mp4 (vor + zurück) + Poster */
  loops: { width: 1920, crf: 27, sizes: { "hero-phone": { width: PHONE_WIDTH, crf: 26, crop: PHONE_CROP, raw: PHONE_RAW } } },
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
