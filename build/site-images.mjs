// Bilder der Startseite aus den Quellen in assets-src/site/ (nicht im Repo) nach media/site/.
//
//   node build/site-images.mjs          alle Bilder
//   node build/site-images.mjs hero     nur Bilder, deren Name mit "hero" beginnt
//
// Je Bild ein Zuschnitt in Quellpixeln und mehrere Breiten als WebP (cwebp, brew install webp).
// Danach zieht das Skript die ?v=-Hashes in index.html nach (SHA-1 der Datei, 8 Zeichen); vercel.json
// hält /media/site/ ein Jahr im Cache, neue Fassungen kommen nur über den Hash.
// Dateinamen bleiben fest und werden überschrieben, Ordner werden nie gelöscht: Neu angelegte Ordner auf dem
// iCloud-Schreibtisch erzeugen sonst Konfliktkopien („hero-1920 2.webp“).

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets-src', 'site');
const OUT = join(ROOT, 'media', 'site');

// crop: [x, y, Breite, Höhe] in Pixeln der Quelle; widths: ausgelieferte Breiten; max: Größengrenze in KB für die
// größte Breite (Warnung, kein Abbruch)
export const IMAGES = [
  // Hero (seit 16.11.2026 hero-night-v2.png): Halbtotale, Hadi hinter dem Tresen, Hände auf dem Reservierungsbuch,
  // Kopf etwa ein Sechstel der Bildhöhe (Owner: der Kopf im Brustbild v1 war „viel zu groß“).
  // Entstehung: Higgsfield nano_banana_pro 2K, Job fa8cc146-8ede-4cf8-8b96-b5089ab5ceed, einzige Referenz k3-open
  // (Job d0356a5e), Prompt „Edit image 1 … exactly three changes“ (Tablet → Reservierungsbuch mit Goldstift, Schild leer,
  // Kopf leicht zum Betrachter). Die Augen kamen grün und wurden per Farbtonverschiebung (+23°, nur Visier) auf das
  // Türkis der Figurenbibel gesetzt. Engere Variante (Kopf größer): hero-night-v2-alt-nah.png, Job e4521984.
  //
  // Seit dem Abend des 16.11.2026 (Owner: Hadis starrer Frontalblick „vollkommen unästhetisch“) zeigt die Startseite
  // Hadi nicht mehr: Hintergrund der festen Bühne ist die Lobby LINKS von Hadi (Hadis Hand beginnt nachts bei x≈1925,
  // im Morgenbild der Ellbogen bei x≈2015). Nacht und Morgen haben denselben Ausschnitt, damit an der Abschnittsgrenze
  // derselbe Raum heller wird. Die Quelle ist dort nur 1880 px breit, daher keine 2560er-Fassung mehr.
  { name: 'hero', src: 'hero-night-v2.png', crop: [0, 0, 1880, 1536], widths: [1280, 1920], q: 80, max: 330 },
  // Hochkant fürs Handy (die feste Ebene füllt den Bildschirm): Stadtfenster, Holzwand, Lampe
  { name: 'hero-phone', src: 'hero-night-v2.png', crop: [880, 0, 1000, 1536], widths: [720, 1080], q: 78, max: 200 },
  { name: 'dawn', src: 'dawn.png', crop: [0, 0, 1880, 1536], widths: [1280, 1920], q: 80, max: 260 },
  { name: 'dawn-phone', src: 'dawn.png', crop: [880, 0, 1000, 1536], widths: [720, 1080], q: 78, max: 180 },
  // Tageslicht: vier Einsatzbilder (3:4). Das goldene Namensschild ist in den -v2-Quellen wegretuschiert
  // (assets-src/site/retouch-plates.py: Polygon ums Schild ohne Revers, Füllung nur aus hellem Stoff, feines Korn).
  // Das Porträt day-portrait.png (Karte „Try it yourself“) wird seit 16.11.2026 nicht mehr verwendet.
  { name: 'scene-dealer', src: 'day-dealer-v2.png', crop: [0, 420, 1536, 2048], widths: [480, 720, 1080], q: 78, max: 170 },
  { name: 'scene-clinic', src: 'day-clinic-v2.png', crop: [0, 360, 1536, 2048], widths: [480, 720, 1080], q: 78, max: 170 },
  { name: 'scene-apartment', src: 'day-apartment-v2.png', crop: [0, 300, 1536, 2048], widths: [480, 720, 1080], q: 78, max: 170 },
  { name: 'scene-office', src: 'day-office-v2.png', crop: [0, 420, 1536, 2048], widths: [480, 720, 1080], q: 78, max: 170 },
  // Die kleinen Hadi-Clips (media/site/hadi-morning.mp4, hadi-call.mp4 samt -start/-end.webp) baut dieses Skript nicht:
  // assets-src/film/site-clip-morning.py (Clip bell, Bilder 56–121) und site-clip-call.py (Clip turn, Bilder 30–121)
  // entfernen das Schild je Bild (Track in assets-src/film/tracks/) und schneiden 720×900 aus; danach
  // ffmpeg -framerate 24 … -vf scale=600:750 -c:v libx264 -crf 23 -movflags +faststart -an, Poster mit cwebp -q 80.
  // Die ?v=-Hashes der .mp4 zieht rehash() mit nach.
];

export const hashOf = (file) => createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 8);

function build(img) {
  const src = join(SRC, img.src);
  if (!existsSync(src)) throw new Error(`Quelle fehlt: ${src}`);
  const [x, y, w, h] = img.crop;
  for (const width of img.widths) {
    const out = join(OUT, `${img.name}-${width}.webp`);
    execFileSync('cwebp', [
      '-quiet', '-mt', '-m', '6', '-sharp_yuv', '-metadata', 'none', '-q', String(img.q),
      '-crop', String(x), String(y), String(w), String(h),
      '-resize', String(width), '0',
      src, '-o', out,
    ]);
    const kb = Math.round(statSync(out).size / 1024);
    const warn = width === Math.max(...img.widths) && kb > img.max ? `  (über ${img.max} KB)` : '';
    console.log(`  ${img.name}-${width}.webp  ${kb} KB${warn}`);
  }
}

// ?v= in index.html auf den Hash der jeweiligen Datei setzen
function rehash() {
  const path = join(ROOT, 'index.html');
  const html = readFileSync(path, 'utf8');
  const next = html.replace(/\/media\/site\/([\w-]+\.(?:webp|mp4))\?v=[0-9a-f]*/g, (m, file) => {
    const f = join(OUT, file);
    return existsSync(f) ? `/media/site/${file}?v=${hashOf(f)}` : m;
  });
  if (next !== html) { writeFileSync(path, next); console.log('  index.html: Hashes nachgezogen'); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = process.argv[2];
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  for (const img of IMAGES) if (!only || img.name.startsWith(only)) build(img);
  rehash();
}
