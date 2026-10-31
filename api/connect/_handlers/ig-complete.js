// Alter Instagram-Endpunkt (26.09.2026, Facebook-Konfigurationsweg). Seit 31.10.2026 laeuft die Anmeldung ueber
// /api/connect/ig/start (Business Login for Instagram); dieser Pfad bleibt nur, damit alte Seiten eine klare Antwort bekommen.
module.exports = async function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  return response.status(410).json({ ok: false, code: 'INSTAGRAM_USE_LOGIN' });
};
