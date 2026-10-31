// Postfach-Erkennung (31.10.2026): aus der Domain der Adresse die IMAP/SMTP-Server ableiten, damit Kunden sie
// nicht kennen muessen. Erst bekannte Freemail-Domains, sonst der MX-Eintrag der Domain (Firmen-Domains bei IONOS,
// Strato, Google Workspace …). Microsoft (Outlook.com wie Microsoft 365) erlaubt kein IMAP mit App-Passwort mehr
// und wird auf den Microsoft-Knopf verwiesen. Liefert nur oeffentliche DNS-Daten, deshalb ohne Einladung.
const dns = require('dns').promises;
const { clientFingerprint, rateLimited } = require('../_state.js');

const imap = (label, imapHost, smtpHost, smtpPort = 465, appPassword = false) => ({ use: 'imap', label, imapHost, imapPort: 993, smtpHost, smtpPort, appPassword });
const MICROSOFT = { use: 'microsoft', label: 'Microsoft' };
const GOOGLE = imap('Google', 'imap.gmail.com', 'smtp.gmail.com', 465, true);
const YAHOO = imap('Yahoo', 'imap.mail.yahoo.com', 'smtp.mail.yahoo.com', 465, true);
const AOL = imap('AOL', 'imap.aol.com', 'smtp.aol.com', 465, true);
const ICLOUD = imap('iCloud', 'imap.mail.me.com', 'smtp.mail.me.com', 587, true);
const GMX = imap('GMX', 'imap.gmx.net', 'mail.gmx.net', 587);
const WEBDE = imap('WEB.DE', 'imap.web.de', 'smtp.web.de', 587);
const TONLINE = imap('Telekom', 'secureimap.t-online.de', 'securesmtp.t-online.de', 465);
const MAILRU = imap('Mail.ru', 'imap.mail.ru', 'smtp.mail.ru', 465, true);
const YANDEX = imap('Yandex', 'imap.yandex.com', 'smtp.yandex.com', 465, true);
const MAILBOXORG = imap('mailbox.org', 'imap.mailbox.org', 'smtp.mailbox.org', 465);

const DOMAINS = {
  'gmail.com': GOOGLE, 'googlemail.com': GOOGLE,
  'outlook.com': MICROSOFT, 'outlook.de': MICROSOFT, 'hotmail.com': MICROSOFT, 'hotmail.de': MICROSOFT, 'hotmail.fr': MICROSOFT,
  'hotmail.co.uk': MICROSOFT, 'live.com': MICROSOFT, 'live.de': MICROSOFT, 'live.fr': MICROSOFT, 'msn.com': MICROSOFT,
  'yahoo.com': YAHOO, 'yahoo.de': YAHOO, 'yahoo.fr': YAHOO, 'yahoo.co.uk': YAHOO, 'ymail.com': YAHOO,
  'aol.com': AOL, 'aol.de': AOL,
  'icloud.com': ICLOUD, 'me.com': ICLOUD, 'mac.com': ICLOUD,
  'gmx.de': GMX, 'gmx.net': GMX, 'gmx.at': GMX, 'gmx.ch': GMX, 'gmx.com': GMX,
  'web.de': WEBDE, 't-online.de': TONLINE,
  'mail.ru': MAILRU, 'inbox.ru': MAILRU, 'list.ru': MAILRU, 'bk.ru': MAILRU,
  'yandex.ru': YANDEX, 'yandex.com': YANDEX, 'ya.ru': YANDEX,
  'mailbox.org': MAILBOXORG
};

// MX-Ziel → Anbieter. Reihenfolge egal, die Muster schliessen sich aus.
const MX_RULES = [
  [/(^|\.)(google|googlemail)\.com$/, imap('Google Workspace', 'imap.gmail.com', 'smtp.gmail.com', 465, true)],
  [/(^|\.)outlook\.com$/, MICROSOFT],
  [/(^|\.)(kundenserver\.de|ionos\.(de|com|co\.uk|fr|es|it))$/, imap('IONOS', 'imap.ionos.de', 'smtp.ionos.de')],
  [/(^|\.)rzone\.de$/, imap('Strato', 'imap.strato.de', 'smtp.strato.de')],
  [/(^|\.)secureserver\.net$/, imap('GoDaddy', 'imap.secureserver.net', 'smtpout.secureserver.net')],
  [/(^|\.)hostinger\.com$/, imap('Hostinger', 'imap.hostinger.com', 'smtp.hostinger.com')],
  [/(^|\.)zoho\.eu$/, imap('Zoho', 'imap.zoho.eu', 'smtp.zoho.eu')],
  [/(^|\.)zoho\.com$/, imap('Zoho', 'imap.zoho.com', 'smtp.zoho.com')],
  [/(^|\.)mailbox\.org$/, MAILBOXORG],
  [/(^|\.)gmx\.net$/, GMX],
  [/(^|\.)web\.de$/, WEBDE],
  [/(^|\.)t-online\.de$/, TONLINE],
  [/(^|\.)mail\.ru$/, MAILRU],
  [/(^|\.)yandex\.(net|ru)$/, YANDEX]
];

async function detect(domain, resolveMx = dns.resolveMx) {
  if (DOMAINS[domain]) return DOMAINS[domain];
  let records = [];
  try {
    records = await Promise.race([resolveMx(domain), new Promise((_, reject) => setTimeout(() => reject(new Error('DNS_TIMEOUT')), 3000))]);
  } catch (_error) {
    return { use: null };
  }
  const hosts = (records || []).sort((a, b) => a.priority - b.priority).map((r) => String(r.exchange || '').toLowerCase().replace(/\.$/, ''));
  for (const host of hosts) {
    const rule = MX_RULES.find(([pattern]) => pattern.test(host));
    if (rule) return rule[1];
  }
  return { use: null };
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' }); }
  if (rateLimited(clientFingerprint(request) + ':detect', 40)) return response.status(429).json({ ok: false, code: 'TOO_MANY_ATTEMPTS' });
  const url = new URL(request.url || '/', 'https://hybote.ai');
  const domain = String(url.searchParams.get('domain') || '').trim().toLowerCase().replace(/^.*@/, '');
  if (!/^[a-z0-9.-]{3,253}$/.test(domain) || !domain.includes('.')) return response.status(400).json({ ok: false, code: 'INVALID_DOMAIN' });
  return response.status(200).json({ ok: true, domain, ...(await detect(domain)) });
};
module.exports.detect = detect;
