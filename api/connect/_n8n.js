// n8n Public API fuer die Postfach-Anbindung der Kunden (hybote.ai/api/connect/*).
// Bewusst eine Kopie der Helfer aus api/meta/complete.js: die WhatsApp-Datei bleibt unangetastet.
// Der Kunden-Token landet ausschliesslich als verschluesselte n8n-Credential; die Tabelle
// mail_tenants traegt nur Zuordnung und Status. Der Sales Pilot spiegelt sie per Sync.
const N8N_TIMEOUT_MS = 15000;

function config() {
  return {
    baseUrl: (process.env.N8N_BASE_URL || '').replace(/\/$/, ''),
    apiKey: process.env.N8N_API_KEY || '',
    projectId: process.env.N8N_PROJECT_ID || '',
    mailTableId: process.env.N8N_MAIL_TENANT_TABLE_ID || '',
    logTableId: process.env.N8N_ONBOARDING_LOG_TABLE_ID || ''
  };
}

function configured() {
  const c = config();
  return Boolean(c.baseUrl && c.apiKey && c.projectId && c.mailTableId);
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: controller.signal }); } finally { clearTimeout(timer); }
}

async function n8nJson(path, options = {}) {
  const c = config();
  const apiResponse = await fetchWithTimeout(`${c.baseUrl}/api/v1/${path}`, {
    ...options,
    headers: {
      'X-N8N-API-KEY': c.apiKey,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await apiResponse.json().catch(() => ({}));
  if (!apiResponse.ok) {
    const error = new Error('N8N_API_ERROR');
    error.status = apiResponse.status;
    error.detail = payload && payload.message ? String(payload.message).slice(0, 200) : '';
    throw error;
  }
  return payload;
}

function credentialList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

/** Credential anlegen oder aktualisieren (Name + Typ als Schluessel). PATCH ist in der Public API
 *  nicht offiziell dokumentiert, wird aber von complete.js produktiv genutzt; faellt es aus,
 *  wird die alte Credential geloescht und neu angelegt (neue ID landet in mail_tenants). */
async function ensureCredential({ type, name, data }) {
  const c = config();
  const existingPayload = await n8nJson('credentials?limit=250');
  const existing = credentialList(existingPayload).find((credential) => credential.name === name && credential.type === type);
  const credentialData = { name, type, data, isResolvable: false };
  if (existing && existing.id) {
    try {
      return await n8nJson(`credentials/${existing.id}`, { method: 'PATCH', body: JSON.stringify(credentialData) });
    } catch (_error) {
      await n8nJson(`credentials/${existing.id}`, { method: 'DELETE' }).catch(() => null);
    }
  }
  return n8nJson('credentials', { method: 'POST', body: JSON.stringify({ ...credentialData, projectId: c.projectId }) });
}

/** Eine Zeile je Mandant (tenant_key), das Zweitpostfach ist eine spaetere Erweiterung. */
async function upsertMailTenant(row) {
  const c = config();
  return n8nJson(`data-tables/${c.mailTableId}/rows/upsert`, {
    method: 'POST',
    body: JSON.stringify({
      filter: { type: 'and', filters: [{ columnName: 'tenant_key', condition: 'eq', value: row.tenant_key }] },
      data: row,
      returnData: true,
      dryRun: false
    })
  });
}

async function getMailTenant(tenantKey) {
  const c = config();
  const filter = encodeURIComponent(JSON.stringify({ type: 'and', filters: [{ columnName: 'tenant_key', condition: 'eq', value: tenantKey }] }));
  const payload = await n8nJson(`data-tables/${c.mailTableId}/rows?filter=${filter}&limit=1`);
  return credentialList(payload)[0] || null;
}

/** Jeder Versuch hinterlaesst eine Spur in wa_onboarding_log (outcome MAIL_OK / MAIL_FAILED);
 *  der Sales Pilot ordnet sie ueber invite_id dem Mandanten zu. Nicht fatal. */
async function writeAuditRow(row) {
  const c = config();
  if (!c.logTableId) return;
  try {
    await n8nJson(`data-tables/${c.logTableId}/rows/upsert`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { type: 'and', filters: [{ columnName: 'event_id', condition: 'eq', value: row.event_id }] },
        data: row,
        returnData: false,
        dryRun: false
      })
    });
  } catch (_error) {
    // bewusst geschluckt
  }
}

module.exports = { config, configured, n8nJson, ensureCredential, upsertMailTenant, getMailTenant, writeAuditRow };
