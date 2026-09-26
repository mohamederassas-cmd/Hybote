// Anderer Anbieter: IMAP/SMTP mit App-Passwort. Verbindung wird serverseitig geprueft
// (imapflow + nodemailer), erst danach entstehen zwei n8n-Credentials (imap, smtp).
// Das Passwort wird nur durchgereicht, nie protokolliert.
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const { allowedOrigins, parseCookies, safeEqual, clientFingerprint, rateLimited, emailInvite, COOKIE_CSRF } = require('../_state.js');
const { configured, ensureCredential } = require('../_n8n.js');
const { connectMailbox, failMailbox, credentialName } = require('../_mailTenant.js');

const text = (v, max) => String(v ?? '').trim().slice(0, max);
const port = (v, fallback) => { const n = Number.parseInt(String(v), 10); return Number.isFinite(n) && n > 0 && n < 65536 ? n : fallback; };
const hostOk = (h) => /^[a-z0-9][a-z0-9.-]{2,252}$/i.test(h) && h.includes('.');

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Vary', 'Origin');
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' }); }
  if (!allowedOrigins().has(request.headers.origin || '')) return response.status(403).json({ ok: false, code: 'ORIGIN_NOT_ALLOWED' });
  const cookies = parseCookies(request.headers.cookie);
  if (!safeEqual(cookies[COOKIE_CSRF], request.headers['x-hybote-csrf'])) return response.status(403).json({ ok: false, code: 'CSRF_VALIDATION_FAILED' });
  const fingerprint = clientFingerprint(request);
  if (rateLimited(fingerprint + ':imap', 8)) return response.status(429).json({ ok: false, code: 'TOO_MANY_ATTEMPTS' });
  if (!configured()) return response.status(503).json({ ok: false, code: 'NOT_CONFIGURED' });

  let body;
  try { body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {}); } catch (_error) { return response.status(400).json({ ok: false, code: 'INVALID_JSON' }); }
  const { invite, error } = emailInvite(text(body.inviteToken, 2048), 'imap');
  if (error) return response.status(error === 'INVITE_INVALID' ? 401 : 400).json({ ok: false, code: error });

  const address = text(body.address, 254).toLowerCase();
  const user = text(body.user, 254) || address;
  const password = String(body.password || '').slice(0, 512);
  const imapHost = text(body.imapHost, 253).toLowerCase();
  const smtpHost = text(body.smtpHost, 253).toLowerCase();
  const imapSecure = body.imapSecure !== false;
  const smtpSecure = body.smtpSecure !== false;
  const imapPort = port(body.imapPort, imapSecure ? 993 : 143);
  const smtpPort = port(body.smtpPort, smtpSecure ? 465 : 587);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address) || !password || !hostOk(imapHost) || !hostOk(smtpHost) || body.authorityAccepted !== true || body.privacyAccepted !== true) {
    return response.status(400).json({ ok: false, code: 'INVALID_FORM' });
  }

  // 1. IMAP pruefen
  const client = new ImapFlow({ host: imapHost, port: imapPort, secure: imapSecure, auth: { user, pass: password }, logger: false, connectionTimeout: 12000, greetingTimeout: 12000 });
  try { await client.connect(); await client.logout(); } catch (e) {
    await failMailbox({ invite, provider: 'imap', detail: `imap:${String(e && e.message || e).slice(0, 120)}`, fingerprint });
    return response.status(409).json({ ok: false, code: 'IMAP_FAILED' });
  }
  // 2. SMTP pruefen
  try {
    const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpSecure, auth: { user, pass: password }, connectionTimeout: 12000, greetingTimeout: 12000 });
    await transporter.verify();
  } catch (e) {
    await failMailbox({ invite, provider: 'imap', detail: `smtp:${String(e && e.message || e).slice(0, 120)}`, fingerprint });
    return response.status(409).json({ ok: false, code: 'SMTP_FAILED' });
  }
  // 3. Credentials + Zeile
  try {
    const imapCred = await ensureCredential({ type: 'imap', name: credentialName('IMAP', invite, address), data: { user, password, host: imapHost, port: imapPort, secure: imapSecure, allowUnauthorizedCerts: false } });
    const smtpCred = await ensureCredential({ type: 'smtp', name: credentialName('SMTP', invite, address), data: { user, password, host: smtpHost, port: smtpPort, secure: smtpSecure, disableStartTls: false } });
    await connectMailbox({ invite, provider: 'imap', address, credentialId: imapCred.id, smtpCredentialId: smtpCred.id, scopes: `imap:${imapHost}:${imapPort};smtp:${smtpHost}:${smtpPort}`, expiresAt: null, fingerprint });
    return response.status(200).json({ ok: true, provider: 'imap', address });
  } catch (e) {
    await failMailbox({ invite, provider: 'imap', detail: `n8n:${e.status || ''}:${String(e.detail || e.message || '').slice(0, 120)}`, fingerprint });
    return response.status(502).json({ ok: false, code: 'SERVER_ERROR' });
  }
};
