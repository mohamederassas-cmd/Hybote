// Instagram-Anbindung (Vorbereitung 26.09.2026). Bis Meta die Instagram-Rechte fuer HYBOTE freigibt,
// bleibt INSTAGRAM_SIGNUP_ENABLED leer und dieser Endpunkt antwortet 503. Danach hier umsetzen:
// Code-Tausch (Facebook Login for Business mit eigener config_id fuer Instagram bzw. Instagram Login
// for Business), Scopes je Variante: instagram_basic, instagram_manage_messages, pages_show_list,
// pages_manage_metadata  ODER  instagram_business_basic, instagram_business_manage_messages;
// Ergebnis: ig_account_id, page_id, username -> n8n-Credential + Tabelle ig_tenants.
module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' }); }
  if (process.env.INSTAGRAM_SIGNUP_ENABLED !== '1') return response.status(503).json({ ok: false, code: 'INSTAGRAM_NOT_ENABLED' });
  return response.status(501).json({ ok: false, code: 'INSTAGRAM_NOT_IMPLEMENTED' });
};
