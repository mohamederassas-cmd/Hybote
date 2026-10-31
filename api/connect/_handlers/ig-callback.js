// Instagram-Callback (31.10.2026): Code → Kurz-Token → Langzeit-Token (etwa 60 Tage, verlaengerbar) → Nachrichten-Abo
// (subscribed_apps) → Profil lesen → n8n-Credential (httpHeaderAuth) → Zeile in ig_tenants → zurueck zur Kundenseite.
// Der Token verlaesst n8n nie.
const { verifyInviteToken } = require('../../meta/_invite.js');
const { verifyState, parseCookies, safeEqual, redirectToPage, clientFingerprint, queryOf, baseUrl } = require('../_state.js');
const { configured, ensureCredential } = require('../_n8n.js');
const { connectInstagram, failInstagram } = require('../_igTenant.js');
const { SCOPE } = require('./ig-start.js');

const GRAPH = 'https://graph.instagram.com';

async function json(res, code = 'IG_TOKEN_FAILED') {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.error || payload.error_type) {
    const e = new Error(code);
    e.detail = String((payload.error && (payload.error.message || payload.error)) || payload.error_message || res.status).slice(0, 200);
    throw e;
  }
  return payload;
}

module.exports = async function handler(request, response) {
  const query = queryOf(request);
  const cookies = parseCookies(request.headers.cookie);
  const inviteToken = cookies.hybote_connect_invite || '';
  const fail = (error) => redirectToPage(response, inviteToken, { error });
  if (request.method !== 'GET') return fail('METHOD_NOT_ALLOWED');
  if (query.get('error')) return fail(query.get('error_reason') === 'user_denied' ? 'OAUTH_DENIED' : 'OAUTH_FAILED');
  const state = verifyState(query.get('state') || '');
  if (!state || state.ch !== 'instagram' || !safeEqual(state.n, cookies.hybote_connect_nonce)) return fail('STATE_INVALID');
  const invite = verifyInviteToken(inviteToken);
  if (!invite || invite.channel !== 'instagram' || invite.inviteId !== state.jti) return fail('STATE_INVALID');
  // Instagram haengt "#_" an den Code an.
  const code = String(query.get('code') || '').replace(/#_$/, '');
  if (code.length < 10) return fail('OAUTH_FAILED');
  if (!process.env.IG_APP_ID || !process.env.IG_APP_SECRET || !configured()) return fail('NOT_CONFIGURED');
  const fingerprint = clientFingerprint(request);
  try {
    const short = await json(await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ client_id: process.env.IG_APP_ID, client_secret: process.env.IG_APP_SECRET, grant_type: 'authorization_code', redirect_uri: `${baseUrl()}/api/connect/ig/callback`, code }).toString()
    }));
    const long = await json(await fetch(`${GRAPH}/access_token?${new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: process.env.IG_APP_SECRET, access_token: short.access_token })}`));
    // Ohne Abo schickt Meta keine DMs an den Webhook. Scheitert es, lieber Fehler (Kunde versucht es erneut) als still "verbunden".
    const subscription = await json(await fetch(`${GRAPH}/v24.0/me/subscribed_apps?${new URLSearchParams({ subscribed_fields: 'messages', access_token: long.access_token })}`, { method: 'POST', headers: { Accept: 'application/json' } }), 'IG_SUBSCRIBE_FAILED');
    if (subscription.success !== true) { const e = new Error('IG_SUBSCRIBE_FAILED'); e.detail = 'success!=true'; throw e; }
    const profile = await json(await fetch(`${GRAPH}/me?${new URLSearchParams({ fields: 'user_id,username,account_type', access_token: long.access_token })}`));
    const igUserId = String(profile.user_id || short.user_id || '');
    const username = String(profile.username || '');
    const expiresAt = long.expires_in ? new Date(Date.now() + Number(long.expires_in) * 1000) : null;
    const credential = await ensureCredential({
      type: 'httpHeaderAuth',
      name: `IG · ${String(invite.company || '').slice(0, 50)} · ${igUserId}`,
      data: { name: 'Authorization', value: `Bearer ${long.access_token}` }
    });
    await connectInstagram({ invite, igUserId, username, accountType: profile.account_type, credentialId: credential.id, scopes: Array.isArray(short.permissions) ? short.permissions.join(',') : SCOPE, expiresAt, fingerprint });
    return redirectToPage(response, inviteToken, { result: 'ok' });
  } catch (error) {
    await failInstagram({ invite, detail: `${error.message}:${error.detail || error.status || ''}`, fingerprint });
    return fail(error.message === 'N8N_API_ERROR' || error.message === 'IG_TABLE_MISSING' ? 'SERVER_ERROR' : 'OAUTH_FAILED');
  }
};
