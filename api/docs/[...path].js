// Online-Annahme von Angeboten (22.10.2026, Control Tower „Operations Pilot“ Phase 3).
//
// Der Tower ist nur im Tailnet erreichbar. Wie beim Embedded Signup gibt es keine direkte Verbindung:
//   Tower  → signiertes Token (DOC_ACCEPT_SECRET), PDFs + manifest.json im privaten Blob-Store
//            (DOCS_BLOB_TOKEN, Pfad angebote/<jti>/), Zeile in der n8n-Tabelle ops_documents (SENT)
//   hier   → Token pruefen, Zusammenfassung und PDFs ausliefern, VIEWED / ACCEPTED / DECLINED schreiben
//            (needs_sync='yes'); der Tower holt die Zeilen im 60-s-Takt ab und setzt 'no'.
//
// Eine Function fuer alle /api/docs/*-Pfade (Vercel-Hobby-Limit 12 Functions je Deployment).
//   GET  /api/docs/offer?d=<token>          Zusammenfassung, Status; erster Aufruf schreibt VIEWED
//   GET  /api/docs/file?d=<token>&i=<n>     PDF Nr. n (inline)
//   POST /api/docs/accept   { d, name, role, email, confirm }
//   POST /api/docs/decline  { d, reason }
const crypto = require('node:crypto');
const { get } = require('@vercel/blob');
const { n8nJson } = require('../connect/_n8n.js');

const OPEN = ['SENT', 'VIEWED'];

function b64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Gleiches Verfahren wie verifyAcceptToken() im Tower: base64url(JSON) + "." + base64url(HMAC-SHA256).
 *  Falsch signiert und abgelaufen sind bewusst nicht unterscheidbar. */
function verifyToken(token) {
  const secret = process.env.DOC_ACCEPT_SECRET || '';
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature || secret.length < 32) return null;
  const expected = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (data.v !== 1 || !/^[0-9a-f]{32}$/.test(String(data.jti || '')) || typeof data.exp !== 'number') return null;
    if (data.exp * 1000 < Date.now()) return null;
    return { jti: data.jti, number: String(data.num || ''), exp: data.exp };
  } catch (_error) {
    return null;
  }
}

function tableId() { return process.env.N8N_OPS_DOCS_TABLE_ID || ''; }
function configured() {
  return Boolean((process.env.DOC_ACCEPT_SECRET || '').length >= 32 && process.env.DOCS_BLOB_TOKEN && process.env.N8N_BASE_URL && process.env.N8N_API_KEY && tableId());
}

function rowFilter(jti, status) {
  const filters = [{ columnName: 'jti', condition: 'eq', value: jti }];
  if (status) filters.push({ columnName: 'status', condition: 'eq', value: status });
  return { type: 'and', filters };
}

async function readRow(jti) {
  const filter = encodeURIComponent(JSON.stringify(rowFilter(jti)));
  const payload = await n8nJson(`data-tables/${tableId()}/rows?filter=${filter}&limit=1`);
  const rows = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.data) ? payload.data : []);
  return rows[0] || null;
}

/** Nur aendern, wenn der Status noch der gelesene ist (kein Ueberschreiben einer parallelen Annahme). */
async function updateRow(jti, fromStatus, data) {
  await n8nJson(`data-tables/${tableId()}/rows/update`, {
    method: 'PATCH',
    body: JSON.stringify({ filter: rowFilter(jti, fromStatus), data, returnData: false, dryRun: false })
  });
}

async function readManifest(jti) {
  const result = await get(`angebote/${jti}/manifest.json`, { access: 'private', token: process.env.DOCS_BLOB_TOKEN, useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const text = await new Response(result.stream).text();
  return JSON.parse(text);
}

function json(response, status, body) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  return response.status(status).json(body);
}

function clientIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (forwarded || String(request.headers['x-real-ip'] || '')).slice(0, 64);
}

async function readBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') { try { return JSON.parse(request.body); } catch (_e) { return {}; } }
  return {};
}

function publicState(row) {
  const status = String(row && row.status || '');
  if (status === 'ACCEPTED') return { state: 'accepted', acceptedAt: row.accepted_at || null, acceptedName: row.accepted_name || null };
  if (status === 'DECLINED') return { state: 'declined', declinedAt: row.declined_at || null };
  if (OPEN.includes(status)) return { state: 'open' };
  return { state: 'unavailable' };
}

/** Prueft Token, Manifest und Tabellenzeile gemeinsam; liefert null bei jedem Fehler (neutrale Antwort). */
async function load(token) {
  const claims = verifyToken(token);
  if (!claims) return null;
  const [manifest, row] = await Promise.all([readManifest(claims.jti), readRow(claims.jti)]);
  if (!manifest || !row || manifest.jti !== claims.jti || (claims.number && manifest.number !== claims.number)) return null;
  return { claims, manifest, row };
}

async function offer(request, response) {
  const ctx = await load(request.query && request.query.d);
  if (!ctx) return json(response, 404, { ok: false, code: 'UNAVAILABLE' });
  const { manifest, row, claims } = ctx;
  if (row.status === 'SENT') {
    await updateRow(claims.jti, 'SENT', { status: 'VIEWED', viewed_at: new Date().toISOString(), needs_sync: 'yes' }).catch(() => null);
  }
  return json(response, 200, {
    ok: true,
    ...publicState(row.status === 'SENT' ? { status: 'VIEWED' } : row),
    number: manifest.number,
    company: manifest.company,
    language: manifest.language === 'de' ? 'de' : 'en',
    validUntil: manifest.valid_until || null,
    title: manifest.title || '',
    intro: manifest.intro || '',
    provider: manifest.provider || 'Hybote AI Systems LLC',
    items: Array.isArray(manifest.items) ? manifest.items : [],
    totals: manifest.totals || {},
    documents: (manifest.documents || []).map((d) => ({ i: d.i, kind: d.kind, title: d.title, bytes: d.bytes, sha256: d.sha256 }))
  });
}

async function file(request, response) {
  const ctx = await load(request.query && request.query.d);
  const index = Number(request.query && request.query.i);
  const doc = ctx && (ctx.manifest.documents || []).find((d) => d.i === index);
  if (!doc) return json(response, 404, { ok: false, code: 'UNAVAILABLE' });
  const result = await get(doc.url, { access: 'private', token: process.env.DOCS_BLOB_TOKEN });
  if (!result || result.statusCode !== 200) return json(response, 404, { ok: false, code: 'UNAVAILABLE' });
  const name = `${ctx.manifest.number} ${String(doc.title || 'Dokument').replace(/[^\p{L}\p{N} ._-]+/gu, '').slice(0, 80)}.pdf`;
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Disposition', `${request.query.download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`);
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  return response.status(200).send(buffer);
}

async function accept(request, response) {
  const body = await readBody(request);
  const ctx = await load(body.d);
  if (!ctx) return json(response, 404, { ok: false, code: 'UNAVAILABLE' });
  const { row, claims } = ctx;
  if (row.status === 'ACCEPTED') return json(response, 200, { ok: true, ...publicState(row) });
  if (!OPEN.includes(row.status)) return json(response, 409, { ok: false, code: 'NOT_OPEN', ...publicState(row) });
  const name = String(body.name || '').trim().slice(0, 120);
  const role = String(body.role || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
  if (name.length < 3 || role.length < 2) return json(response, 400, { ok: false, code: 'NAME_ROLE_REQUIRED' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(response, 400, { ok: false, code: 'EMAIL_INVALID' });
  if (body.confirm !== true) return json(response, 400, { ok: false, code: 'CONFIRM_REQUIRED' });
  const at = new Date().toISOString();
  await updateRow(claims.jti, row.status, {
    status: 'ACCEPTED', accepted_at: at, accepted_name: name, accepted_role: role, accepted_email: email,
    accepted_ip: clientIp(request), accepted_ua: String(request.headers['user-agent'] || '').slice(0, 300),
    viewed_at: row.viewed_at || at, needs_sync: 'yes'
  });
  const check = await readRow(claims.jti);
  if (!check || check.status !== 'ACCEPTED') return json(response, 409, { ok: false, code: 'CONFLICT', ...publicState(check) });
  return json(response, 200, { ok: true, ...publicState(check) });
}

async function decline(request, response) {
  const body = await readBody(request);
  const ctx = await load(body.d);
  if (!ctx) return json(response, 404, { ok: false, code: 'UNAVAILABLE' });
  const { row, claims } = ctx;
  if (row.status === 'DECLINED') return json(response, 200, { ok: true, ...publicState(row) });
  if (!OPEN.includes(row.status)) return json(response, 409, { ok: false, code: 'NOT_OPEN', ...publicState(row) });
  await updateRow(claims.jti, row.status, {
    status: 'DECLINED', declined_at: new Date().toISOString(), decline_reason: String(body.reason || '').trim().slice(0, 500), needs_sync: 'yes'
  });
  const check = await readRow(claims.jti);
  return json(response, 200, { ok: true, ...publicState(check) });
}

const routes = {
  'GET offer': offer,
  'GET file': file,
  'POST accept': accept,
  'POST decline': decline
};

module.exports = async function handler(request, response) {
  const url = new URL(request.url || '/', 'https://hybote.ai');
  let path = url.pathname.replace(/^\/api\/docs\/?/, '').replace(/\/+$/, '');
  if (!path && request.query && request.query.path) path = [].concat(request.query.path).join('/');
  const route = routes[`${request.method} ${path}`];
  if (!route) return json(response, 404, { ok: false, code: 'NOT_FOUND' });
  if (!configured()) return json(response, 503, { ok: false, code: 'NOT_CONFIGURED' });
  try {
    return await route(request, response);
  } catch (error) {
    console.error('[docs]', path, error && error.message);
    return json(response, 502, { ok: false, code: 'UPSTREAM' });
  }
};
