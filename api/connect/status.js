// Verbindungsstand eines Mandanten fuer die Kundenseite (nach dem OAuth-Redirect und beim Wiederbesuch).
const { verifyInviteToken } = require('../meta/_invite.js');
const { configured, getMailTenant } = require('./_n8n.js');

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' }); }
  const url = new URL(request.url || '/', 'https://hybote.ai');
  const invite = verifyInviteToken(url.searchParams.get('token') || '');
  if (!invite) return response.status(401).json({ ok: false, code: 'INVITE_INVALID' });
  if (invite.channel !== 'email') return response.status(200).json({ ok: true, connected: false });
  if (!configured()) return response.status(200).json({ ok: true, connected: false, configured: false });
  try {
    const row = await getMailTenant(invite.tenantKey);
    const connected = Boolean(row && String(row.status) === 'connected');
    return response.status(200).json({
      ok: true, configured: true, connected,
      provider: connected ? String(row.provider || '') : '',
      address: connected ? String(row.address || '') : '',
      connectedAt: connected ? String(row.connected_at || '') : ''
    });
  } catch (_error) {
    return response.status(502).json({ ok: false, code: 'STATUS_UNAVAILABLE' });
  }
};
