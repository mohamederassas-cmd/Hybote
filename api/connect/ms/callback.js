// Microsoft-Callback: Code tauschen, Postfachadresse lesen, n8n-Credential (microsoftOutlookOAuth2Api)
// anlegen, mail_tenants schreiben, zurueck zur Kundenseite. clientId/clientSecret gehoeren in die
// Credential, weil n8n den Refresh mit genau diesen Werten ausfuehrt; customScopes = nur unsere Rechte.
const { resumeOAuth, redirectToPage, clientFingerprint, baseUrl } = require('../_state.js');
const { configured, ensureCredential } = require('../_n8n.js');
const { connectMailbox, failMailbox, credentialName } = require('../_mailTenant.js');
const { SCOPE } = require('./start.js');

async function postForm(url, params) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(params).toString() });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error('TOKEN_EXCHANGE_FAILED'); e.detail = String(payload.error_description || payload.error || res.status).slice(0, 200); throw e; }
  return payload;
}

module.exports = async function handler(request, response) {
  const ctx = resumeOAuth(request, response, 'microsoft');
  if (!ctx) return;
  const { invite, inviteToken, code } = ctx;
  const fingerprint = clientFingerprint(request);
  const clientId = process.env.MS_CONNECT_CLIENT_ID || '';
  const clientSecret = process.env.MS_CONNECT_CLIENT_SECRET || '';
  const tenant = process.env.MS_CONNECT_TENANT || 'common';
  if (!clientId || !clientSecret || !configured()) return redirectToPage(response, inviteToken, { error: 'NOT_CONFIGURED' });
  try {
    const token = await postForm(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code',
      redirect_uri: `${baseUrl()}/api/connect/ms/callback`, scope: SCOPE
    });
    if (!token.refresh_token) throw Object.assign(new Error('NO_REFRESH_TOKEN'), { detail: 'offline_access fehlt' });
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName', { headers: { Authorization: `Bearer ${token.access_token}` } });
    const me = await meRes.json().catch(() => ({}));
    const address = String(me.mail || me.userPrincipalName || '').toLowerCase();
    if (!address.includes('@')) throw Object.assign(new Error('NO_MAILBOX'), { detail: 'Kein Postfach am Konto' });
    const credential = await ensureCredential({
      type: 'microsoftOutlookOAuth2Api',
      name: credentialName('MAIL', invite, address),
      data: {
        clientId, clientSecret, clientCredentialType: 'clientSecret',
        customScopes: true, enabledScopes: SCOPE, useShared: false,
        oauthTokenData: { access_token: token.access_token, refresh_token: token.refresh_token, expires_in: token.expires_in, ext_expires_in: token.ext_expires_in, token_type: token.token_type, scope: token.scope }
      }
    });
    await connectMailbox({ invite, provider: 'microsoft', address, credentialId: credential.id, scopes: token.scope || SCOPE, expiresAt: null, fingerprint });
    return redirectToPage(response, inviteToken, { result: 'ok' });
  } catch (error) {
    await failMailbox({ invite, provider: 'microsoft', detail: `${error.message}:${error.detail || error.status || ''}`, fingerprint });
    return redirectToPage(response, inviteToken, { error: error.message === 'N8N_API_ERROR' ? 'SERVER_ERROR' : 'OAUTH_FAILED' });
  }
};
