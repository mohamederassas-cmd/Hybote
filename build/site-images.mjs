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
  // Hero quer: Hadi groß rechts (Kopf bei ~73 % der Breite), Lampe und Fenster links ruhig für den Text
  { name: 'hero', src: 'hero-night-v1.png', crop: [1304, 0, 4200, 2362], widths: [1280, 1920, 2560], q: 80, max: 330 },
  // Hero hochkant (4:5) fürs Handy: Brustbild, Kopf mittig
  { name: 'hero-phone', src: 'hero-night-v1.png', crop: [3046, 0, 2458, 3072], widths: [720, 1080, 1440], q: 78, max: 260 },
  // Morgengrauen-Band 21:9, Hadi rechts, Buch und Lampe auf dem Empfang; Handy 4:5
  { name: 'dawn', src: 'dawn.png', crop: [0, 150, 2752, 1179], widths: [1280, 1920, 2560], q: 80, max: 260 },
  { name: 'dawn-phone', src: 'dawn.png', crop: [1523, 0, 1229, 1536], widths: [720, 1080], q: 78, max: 180 },
  // Tageslicht: Porträt für die Karte „Hadi schreiben“ (4:5) und vier Einsatzbilder (3:4)
  { name: 'hadi', src: 'day-portrait.png', crop: [0, 560, 1536, 1920], widths: [480, 800, 1200], q: 80, max: 160 },
  { name: 'scene-dealer', src: 'day-dealer.png', crop: [0, 420, 1536, 2048], widths: [480, 720, 1080], q: 78, max: 170 },
  { name: 'scene-clinic', src: 'day-clinic.png', crop: [0, 360, 1536, 2048], widths: [480, 720, 1080], q: 78, max: 170 },
  { name: 'scene-apartment', src: 'day-apartment.png', crop: [0, 300, 1536, 2048], widths: [480, 720, 1080], q: 78, max: 170 },
  { name: 'scene-office', src: 'day-office.png', crop: [0, 420, 1536, 2048], widths: [480, 720, 1080], q: 78, max: 170 },
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
  const next = html.replace(/\/media\/site\/([\w-]+\.webp)\?v=[0-9a-f]*/g, (m, file) => {
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
