// Vorschaubild der Demo-Seite unter hybote.ai/v/<code>/og.jpg (03.11.2026, Plan „Demo zuerst“ Teil 4).
// Dient zweimal: als og:image für die Link-Vorschau in WhatsApp und LinkedIn und als Standbild vor dem Klick auf der
// Seite selbst (Zwei-Klick: der Browser spricht vor dem Klick nie mit Loom, das Bild kommt von uns).
//
// Geprüft am 03.11.2026 an zehn öffentlichen Loom-Videos (oEmbed https://www.loom.com/v1/oembed?url=…):
// - thumbnail_url liegt immer auf https://cdn.loom.com/sessions/thumbnails/<id>-<suffix>.<ext>.
// - Bei neueren Videos ist es oft ein animiertes GIF (bis 6 MB), für die WhatsApp-Vorschau ungeeignet. Unter
//   demselben Namen mit .jpg liegt jedes Mal ein echtes JPEG (30 bis 180 KB); das nehmen wir.
// - cdn.loom.com liefert ältere JPEGs als application/octet-stream mit nosniff aus. Eine Weiterleitung dorthin wäre
//   für Crawler riskant, deshalb reichen wir das Bild mit eigenem, geprüftem Content-Type durch.
// - Die Maße aus oEmbed stimmen nicht immer mit dem Bild überein (1280x960 gemeldet, 1280x800 geliefert), deshalb
//   nennt die Seite kein og:image:width/height.
// Kein brauchbares Bild (Zeile fehlt, zurückgezogen, fremder Host, GIF, zu groß, Fehler): HYBOTE-Standardbild.
const fs = require('node:fs');
const path = require('node:path');
const { configured, loadDemoRow, codeFromRequest } = require('../_demoPages.js');

const MAX_BYTES = 600 * 1024; // WhatsApp zeigt große Vorschaubilder unzuverlässig; Loom-JPEGs liegen weit darunter
const FETCH_TIMEOUT_MS = 5000;
const LOOM_HOSTS = new Set(['cdn.loom.com']);
const DEFAULT_IMAGE_URL = '/og-image.png?v=2';
const CACHE_OK = 'public, max-age=3600, s-maxage=3600';
const CACHE_FALLBACK = 'public, max-age=300, s-maxage=300';

let defaultImage = null;
function readDefaultImage() {
  if (defaultImage) return defaultImage;
  // Fester Pfad relativ zu dieser Datei, damit Vercels Datei-Analyse das Bild in die Function packt.
  defaultImage = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'og-image.png'));
  return defaultImage;
}

/** Loom-Vorschaubild als https-URL auf cdn.loom.com, GIF durch das gleichnamige JPEG ersetzt; sonst ''. */
function thumbnailUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || url.username || url.password || !LOOM_HOSTS.has(url.hostname)) return '';
    if (/\.gif$/i.test(url.pathname)) url.pathname = url.pathname.replace(/\.gif$/i, '.jpg');
    return url.toString();
  } catch (_error) {
    return '';
  }
}

/** Bildtyp aus den ersten Bytes; nur JPEG und PNG gelten als sichere Vorschaubilder. */
function sniffImageType(buffer) {
  if (!buffer || buffer.length < 8) return '';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  return '';
}

async function readLimited(result, max) {
  const declared = Number(result.headers.get('content-length') || 0);
  if (declared > max) return null;
  if (!result.body || !result.body.getReader) {
    const whole = Buffer.from(await result.arrayBuffer());
    return whole.length > max ? null : whole;
  }
  const reader = result.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { try { await reader.cancel(); } catch (_error) { /* egal */ } return null; }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function fetchThumbnail(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // redirect: 'error', damit die Host-Prüfung nicht über eine Weiterleitung umgangen wird.
    const result = await fetch(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'image/jpeg,image/png' } });
    if (!result.ok) return null;
    const buffer = await readLimited(result, MAX_BYTES);
    const type = sniffImageType(buffer);
    return type ? { buffer, type } : null;
  } finally {
    clearTimeout(timer);
  }
}

function sendImage(request, response, { buffer, type, cache }) {
  response.setHeader('Content-Type', type);
  response.setHeader('Content-Length', String(buffer.length));
  response.setHeader('Cache-Control', cache);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.status(200);
  if (request.method === 'HEAD') return response.end();
  return response.end(buffer);
}

function sendDefault(request, response) {
  try {
    return sendImage(request, response, { buffer: readDefaultImage(), type: 'image/png', cache: CACHE_FALLBACK });
  } catch (_error) {
    // Falls die Datei doch nicht in der Function liegt: Weiterleitung auf das statische Standardbild.
    response.setHeader('Cache-Control', CACHE_FALLBACK);
    response.setHeader('Location', DEFAULT_IMAGE_URL);
    return response.status(302).end();
  }
}

module.exports = async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    return response.status(405).end();
  }
  const code = codeFromRequest(request);
  if (!code) {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    return response.status(404).end();
  }
  if (!configured()) return sendDefault(request, response);
  try {
    const row = await loadDemoRow(code);
    const url = row && String(row.status || '').trim().toLowerCase() === 'live' ? thumbnailUrl(row.loom_thumbnail_url) : '';
    const image = url ? await fetchThumbnail(url) : null;
    if (image) return sendImage(request, response, { ...image, cache: CACHE_OK });
  } catch (error) {
    console.error('[demo-og]', error && error.message);
  }
  return sendDefault(request, response);
};

module.exports.thumbnailUrl = thumbnailUrl;
module.exports.sniffImageType = sniffImageType;
