// Demo-Seiten hybote.ai/v/<code> (03.11.2026, Plan „Demo zuerst“ Teil 4).
// Der Control Tower ist nur im Tailnet erreichbar, deshalb ist die n8n-Tabelle demo_pages die Bruecke: der Tower
// schreibt je Demo eine Zeile (Code, Status, Sprache, Art, Firmenname, Loom-ID, Vorschaubild, Links, Version; KEINE
// Personendaten), die Webseite liest sie hier. Die Tabellen-ID kommt aus N8N_DEMO_PAGES_TABLE_ID oder wird per Name
// gesucht (wie ig_tenants in _igTenant.js), damit nach dem Anlegen durch den Tower keine Env-Pflege noetig ist.
// Gelesen wird mit kurzem Zeitlimit (die WhatsApp- und LinkedIn-Vorschau wartet nicht lange) und einem 60-s-Cache je
// warmer Instanz: Aufrufe und Vorschau-Crawler treffen n8n so hoechstens einmal pro Minute und Code.
const { config } = require('./_n8n.js');

const TABLE_NAME = 'demo_pages';
const N8N_TIMEOUT_MS = 6000;
const CACHE_MS = 60 * 1000;
const DEMO_CODE = /^[a-z2-9]{10}$/;

let cachedTableId = '';
const rowCache = new Map();

function configured() {
  const c = config();
  return Boolean(c.baseUrl && c.apiKey);
}

async function n8nGet(path) {
  const c = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);
  try {
    const result = await fetch(`${c.baseUrl}/api/v1/${path}`, {
      signal: controller.signal,
      headers: { 'X-N8N-API-KEY': c.apiKey, Accept: 'application/json' }
    });
    const payload = await result.json().catch(() => ({}));
    if (!result.ok) {
      const error = new Error('N8N_API_ERROR');
      error.status = result.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function list(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

async function demoTableId() {
  if (process.env.N8N_DEMO_PAGES_TABLE_ID) return process.env.N8N_DEMO_PAGES_TABLE_ID;
  if (cachedTableId) return cachedTableId;
  const payload = await n8nGet(`data-tables?limit=100&filter=${encodeURIComponent(JSON.stringify({ name: TABLE_NAME }))}`);
  const hit = list(payload).find((t) => t && t.name === TABLE_NAME);
  if (!hit || !hit.id) {
    const error = new Error('DEMO_TABLE_MISSING');
    error.detail = 'n8n-Tabelle demo_pages fehlt (legt der Control Tower an)';
    throw error;
  }
  cachedTableId = String(hit.id);
  return cachedTableId;
}

/** Zeile zum Code oder null. Wirft nur bei n8n-Fehlern (die Seite zeigt dann 503 statt eines falschen 404).
 *  Treffer und Fehlanzeigen werden 60 s gemerkt; Fehler nicht, damit der naechste Aufruf es neu versucht. */
async function loadDemoRow(code) {
  const key = String(code || '').toLowerCase();
  if (!DEMO_CODE.test(key)) return null;
  const hit = rowCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.row;
  const tableId = await demoTableId();
  const filter = encodeURIComponent(JSON.stringify({ type: 'and', filters: [{ columnName: 'code', condition: 'eq', value: key }] }));
  const row = list(await n8nGet(`data-tables/${tableId}/rows?filter=${filter}&limit=1`))[0] || null;
  rowCache.set(key, { row, at: Date.now() });
  if (rowCache.size > 500) rowCache.delete(rowCache.keys().next().value);
  return row;
}

/** Code aus /v/<code>[/og.jpg] (Originalpfad) oder aus ?code= (Rewrite-Ziel); je nach Laufzeit steht in request.url
 *  das eine oder das andere, siehe api/connect/[...path].js. */
function codeFromRequest(request) {
  const url = new URL(request.url || '/', 'https://hybote.ai');
  const fromPath = /^\/v\/([a-z2-9]{10})(?:\/og\.jpg)?\/?$/i.exec(url.pathname);
  const fromQuery = url.searchParams.get('code') || (request.query && request.query.code ? [].concat(request.query.code)[0] : '');
  const code = String(fromPath ? fromPath[1] : fromQuery || '').toLowerCase();
  return DEMO_CODE.test(code) ? code : '';
}

function queryFlag(request, name) {
  const url = new URL(request.url || '/', 'https://hybote.ai');
  const value = url.searchParams.get(name) || (request.query && request.query[name] ? [].concat(request.query[name])[0] : '');
  return String(value || '');
}

function resetDemoCache() {
  cachedTableId = '';
  rowCache.clear();
}

module.exports = { DEMO_CODE, configured, loadDemoRow, codeFromRequest, queryFlag, resetDemoCache };
