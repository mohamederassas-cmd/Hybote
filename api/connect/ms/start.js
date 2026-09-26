// Microsoft 365 / Outlook: Authorization-Code-Flow gegen die mandantenfaehige Entra-App
// „HYBOTE Mail Connect" (Authority common). Delegierte Rechte nur fuer Mail.
const { beginOAuth, baseUrl } = require('../_state.js');

const SCOPE = 'openid email offline_access User.Read Mail.ReadWrite Mail.Send';

module.exports = async function handler(request, response) {
  return beginOAuth(request, response, 'microsoft', ({ invite, state }) => {
    const clientId = process.env.MS_CONNECT_CLIENT_ID || '';
    if (!clientId || !process.env.MS_CONNECT_CLIENT_SECRET) return null;
    const tenant = process.env.MS_CONNECT_TENANT || 'common';
    const url = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', `${baseUrl()}/api/connect/ms/callback`);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    if (invite.email) url.searchParams.set('login_hint', invite.email);
    return url.toString();
  });
};
module.exports.SCOPE = SCOPE;
