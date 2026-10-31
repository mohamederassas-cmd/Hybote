// Instagram: Business Login for Instagram (31.10.2026). Kein Facebook-Konto noetig; der Kunde meldet sich mit
// seinem Instagram-Profi-Konto an. Eigene Konten und Tester gehen sofort (Standard Access), fremde Kunden erst
// nach dem App Review fuer instagram_business_manage_messages. Gleiche State-/Cookie-Bindung wie Microsoft/Google.
const crypto = require('node:crypto');
const { verifyInviteToken } = require('../../meta/_invite.js');
const { signState, cookie, redirectToPage, clientFingerprint, rateLimited, queryOf, baseUrl } = require('../_state.js');

const SCOPE = 'instagram_business_basic,instagram_business_manage_messages';
const STATE_TTL_SECONDS = 600;

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' }); }
  const inviteToken = queryOf(request).get('invite') || '';
  const invite = verifyInviteToken(inviteToken);
  if (!invite) return redirectToPage(response, inviteToken, { error: 'INVITE_INVALID' });
  if (invite.channel !== 'instagram') return redirectToPage(response, inviteToken, { error: 'INVITE_CHANNEL_MISMATCH' });
  if (process.env.INSTAGRAM_SIGNUP_ENABLED !== '1' || !process.env.IG_APP_ID || !process.env.IG_APP_SECRET) return redirectToPage(response, inviteToken, { error: 'INSTAGRAM_NOT_ENABLED' });
  if (rateLimited(clientFingerprint(request) + ':instagram')) return redirectToPage(response, inviteToken, { error: 'TOO_MANY_ATTEMPTS' });
  let authorizeUrl;
  try {
    const nonce = crypto.randomBytes(16).toString('base64url');
    const state = signState({ jti: invite.inviteId, ch: 'instagram', pv: 'instagram', n: nonce });
    const url = new URL('https://www.instagram.com/oauth/authorize');
    url.searchParams.set('client_id', process.env.IG_APP_ID);
    url.searchParams.set('redirect_uri', `${baseUrl()}/api/connect/ig/callback`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('state', state);
    url.searchParams.set('enable_fb_login', '0');
    url.searchParams.set('force_reauth', 'true');
    authorizeUrl = url.toString();
    response.setHeader('Set-Cookie', [cookie('hybote_connect_nonce', nonce, STATE_TTL_SECONDS), cookie('hybote_connect_invite', inviteToken, STATE_TTL_SECONDS)]);
  } catch (_error) {
    return redirectToPage(response, inviteToken, { error: 'NOT_CONFIGURED' });
  }
  response.statusCode = 302;
  response.setHeader('Location', authorizeUrl);
  response.end();
};
module.exports.SCOPE = SCOPE;
