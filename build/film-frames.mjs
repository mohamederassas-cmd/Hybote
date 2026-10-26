#!/usr/bin/env node
/**
 * Baut den Scroll-Film der Startseite aus dem Higgsfield-Rohmaterial (assets-src/film/, nicht im Repo).
 * Portiert aus Bugal (scripts/film-frames.mjs), angepasst an die statische Seite.
 *
 *   node build/film-frames.mjs          alles neu bauen
 *   node build/film-frames.mjs turn     nur bestimmte Kapitel, Loops oder Standbilder
 *
 * Braucht ffmpeg und cwebp (brew install ffmpeg webp). Schreibt:
 *   film/<shot>/<variant>/NNN.webp   Bildfolgen fürs Scrubbing
 *   film/loops/<name>.mp4 + .webp    nahtlose Loops (vor + zurück) mit Poster
 *   film/stills/<name>.webp          Standbilder
 *   film-manifest.js                 Größen, Bildanzahl und Versions-Hash für film.js
 *
 * film/ enthält nur Medien und ist ein Jahr im Cache (vercel.json); neue Dateien bekommen über `?v=` einen neuen Hash.
 */
import { spawnSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir, cpus } from "node:os";
import { fileURLToPath } from "node:url";
import config from "./film.config.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "assets-src", "film");
const out = join(root, "film");
const manifestPath = join(root, "film-manifest.js");
const only = new Set(process.argv.slice(2));
const want = (name) => only.size === 0 || only.has(name);

for (const bin of ["ffmpeg", "ffprobe", "cwebp"]) {
  if (spawnSync("which", [bin]).status !== 0) throw new Error(`${bin} fehlt (brew install ffmpeg webp)`);
}

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")}\n${r.stderr}`);
  return r.stdout;
};

/** Parallel mit begrenzter Anzahl Prozesse */
async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await fn(queue.shift()); }));
}

const spawnP = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd}: ${err}`))));
  });

/** Grund der Clips exakt auf den Seitengrund heben (je Kanal: bis `source` → `ground`, darüber linear) */
const f3 = (v) => (v / 255).toFixed(4);
const [si, gi] = [config.source.map(f3), config.ground.map(f3)];
const grade = `colorlevels=rimin=${si[0]}:gimin=${si[1]}:bimin=${si[2]}:romin=${gi[0]}:gomin=${gi[1]}:bomin=${gi[2]}`;
const crop = (c) => (c ? `crop=${c},` : "");

const size = (file) => {
  const [w, h] = run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]).trim().split(",").map(Number);
  return { w, h };
};

const hashDir = (dir) => {
  const h = createHash("sha1");
  for (const f of readdirSync(dir).sort()) h.update(f).update(readFileSync(join(dir, f)));
  return h.digest("hex").slice(0, 8);
};
const hashFile = (file) => createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 8);

// Bisheriges Manifest übernehmen, damit Teil-Builds nichts verlieren
let manifest = { order: config.shots, fps: config.fps, shots: {}, loops: {}, stills: {} };
if (existsSync(manifestPath)) {
  const m = readFileSync(manifestPath, "utf8").match(/window\.HYBOTE_FILM = (\{[\s\S]*\});/);
  if (m) manifest = { ...JSON.parse(m[1]), order: config.shots, fps: config.fps };
}

// ---------- Bildfolgen ----------
for (const shot of config.shots) {
  if (!want(shot)) continue;
  const file = join(src, "raw", `${shot}.mp4`);
  if (!existsSync(file)) { console.warn("· fehlt", `raw/${shot}.mp4`); continue; }
  for (const [variant, v] of Object.entries(config.variants)) {
    const dir = join(out, shot, variant);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const tmp = join(tmpdir(), `film-${shot}-${variant}-${process.pid}`);
    mkdirSync(tmp, { recursive: true });
    run("ffmpeg", ["-loglevel", "error", "-y", "-i", file, "-vf", `fps=${config.fps},${crop(v.crop)}scale=${v.width}:-2:flags=lanczos,${grade}`, join(tmp, "%03d.png")]);
    const pngs = readdirSync(tmp).filter((f) => f.endsWith(".png")).sort();
    await pool(pngs, Math.max(2, cpus().length - 1), (f) =>
      spawnP("cwebp", ["-quiet", "-q", String(v.quality), "-m", "6", "-sharp_yuv", join(tmp, f), "-o", join(dir, f.replace(".png", ".webp"))])
    );
    const { w, h } = size(join(tmp, pngs[0]));
    rmSync(tmp, { recursive: true, force: true });
    manifest.shots[shot] ??= {};
    manifest.shots[shot][variant] = { count: pngs.length, w, h, v: hashDir(dir), ...(v.cx !== undefined && { cx: v.cx }) };
    console.log("✓", shot, variant, pngs.length, "Frames", `${w}×${h}`);
  }
}

// ---------- Loops ----------
const rawDir = join(src, "raw");
const loopFiles = existsSync(rawDir) ? readdirSync(rawDir).filter((f) => f.startsWith("loop-") && f.endsWith(".mp4")) : [];
for (const f of loopFiles) {
  const base = f.slice(5, -4);
  // Jeder Loop entsteht als Desktop- und als Handy-Fassung (<name> und <name>-phone)
  for (const name of [base, `${base}-phone`]) {
    if (!want(base) && !want(name)) continue;
    const dir = join(out, "loops");
    mkdirSync(dir, { recursive: true });
    const file = join(rawDir, f);
    const { width, crf, crop: c } = { width: config.loops.width, crf: config.loops.crf, ...config.loops.sizes?.[name] };
    const vf = `${crop(c)}scale=${width}:-2:flags=lanczos,${grade},split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p`;
    run("ffmpeg", ["-loglevel", "error", "-y", "-i", file, "-an", "-filter_complex", vf, "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-movflags", "+faststart", join(dir, `${name}.mp4`)]);
    const poster = join(tmpdir(), `poster-${name}.png`);
    run("ffmpeg", ["-loglevel", "error", "-y", "-i", file, "-frames:v", "1", "-vf", `${crop(c)}scale=${width}:-2:flags=lanczos,${grade}`, poster]);
    run("cwebp", ["-quiet", "-q", "72", "-m", "6", poster, "-o", join(dir, `${name}.webp`)]);
    const { w, h } = size(poster);
    rmSync(poster);
    manifest.loops[name] = { w, h, v: hashFile(join(dir, `${name}.mp4`)) };
    console.log("✓ loop", name, `${w}×${h}`);
  }
}

// ---------- Standbilder ----------
for (const s of config.stills) {
  if (!want(s.name)) continue;
  const file = join(src, s.src);
  if (!existsSync(file)) { console.warn("· fehlt", s.src); continue; }
  const dir = join(out, "stills");
  mkdirSync(dir, { recursive: true });
  const { w: iw, h: ih } = size(file);
  let cw = iw;
  let ch = ih;
  if (s.aspect) {
    const [a, b] = s.aspect.split(":").map(Number);
    if (iw / ih > a / b) cw = Math.round((ih * a) / b);
    else ch = Math.round((iw * b) / a);
  }
  const x = Math.round((iw - cw) * (s.fx ?? 0.5));
  const y = Math.round((ih - ch) * (s.fy ?? 0.5));
  const width = Math.min(s.width ?? 1600, cw);
  const png = join(tmpdir(), `still-${s.name}.png`);
  run("ffmpeg", ["-loglevel", "error", "-y", "-i", file, "-vf", `crop=${cw}:${ch}:${x}:${y},scale=${width}:-2:flags=lanczos,${grade}`, png]);
  run("cwebp", ["-quiet", "-q", String(s.quality ?? 78), "-m", "6", "-sharp_yuv", png, "-o", join(dir, `${s.name}.webp`)]);
  const { w, h } = size(png);
  rmSync(png);
  manifest.stills[s.name] = { w, h, v: hashFile(join(dir, `${s.name}.webp`)) };
  console.log("✓ still", s.name, `${w}×${h}`);
}

mkdirSync(out, { recursive: true });
writeFileSync(
  manifestPath,
  `/* Größen, Bildanzahl und Versions-Hash des Scroll-Films. Diese Datei schreibt build/film-frames.mjs neu. */\nwindow.HYBOTE_FILM = ${JSON.stringify(manifest, null, 2)};\n`
);
console.log("film-manifest.js aktualisiert");

// Versions-Hashes der Poster und Standbilder in der Startseite nachziehen (die Dateien sind ein Jahr im Cache)
const indexPath = join(root, "index.html");
const page = readFileSync(indexPath, "utf8");
const next = page.replace(/\/film\/(loops|stills)\/([\w-]+)\.webp\?v=[0-9a-f]*/g, (m, kind, name) => {
  const entry = (kind === "loops" ? manifest.loops : manifest.stills)[name];
  return entry ? `/film/${kind}/${name}.webp?v=${entry.v}` : m;
});
if (next !== page) {
  writeFileSync(indexPath, next);
  console.log("index.html: Versions-Hashes aktualisiert");
}
