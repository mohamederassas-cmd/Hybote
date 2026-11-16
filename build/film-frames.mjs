#!/usr/bin/env node
/**
 * Baut den Scroll-Film der Startseite aus dem Higgsfield-Rohmaterial (assets-src/film/, nicht im Repo).
 * Portiert aus Bugal (scripts/film-frames.mjs), angepasst an die statische Seite.
 *
 *   node build/film-frames.mjs          alles neu bauen
 *   node build/film-frames.mjs turn     nur bestimmte Kapitel, Loops oder Standbilder
 *
 * Braucht ffmpeg und cwebp (brew install ffmpeg webp). Schreibt:
 *   film/<shot>/<variant>/NNN.webp   Bildfolgen fürs Scrubbing (quer)
 *   film/clips/reel.mp4              hochkant ein Film aus allen Kapiteln, dazu reel-a.webp / reel-z.webp (erstes, letztes Bild)
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
const sharpen = (s) => (s ? `unsharp=${s},` : "");

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
const fps = config.sourceFps / config.step;
let manifest = { order: config.shots, fps, shots: {}, loops: {}, stills: {} };
if (existsSync(manifestPath)) {
  const m = readFileSync(manifestPath, "utf8").match(/window\.HYBOTE_FILM = (\{[\s\S]*\});/);
  if (m) manifest = { ...JSON.parse(m[1]), order: config.shots, fps };
}
// Kapitel-Videos je Kapitel gibt es nicht mehr (seit 16.11.2026 ein Film, `reel`)
delete manifest.clips;
// Fassungen, die es nicht mehr gibt (die Handy-Bildfolgen), aus dem Manifest nehmen
for (const sizes of Object.values(manifest.shots)) {
  for (const v of Object.keys(sizes)) if (!config.variants[v]) delete sizes[v];
}

/** Rohclip aus dem Ordner der Fassung (`raw` in der Config, sonst raw/); fehlt er dort, mit Warnung aus raw/ */
const rawFile = (dir, name) => {
  for (const d of dir ? [dir, "raw"] : ["raw"]) {
    const file = join(src, d, name);
    if (!existsSync(file)) { console.warn("· fehlt", `${d}/${name}`); continue; }
    return file;
  }
  return null;
};

// ---------- Bildfolgen ----------
for (const shot of config.shots) {
  if (!want(shot)) continue;
  for (const [variant, v] of Object.entries(config.variants)) {
    const file = rawFile(v.raw, `${shot}.mp4`);
    if (!file) continue;
    const dir = join(out, shot, variant);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const tmp = join(tmpdir(), `film-${shot}-${variant}-${process.pid}`);
    mkdirSync(tmp, { recursive: true });
    // Jedes step-te Quellbild, ohne Zeitraster (passthrough): gleiche Abstände, kein ausgelassenes oder doppeltes Bild
    const pick = `select='not(mod(n\\,${config.step}))'`;
    run("ffmpeg", ["-loglevel", "error", "-y", "-i", file, "-vf", `${pick},${crop(v.crop)}scale=${v.width}:-2:flags=lanczos,${sharpen(v.sharpen)}${grade}`, "-fps_mode", "passthrough", join(tmp, "%03d.png")]);
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

// ---------- Kapitel-Videos (hochkant) ----------
// Das Rohmaterial hat keine Farbangabe: durchgehend BT.709 festlegen (setparams), damit ffmpeg beim Graden und beim
// Herausziehen der Standbilder dieselbe Matrix nimmt wie Safari beim Abspielen. Sonst springt die Farbe, wenn das
// Video das Standbild ablöst.
const BT709 = "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv";
const still = (video, args, png, webp) => {
  run("ffmpeg", ["-loglevel", "error", "-y", ...args, "-i", video, "-vf", `${BT709},format=rgb24`, "-frames:v", "1", "-update", "1", png]);
  run("cwebp", ["-quiet", "-q", "80", "-m", "6", "-sharp_yuv", png, "-o", webp]);
};
const lastFrame = (video, png) => {
  // -update überschreibt die Datei mit jedem Bild: übrig bleibt das letzte
  run("ffmpeg", ["-loglevel", "error", "-y", "-sseof", "-1", "-i", video, "-vf", `${BT709},format=rgb24`, "-update", "1", png]);
};
// ---------- Hochkant: ein Film aus allen Kapiteln ----------
if (config.reel && (want("reel") || config.shots.some(want))) {
  const c = config.reel;
  const fpsIn = config.sourceFps;
  const files = config.shots.map((shot) => rawFile(c.raw, `${shot}.mp4`));
  if (files.every(Boolean)) {
    const dir = join(out, "clips");
    mkdirSync(dir, { recursive: true });
    // Bilder je Clip (ohne das weggelassene Nahtbild) → Kapitelanfänge und Bewegungsdauer in Sekunden
    const counts = files.map((f, k) => {
      const n = Number(run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", f]).trim());
      return k === 0 ? n : n - 1;
    });
    const holds = config.shots.map((_, k) => (k === config.shots.length - 1 ? c.endHold : c.hold));
    // Kapitelanfänge als Bildnummer: Zeit = Bild / fps (gerundet läge sie ein Bild zu spät, dort säße der Keyframe)
    const starts = [];
    const moves = [];
    let frame = 0;
    counts.forEach((n, k) => {
      starts.push(frame);
      moves.push(Math.round((n / fpsIn) * 1000) / 1000);
      frame += n + holds[k] * fpsIn;
    });
    const marks = starts.map((f) => Math.floor((f / fpsIn) * 1000) / 1000);
    const chains = files.map((_, k) => {
      const trim = k === 0 ? "" : "trim=start_frame=1,setpts=PTS-STARTPTS,";
      return `[${k}:v]${BT709},${trim}${crop(c.crop)}scale=${c.width}:-2:flags=lanczos,${grade},format=yuv420p,tpad=stop_mode=clone:stop_duration=${holds[k]}[v${k}]`;
    });
    const graph = `${chains.join(";")};${files.map((_, k) => `[v${k}]`).join("")}concat=n=${files.length}:v=1:a=0,fps=${fpsIn},${BT709}[out]`;
    const mp4 = join(dir, "reel.mp4");
    run("ffmpeg", [
      "-loglevel", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-an", "-filter_complex", graph, "-map", "[out]",
      "-c:v", "libx264", "-preset", "slow", "-crf", String(c.crf), "-profile:v", "high", "-level:v", c.level, "-pix_fmt", "yuv420p",
      // Keyframes nur an den Kapitelanfängen (plus spätestens alle 10 s): jeder kostet bei 1440×1920 über 100 KB
      "-g", String(fpsIn * 10), "-force_key_frames", `expr:${starts.map((f) => `eq(n,${f})`).join("+")}`,
      "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
      "-movflags", "+faststart", mp4,
    ]);
    const a = join(dir, "reel-a.webp");
    const z = join(dir, "reel-z.webp");
    const pa = join(tmpdir(), "reel-a.png");
    const pz = join(tmpdir(), "reel-z.png");
    still(mp4, [], pa, a);
    lastFrame(mp4, pz);
    run("cwebp", ["-quiet", "-q", "80", "-m", "6", "-sharp_yuv", pz, "-o", z]);
    rmSync(pa);
    rmSync(pz);
    // Kapitel-Videos der früheren Fassung entfernen
    for (const shot of config.shots) for (const s of [".mp4", "-a.webp", "-z.webp"]) rmSync(join(dir, `${shot}${s}`), { force: true });
    const { w, h } = size(mp4);
    const dur = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).trim());
    manifest.reel = { w, h, dur: Math.round(dur * 1000) / 1000, marks, moves, v: hashFile(mp4), a: hashFile(a), z: hashFile(z), cx: c.cx };
    console.log("✓ reel", `${w}×${h}`, `${dur.toFixed(2)} s`, "Kapitel ab", marks.join(" / "), "s");
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
    const { width, crf, crop: c, sharpen: sh, raw } = { width: config.loops.width, crf: config.loops.crf, ...config.loops.sizes?.[name] };
    const file = rawFile(raw, f);
    if (!file) continue;
    const vf = `${crop(c)}scale=${width}:-2:flags=lanczos,${sharpen(sh)}${grade},split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p`;
    run("ffmpeg", ["-loglevel", "error", "-y", "-i", file, "-an", "-filter_complex", vf, "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-movflags", "+faststart", join(dir, `${name}.mp4`)]);
    const poster = join(tmpdir(), `poster-${name}.png`);
    run("ffmpeg", ["-loglevel", "error", "-y", "-i", file, "-frames:v", "1", "-vf", `${crop(c)}scale=${width}:-2:flags=lanczos,${sharpen(sh)}${grade}`, poster]);
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
