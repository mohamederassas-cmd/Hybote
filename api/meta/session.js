const crypto = require('node:crypto');

const DEFAULT_ORIGINS = ['https://hybote.ai', 'https://www.hybote.ai'];

function allowedOrigins() {
  return new Set([
    ...DEFAULT_ORIGINS,
    ...(process.env.META_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)
  ]);
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Vary', 'Origin');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const origin = request.headers.origin || '';
  if (!allowedOrigins().has(origin)) {
    return response.status(403).json({ ok: false, code: 'ORIGIN_NOT_ALLOWED' });
  }

  const csrfToken = crypto.randomBytes(32).toString('base64url');
  response.setHeader('Set-Cookie', [
    `hybote_meta_csrf=${csrfToken}; Max-Age=900; Path=/api/meta; HttpOnly; Secure; SameSite=Strict`
  ]);
  return response.status(200).json({ ok: true, csrfToken, expiresIn: 900 });
};
