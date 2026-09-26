// Eine einzige Serverless Function fuer alle /api/connect/*-Pfade (Vercel-Hobby-Limit: 12 Functions
// je Deployment). Die eigentlichen Handler liegen in _handlers/ (Unterstrich = kein eigener Endpunkt).
const routes = {
  'invite': require('./_handlers/invite.js'),
  'session': require('./_handlers/session.js'),
  'status': require('./_handlers/status.js'),
  'ms/start': require('./_handlers/ms-start.js'),
  'ms/callback': require('./_handlers/ms-callback.js'),
  'google/start': require('./_handlers/google-start.js'),
  'google/callback': require('./_handlers/google-callback.js'),
  'imap/verify': require('./_handlers/imap-verify.js'),
  'ig/complete': require('./_handlers/ig-complete.js')
};

module.exports = async function handler(request, response) {
  const url = new URL(request.url || '/', 'https://hybote.ai');
  let path = url.pathname.replace(/^\/api\/connect\/?/, '').replace(/\/+$/, '');
  if (!path && request.query && request.query.path) path = [].concat(request.query.path).join('/');
  const route = routes[path];
  if (!route) {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    return response.status(404).json({ ok: false, code: 'NOT_FOUND' });
  }
  return route(request, response);
};
