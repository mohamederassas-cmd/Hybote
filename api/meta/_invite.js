// Signierte Einmal-Einladungen fuer die Verbindungsseite.
//
// Der Sales Pilot signiert, Vercel prueft – beide mit demselben Geheimnis
// (META_INVITE_SECRET). Bewusst ohne Netzwerkaufruf zwischen beiden Systemen:
// zum Signup-Zeitpunkt darf nichts von der Erreichbarkeit des Macs abhaengen.
//
// Format und Signaturverfahren sind identisch zu signSessionToken() im Sales
// Pilot (server/src/auth.ts), damit es nur ein Verfahren im Haus gibt:
//   base64url(JSON) + "." + base64url(HMAC-SHA256(payload))
const crypto = require('node:crypto');

function b64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(value) {
  return Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/** Prueft ein Einladungs-Token und liefert die darin festgeschriebenen Kundendaten.
 *  Gibt null zurueck, sobald irgendetwas nicht stimmt – der Aufrufer unterscheidet
 *  bewusst nicht zwischen "falsch signiert" und "abgelaufen", damit die Antwort
 *  keinen Hinweis fuer Rateversuche gibt. */
function verifyInviteToken(token) {
  const secret = process.env.META_INVITE_SECRET || '';
  if (!token || secret.length < 32) return null;

  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return null;

  const expected = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const data = JSON.parse(fromB64url(payload));
    if (typeof data.company !== 'string' || data.company.length < 2) return null;
    if (typeof data.email !== 'string' || !data.email.includes('@')) return null;
    if (typeof data.exp !== 'number' || data.exp * 1000 < Date.now()) return null;
    return {
      inviteId: typeof data.jti === 'string' ? data.jti : '',
      company: data.company.slice(0, 120),
      email: data.email.toLowerCase().slice(0, 254),
      customerReference: typeof data.ref === 'string' ? data.ref.slice(0, 120) : '',
      expiresAt: new Date(data.exp * 1000).toISOString()
    };
  } catch (_error) {
    return null;
  }
}

/** Nur fuer Tests und das Erzeugen von Reviewer-Links per Skript. Im Regelbetrieb
 *  signiert der Sales Pilot, nicht Vercel. */
function signInviteToken({ company, email, customerReference = '', inviteId = '', ttlSeconds = 14 * 24 * 3600 }) {
  const secret = process.env.META_INVITE_SECRET || '';
  if (secret.length < 32) throw new Error('META_INVITE_SECRET fehlt oder ist zu kurz');
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(Buffer.from(JSON.stringify({
    company, email, ref: customerReference, jti: inviteId, iat: now, exp: now + ttlSeconds
  })));
  const signature = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${signature}`;
}

module.exports = { verifyInviteToken, signInviteToken, b64url };
