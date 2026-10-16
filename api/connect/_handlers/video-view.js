// Video-Aufruf von hybote.ai/v/<code> (16.10.2026, Erstmail mit Video im Sales Pilot).
// Die Seite meldet sich erst nach Play und mindestens 5 Sekunden Wiedergabe. Dieser Handler schreibt eine Zeile in die
// n8n-Tabelle video_views (Muster mail_tenants in ../_n8n.js); der Sales Pilot holt sie ab (videoViews.ts) und legt
// „Video angesehen – heute anrufen“ an. Antwortet immer still mit 204, damit die Seite nie hängt oder Fehler zeigt.
const N8N_TIMEOUT_MS = 8000;
const CODE = /^[a-z2-9]{8}$/;
const EVENT_ID = /^[A-Za-z0-9-]{8,80}$/;
// Link-Scanner und Vorschau-Bots (Safelinks, Mimecast, Headless-Browser) starten kein Video, falls doch: nicht zählen.
const BOT_UA = /bot|crawler|spider|safelinks|headlesschrome|preview|scanner|proofpoint|mimecast|barracuda|curl\/|wget|python|axios|okhttp|go-http-client|apache-httpclient/i;

function config() {
  return {
    baseUrl: (process.env.N8N_BASE_URL || '').replace(/\/$/, ''),
    apiKey: process.env.N8N_API_KEY || '',
    tableId: process.env.N8N_VIDEO_VIEWS_TABLE_ID || ''
  };
}

async function upsertView(row) {
  const c = config();
  if (!c.baseUrl || !c.apiKey || !c.tableId) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);
  try {
    const result = await fetch(`${c.baseUrl}/api/v1/data-tables/${c.tableId}/rows/upsert`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'X-N8N-API-KEY': c.apiKey, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: { type: 'and', filters: [{ columnName: 'event_id', condition: 'eq', value: row.event_id }] },
        data: row
      })
    });
    return result.ok;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' }); }
  let body;
  try { body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {}); } catch (_error) { return response.status(400).json({ ok: false, code: 'INVALID_JSON' }); }
  const code = String(body.code || '').trim().toLowerCase();
  const eventId = String(body.event_id || '').trim();
  if (!CODE.test(code) || !EVENT_ID.test(eventId)) return response.status(400).json({ ok: false, code: 'INVALID_INPUT' });
  const userAgent = String(request.headers['user-agent'] || '').slice(0, 300);
  const watched = Math.max(0, Math.min(3600, Math.round(Number(body.watched_s) || 0)));
  if (BOT_UA.test(userAgent) || watched < 5) return response.status(204).end();
  try {
    await upsertView({
      event_id: eventId, code, event: 'play5', watched_seconds: watched,
      lang: body.lang === 'de' ? 'de' : 'en', user_agent: userAgent,
      occurred_at: new Date().toISOString(), synced: false
    });
  } catch (_error) { /* Messung ist optional, die Seite merkt davon nichts */ }
  return response.status(204).end();
};
