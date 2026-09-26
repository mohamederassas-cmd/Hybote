// CSRF-Cookie fuer den IMAP-Weg (POST aus dem Browser). Die OAuth-Wege brauchen es nicht,
// sie sind ueber State + Nonce-Cookie gebunden.
const crypto = require('node:crypto');
const { allowedOrigins, cookie, COOKIE_CSRF } = require('../_state.js');

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Vary', 'Origin');
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' }); }
  if (!allowedOrigins().has(request.headers.origin || '')) return response.status(403).json({ ok: false, code: 'ORIGIN_NOT_ALLOWED' });
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  response.setHeader('Set-Cookie', [cookie(COOKIE_CSRF, csrfToken, 900, 'Strict')]);
  return response.status(200).json({ ok: true, csrfToken, expiresIn: 900 });
};
