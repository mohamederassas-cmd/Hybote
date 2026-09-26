// Loest einen Einladungslink fuer connect.html auf (Instagram + E-Mail). Read-only, same-origin GET,
// gibt nur zurueck, was signiert im Link steht, plus Feature-Flags fuer die Seite.
const { verifyInviteToken } = require('../../meta/_invite.js');
const { configured } = require('../_n8n.js');

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' }); }
  const url = new URL(request.url || '/', 'https://hybote.ai');
  const invite = verifyInviteToken(url.searchParams.get('token') || '');
  if (!invite) return response.status(401).json({ ok: false, code: 'INVITE_INVALID' });
  return response.status(200).json({
    ok: true,
    invite: { company: invite.company, email: invite.email, tenantKey: invite.tenantKey, language: invite.language, channel: invite.channel, providers: invite.providers, expiresAt: invite.expiresAt },
    flags: {
      instagramEnabled: process.env.INSTAGRAM_SIGNUP_ENABLED === '1',
      mailConfigured: configured(),
      microsoft: Boolean(process.env.MS_CONNECT_CLIENT_ID && process.env.MS_CONNECT_CLIENT_SECRET),
      google: Boolean(process.env.GOOGLE_CONNECT_CLIENT_ID && process.env.GOOGLE_CONNECT_CLIENT_SECRET)
    }
  });
};
