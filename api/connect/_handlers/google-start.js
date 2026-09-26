// Google Workspace / Gmail: OAuth 2.0 Authorization Code mit Refresh-Token (access_type=offline).
// Projekt „HYBOTE Mail Connect", zunaechst im Testmodus (Testnutzer eintragen).
const { beginOAuth, baseUrl } = require('../_state.js');

const SCOPE = 'openid email https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send';

module.exports = async function handler(request, response) {
  return beginOAuth(request, response, 'google', ({ invite, state }) => {
    const clientId = process.env.GOOGLE_CONNECT_CLIENT_ID || '';
    if (!clientId || !process.env.GOOGLE_CONNECT_CLIENT_SECRET) return null;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', `${baseUrl()}/api/connect/google/callback`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('state', state);
    if (invite.email) url.searchParams.set('login_hint', invite.email);
    return url.toString();
  });
};
module.exports.SCOPE = SCOPE;
