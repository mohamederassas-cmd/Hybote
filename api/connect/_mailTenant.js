// Ergebnis einer Postfach-Anbindung festschreiben: n8n-Credential ist bereits angelegt,
// hier folgen die Zeile in mail_tenants und die Audit-Spur. Kein Kunden-Geheimnis ausserhalb n8n.
const crypto = require('node:crypto');
const { upsertMailTenant, writeAuditRow } = require('./_n8n.js');

function credentialName(prefix, invite, address) {
  return `${prefix} · ${String(invite.company || '').slice(0, 50)} · ${String(address || '').slice(0, 80)}`;
}

async function connectMailbox({ invite, provider, address, credentialId, smtpCredentialId, scopes, expiresAt, fingerprint }) {
  const now = new Date().toISOString();
  await upsertMailTenant({
    tenant_key: invite.tenantKey,
    company_name: invite.company,
    provider,
    address: String(address || '').toLowerCase(),
    credential_id: String(credentialId || ''),
    smtp_credential_id: String(smtpCredentialId || ''),
    status: 'connected',
    connected_at: now,
    scopes: String(scopes || ''),
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : '',
    invite_id: invite.inviteId,
    updated_at: now
  });
  await writeAuditRow({
    event_id: crypto.randomUUID(), at: now, ip_hash: fingerprint || '', invite_id: invite.inviteId,
    company_name: invite.company, waba_id: '', phone_number_id: '',
    outcome: 'MAIL_OK', detail: `provider:${provider};address:${String(address || '').toLowerCase()}`.slice(0, 500)
  });
}

async function failMailbox({ invite, provider, detail, fingerprint }) {
  await writeAuditRow({
    event_id: crypto.randomUUID(), at: new Date().toISOString(), ip_hash: fingerprint || '', invite_id: invite ? invite.inviteId : '',
    company_name: invite ? invite.company : '', waba_id: '', phone_number_id: '',
    outcome: 'MAIL_FAILED', detail: `provider:${provider};${String(detail || '')}`.slice(0, 500)
  });
}

module.exports = { credentialName, connectMailbox, failMailbox };
