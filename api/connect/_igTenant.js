// Instagram-Anbindung (31.10.2026, Plan „warm-shamir“ Paket I): Business Login for Instagram braucht kein
// Facebook-Konto. Ergebnis je Mandant eine Zeile in der n8n-Tabelle ig_tenants (Zuordnung + Status); der
// Langzeit-Token liegt nur als n8n-Credential (httpQueryAuth, Parameter access_token). Die Tabellen-ID kommt
// aus N8N_IG_TENANT_TABLE_ID oder wird per Name gesucht (der Control Tower legt die Tabelle an).
const crypto = require('node:crypto');
const { n8nJson, writeAuditRow } = require('./_n8n.js');

let cachedTableId = '';
async function igTableId() {
  if (process.env.N8N_IG_TENANT_TABLE_ID) return process.env.N8N_IG_TENANT_TABLE_ID;
  if (cachedTableId) return cachedTableId;
  const payload = await n8nJson(`data-tables?limit=100&filter=${encodeURIComponent(JSON.stringify({ name: 'ig_tenants' }))}`);
  const list = Array.isArray(payload) ? payload : Array.isArray(payload && payload.data) ? payload.data : [];
  const hit = list.find((t) => t && t.name === 'ig_tenants');
  if (!hit || !hit.id) { const e = new Error('IG_TABLE_MISSING'); e.detail = 'n8n-Tabelle ig_tenants fehlt (im Control Tower anlegen)'; throw e; }
  cachedTableId = String(hit.id);
  return cachedTableId;
}

async function connectInstagram({ invite, igUserId, username, accountType, credentialId, scopes, expiresAt, fingerprint }) {
  const now = new Date().toISOString();
  const tableId = await igTableId();
  await n8nJson(`data-tables/${tableId}/rows/upsert`, {
    method: 'POST',
    body: JSON.stringify({
      filter: { type: 'and', filters: [{ columnName: 'tenant_key', condition: 'eq', value: invite.tenantKey }] },
      data: {
        tenant_key: invite.tenantKey, company_name: invite.company, ig_user_id: String(igUserId || ''), username: String(username || ''),
        account_type: String(accountType || ''), credential_id: String(credentialId || ''), status: 'connected', connected_at: now,
        token_expires_at: expiresAt ? new Date(expiresAt).toISOString() : '', scopes: String(scopes || ''), invite_id: invite.inviteId, updated_at: now
      },
      returnData: true,
      dryRun: false
    })
  });
  await writeAuditRow({
    event_id: crypto.randomUUID(), at: now, ip_hash: fingerprint || '', invite_id: invite.inviteId,
    company_name: invite.company, waba_id: '', phone_number_id: '',
    outcome: 'IG_OK', detail: `ig_user:${igUserId};username:${username}`.slice(0, 500)
  });
}

async function failInstagram({ invite, detail, fingerprint }) {
  await writeAuditRow({
    event_id: crypto.randomUUID(), at: new Date().toISOString(), ip_hash: fingerprint || '', invite_id: invite ? invite.inviteId : '',
    company_name: invite ? invite.company : '', waba_id: '', phone_number_id: '',
    outcome: 'IG_FAILED', detail: String(detail || '').slice(0, 500)
  });
}

function rowsOf(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

/** Liest die Mandantenzeile aus ig_tenants anhand tenant_key (ohne Token-Daten). */
async function getInstagramTenant(tenantKey) {
  if (!tenantKey) return null;
  const tableId = await igTableId();
  const filter = encodeURIComponent(JSON.stringify({ type: 'and', filters: [{ columnName: 'tenant_key', condition: 'eq', value: tenantKey }] }));
  const payload = await n8nJson(`data-tables/${encodeURIComponent(tableId)}/rows?filter=${filter}&limit=1`);
  return rowsOf(payload)[0] || null;
}

/** Liest bis zu `maxRows` Chat-Verlaufszeilen aus ig_chat_history_<tenant_key>.
 *  n8n begrenzt limit je Seite auf 250; bei nextCursor wird hoechstens zweimal nachgeladen. */
async function listInstagramHistory(historyTableId, maxRows = 250) {
  if (!historyTableId) return [];
  const rows = [];
  let cursor = '';
  for (let page = 0; page < 2 && rows.length < maxRows; page += 1) {
    const pageLimit = Math.min(250, maxRows - rows.length);
    const qs = new URLSearchParams({ limit: String(pageLimit) });
    if (cursor) qs.set('cursor', cursor);
    const payload = await n8nJson(`data-tables/${encodeURIComponent(historyTableId)}/rows?${qs.toString()}`);
    rows.push(...rowsOf(payload));
    cursor = payload && typeof payload.nextCursor === 'string' ? payload.nextCursor : '';
    if (!cursor) break;
  }
  return rows;
}

module.exports = { igTableId, connectInstagram, failInstagram, getInstagramTenant, listInstagramHistory };
