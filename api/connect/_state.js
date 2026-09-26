// Gemeinsame Helfer fuer hybote.ai/api/connect/*: OAuth-State, Cookies, Origin, Rate-Limit, Redirects.
//
// State = signierter Kurz-Token { jti, ch, pv, n, exp } (gleiches Verfahren wie _invite.js), Geheimnis
// CONNECT_STATE_SECRET oder META_INVITE_SECRET. Die Bindung an den Browser laeuft ueber zwei Cookies
// (Nonce + Einladungs-Token) mit SameSite=Lax: der Callback ist ein Cross-Site-Top-Level-Redirect von
// Microsoft/Google, Strict-Cookies kaemen dort nicht mit.
const crypto = require('node:crypto');
const { verifyInviteToken, normalizeProviders } = require('../meta/_invite.js');

const DEFAULT_ORIGINS = ['https://hybote.ai', 'https://www.hybote.ai'];
const COOKIE_NONCE = 'hybote_connect_nonce';
const COOKIE_INVITE = 'hybote_connect_invite';
const COOKIE_CSRF = 'hybote_connect_csrf';
const STATE_TTL_SECONDS = 600;

function b64url(buffer) { return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function fromB64url(value) { return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); }
function secret() { return process.env.CONNECT_STATE_SECRET || process.env.META_INVITE_SECRET || ''; }
function baseUrl() { return (process.env.CONNECT_BASE_URL || 'https://hybote.ai').replace(/\/$/, ''); }

function allowedOrigins() {
  return new Set([...DEFAULT_ORIGINS, ...(process.env.META_ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean)]);
}

function signState(payload) {
  if (secret().length < 32) throw new Error('STATE_SECRET_MISSING');
  const body = b64url(Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS })));
  return `${body}.${b64url(crypto.createHmac('sha256', secret()).update(body).digest())}`;
}

function verifyState(token) {
  if (!token || secret().length < 32) return null;
  const [body, signature] = String(token).split('.');
  if (!body || !signature) return null;
  const expected = b64url(crypto.createHmac('sha256', secret()).update(body).digest());
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(fromB64url(body));
    if (typeof data.exp !== 'number' || data.exp * 1000 < Date.now()) return null;
    return data;
  } catch (_error) { return null; }
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookie(name, value, maxAge, sameSite = 'Lax') {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/api/connect; HttpOnly; Secure; SameSite=${sameSite}`;
}
function clearCookies() {
  return [cookie(COOKIE_NONCE, '', 0), cookie(COOKIE_INVITE, '', 0)];
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')); const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

function clientFingerprint(request) {
  const ip = String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(ip + '|' + (process.env.META_INVITE_SECRET || '')).digest('hex').slice(0, 24);
}

// Einfaches In-Memory-Limit je Function-Instanz: 12 Versuche in 15 Minuten.
const attempts = new Map();
function rateLimited(key, max = 12, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  attempts.set(key, list);
  if (attempts.size > 5000) attempts.clear();
  return list.length > max;
}

function queryOf(request) {
  return new URL(request.url || '/', baseUrl()).searchParams;
}

/** Einladung aus dem Link pruefen: Kanal E-Mail und Anbieter freigegeben. */
function emailInvite(token, provider) {
  const invite = verifyInviteToken(token);
  if (!invite) return { error: 'INVITE_INVALID' };
  if (invite.channel !== 'email') return { error: 'INVITE_CHANNEL_MISMATCH' };
  if (provider && !normalizeProviders(invite.providers).includes(provider)) return { error: 'PROVIDER_NOT_ALLOWED' };
  return { invite };
}

/** Zurueck auf die Kundenseite; Ergebnis nur als Code, Details holt die Seite ueber /api/connect/status. */
function redirectToPage(response, inviteToken, params, extraCookies = []) {
  const url = new URL('/connect.html', baseUrl());
  if (inviteToken) url.searchParams.set('invite', inviteToken);
  for (const [key, value] of Object.entries(params || {})) if (value) url.searchParams.set(key, value);
  response.setHeader('Set-Cookie', [...clearCookies(), ...extraCookies]);
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.statusCode = 302;
  response.setHeader('Location', url.toString());
  response.end();
}

/** Start eines OAuth-Flows: Einladung pruefen, State + Cookies setzen, zum Anbieter weiterleiten. */
function beginOAuth(request, response, provider, buildAuthorizeUrl) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' }); }
  const inviteToken = queryOf(request).get('invite') || '';
  const { invite, error } = emailInvite(inviteToken, provider);
  if (error) return redirectToPage(response, inviteToken, { error });
  if (rateLimited(clientFingerprint(request) + ':' + provider)) return redirectToPage(response, inviteToken, { error: 'TOO_MANY_ATTEMPTS' });
  let authorizeUrl;
  try {
    const nonce = crypto.randomBytes(16).toString('base64url');
    const state = signState({ jti: invite.inviteId, ch: 'email', pv: provider, n: nonce });
    authorizeUrl = buildAuthorizeUrl({ invite, state });
    if (!authorizeUrl) return redirectToPage(response, inviteToken, { error: 'NOT_CONFIGURED' });
    response.setHeader('Set-Cookie', [cookie(COOKIE_NONCE, nonce, STATE_TTL_SECONDS), cookie(COOKIE_INVITE, inviteToken, STATE_TTL_SECONDS)]);
  } catch (_error) {
    return redirectToPage(response, inviteToken, { error: 'NOT_CONFIGURED' });
  }
  response.statusCode = 302;
  response.setHeader('Location', authorizeUrl);
  response.end();
}

/** Callback eines OAuth-Flows: State, Nonce-Cookie und Einladungs-Cookie muessen zusammenpassen. */
function resumeOAuth(request, response, provider) {
  const query = queryOf(request);
  const cookies = parseCookies(request.headers.cookie);
  const inviteToken = cookies[COOKIE_INVITE] || '';
  const fail = (error) => { redirectToPage(response, inviteToken, { error }); return null; };
  if (request.method !== 'GET') return fail('METHOD_NOT_ALLOWED');
  if (query.get('error')) return fail(query.get('error') === 'access_denied' ? 'OAUTH_DENIED' : 'OAUTH_FAILED');
  const state = verifyState(query.get('state') || '');
  if (!state || state.pv !== provider || state.ch !== 'email') return fail('STATE_INVALID');
  if (!safeEqual(state.n, cookies[COOKIE_NONCE])) return fail('STATE_INVALID');
  const { invite, error } = emailInvite(inviteToken, provider);
  if (error) return fail(error);
  if (invite.inviteId !== state.jti) return fail('STATE_INVALID');
  const code = query.get('code') || '';
  if (code.length < 10) return fail('OAUTH_FAILED');
  return { invite, inviteToken, code };
}

module.exports = {
  COOKIE_CSRF, allowedOrigins, signState, verifyState, parseCookies, cookie, clearCookies, safeEqual,
  clientFingerprint, rateLimited, queryOf, emailInvite, redirectToPage, beginOAuth, resumeOAuth, baseUrl
};
