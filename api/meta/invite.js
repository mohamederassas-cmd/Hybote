// Loest einen Einladungslink in die vorbefuellten Kundendaten auf.
//
// Read-only und bewusst ohne Origin-Pruefung: Die Seite ruft den Endpunkt per
// same-origin-GET auf, und der Browser sendet dabei nicht zuverlaessig einen
// Origin-Header. Der Endpunkt gibt ausschliesslich das zurueck, was ohnehin
// signiert im Link steht, den der Kunde bereits in der Hand haelt.
const { verifyInviteToken } = require('./_invite.js');

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const url = new URL(request.url || '/', 'https://hybote.ai');
  const invite = verifyInviteToken(url.searchParams.get('token') || '');
  if (!invite) {
    return response.status(401).json({ ok: false, code: 'INVITE_INVALID' });
  }

  return response.status(200).json({
    ok: true,
    invite: {
      company: invite.company,
      email: invite.email,
      customerReference: invite.customerReference,
      expiresAt: invite.expiresAt
    }
  });
};
