// Google-Callback: Code tauschen, E-Mail aus userinfo, n8n-Credential (gmailOAuth2), mail_tenants.
const { resumeOAuth, redirectToPage, clientFingerprint, baseUrl } = require('../_state.js');
const { configured, ensureCredential } = require('../_n8n.js');
const { connectMailbox, failMailbox, credentialName } = require('../_mailTenant.js');
const { SCOPE } = require('./google-start.js');

module.exports = async function handler(request, response) {
  const ctx = resumeOAuth(request, response, 'google');
  if (!ctx) return;
  const { invite, inviteToken, code } = ctx;
  const fingerprint = clientFingerprint(request);
  const clientId = process.env.GOOGLE_CONNECT_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CONNECT_CLIENT_SECRET || '';
  if (!clientId || !clientSecret || !configured()) return redirectToPage(response, inviteToken, { error: 'NOT_CONFIGURED' });
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: `${baseUrl()}/api/connect/google/callback` }).toString()
    });
    const token = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error('TOKEN_EXCHANGE_FAILED'), { detail: String(token.error_description || token.error || res.status).slice(0, 200) });
    if (!token.refresh_token) throw Object.assign(new Error('NO_REFRESH_TOKEN'), { detail: 'prompt=consent erforderlich' });
    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
    const info = await infoRes.json().catch(() => ({}));
    const address = String(info.email || '').toLowerCase();
    if (!address.includes('@')) throw Object.assign(new Error('NO_MAILBOX'), { detail: 'userinfo ohne E-Mail' });
    const credential = await ensureCredential({
      type: 'gmailOAuth2',
      name: credentialName('MAIL', invite, address),
      data: {
        clientId, clientSecret, sendAdditionalBodyProperties: false, additionalBodyProperties: '',
        oauthTokenData: { access_token: token.access_token, refresh_token: token.refresh_token, expires_in: token.expires_in, token_type: token.token_type, scope: token.scope, id_token: token.id_token }
      }
    });
    await connectMailbox({ invite, provider: 'google', address, credentialId: credential.id, scopes: token.scope || SCOPE, expiresAt: null, fingerprint });
    return redirectToPage(response, inviteToken, { result: 'ok' });
  } catch (error) {
    await failMailbox({ invite, provider: 'google', detail: `${error.message}:${error.detail || error.status || ''}`, fingerprint });
    return redirectToPage(response, inviteToken, { error: error.message === 'N8N_API_ERROR' ? 'SERVER_ERROR' : 'OAUTH_FAILED' });
  }
};
