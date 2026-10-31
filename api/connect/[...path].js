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
  // Server aus der Postfach-Domain ableiten (31.10.2026), einteilig, damit kein Rewrite noetig ist.
  'mail-detect': require('./_handlers/mail-detect.js'),
  // Instagram (31.10.2026): Business Login for Instagram statt Facebook-Konfiguration; ig/complete bleibt als 410.
  'ig/start': require('./_handlers/ig-start.js'),
  'ig/callback': require('./_handlers/ig-callback.js'),
  'ig/complete': require('./_handlers/ig-complete.js'),
  // Video-Aufrufe aus den Erstmails des Sales Pilot (16.10.2026), Seite /v/<code>.
  'video-view': require('./_handlers/video-view.js')
};

module.exports = async function handler(request, response) {
  const url = new URL(request.url || '/', 'https://hybote.ai');
  let path = url.pathname.replace(/^\/api\/connect\/?/, '').replace(/\/+$/, '');
  // Zweiteilige Pfade (ms/start, google/callback, ig/start …) kommen per Rewrite aus vercel.json als
  // /api/connect/route?__connect=a/b an (31.10.2026: Vercel leitete nur einteilige Pfade an diese Datei, alles
  // andere war 404). Je nach Laufzeit steht in request.url der Original- oder der Zielpfad; beides geht.
  const forced = url.searchParams.get('__connect') || (request.query && request.query.__connect ? [].concat(request.query.__connect)[0] : '');
  if (forced && (!routes[path] || path === 'route')) path = String(forced).replace(/^\/+|\/+$/g, '');
  if (!path && request.query && request.query.path) path = [].concat(request.query.path).join('/');
  const route = routes[path];
  if (!route) {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    return response.status(404).json({ ok: false, code: 'NOT_FOUND' });
  }
  return route(request, response);
};
