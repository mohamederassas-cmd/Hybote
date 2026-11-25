// Liefert die Live-Konversationen (Threads + Nachrichtenverlauf) fuer ein verbundenes Instagram-Konto.
// Zugriff streng ueber das signierte Einladungs-Token (channel === 'instagram'); gelesen wird ausschliesslich
// die eigene history_table_id des Mandanten aus ig_tenants. Keine Tokens oder fremde Mandantendaten.
const { verifyInviteToken } = require('../../meta/_invite.js');
const { config } = require('../_n8n.js');
const { getInstagramTenant, listInstagramHistory } = require('../_igTenant.js');
const { queryOf } = require('../_state.js');

const MAX_THREADS = 20;
const MAX_HISTORY_ROWS = 250;

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'assistant' || role === 'ai' || role === 'bot') return 'assistant';
  if (role === 'owner' || role === 'human' || role === 'agent' || role === 'echo') return 'owner';
  return 'inbound';
}

function parseTimestamp(value) {
  if (!value) return 0;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}

function threadLabel(threadId) {
  const clean = String(threadId || '').trim();
  if (clean.length > 6) return `Instagram User · …${clean.slice(-6)}`;
  return `Instagram User · ${clean}`;
}

function buildThreads(rows) {
  const byThread = new Map();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || typeof row !== 'object') continue;
    const threadId = String(row.wa_id || '').trim();
    const text = String(row.text || '').trim();
    if (!threadId || !text) continue;
    const createdAt = String(row.created_at || row.createdAt || '');
    const msg = {
      id: String(row.id !== undefined && row.id !== null ? row.id : `${threadId}:${i}`),
      role: normalizeRole(row.role),
      text,
      createdAt,
      _ts: parseTimestamp(createdAt),
      _idx: i
    };
    if (!byThread.has(threadId)) byThread.set(threadId, []);
    byThread.get(threadId).push(msg);
  }

  const threads = [];
  for (const [threadId, list] of byThread.entries()) {
    list.sort((a, b) => {
      if (a._ts !== b._ts) return a._ts - b._ts;
      const aNum = Number(a.id);
      const bNum = Number(b.id);
      if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return aNum - bNum;
      return a._idx - b._idx;
    });
    const last = list[list.length - 1];
    threads.push({
      threadId,
      label: threadLabel(threadId),
      messageCount: list.length,
      lastMessageAt: last.createdAt || '',
      preview: last.text.slice(0, 100),
      _lastTs: last._ts,
      messages: list.map(({ id, role, text, createdAt }) => ({ id, role, text, createdAt }))
    });
  }

  threads.sort((a, b) => b._lastTs - a._lastTs);
  return threads.slice(0, MAX_THREADS).map(({ threadId, label, messageCount, lastMessageAt, preview, messages }) => ({
    threadId, label, messageCount, lastMessageAt, preview, messages
  }));
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const token = queryOf(request).get('token') || '';
  const invite = verifyInviteToken(token);
  if (!invite) return response.status(401).json({ ok: false, code: 'INVITE_INVALID' });
  if (invite.channel !== 'instagram') return response.status(403).json({ ok: false, code: 'INVITE_CHANNEL_MISMATCH' });

  const cfg = config();
  if (!cfg.baseUrl || !cfg.apiKey) {
    return response.status(200).json({ ok: true, configured: false, account: null, threads: [] });
  }

  try {
    const row = await getInstagramTenant(invite.tenantKey);
    const connected = Boolean(row && String(row.status || '') === 'connected');
    const account = row
      ? {
          connected,
          username: String(row.username || ''),
          accountType: String(row.account_type || ''),
          igUserId: String(row.ig_user_id || ''),
          agentStatus: String(row.agent_status || ''),
          connectedAt: String(row.connected_at || '')
        }
      : { connected: false, username: '', accountType: '', igUserId: '', agentStatus: '', connectedAt: '' };

    const historyTableId = row && row.history_table_id ? String(row.history_table_id) : '';
    const historyRows = historyTableId ? await listInstagramHistory(historyTableId, MAX_HISTORY_ROWS) : [];
    const threads = buildThreads(historyRows);

    return response.status(200).json({ ok: true, configured: true, account, threads });
  } catch (_error) {
    return response.status(502).json({ ok: false, code: 'MESSAGES_UNAVAILABLE' });
  }
};
module.exports.buildThreads = buildThreads;
