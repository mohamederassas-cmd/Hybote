// Persönliche Demo-Seite hybote.ai/v/<code> (03.11.2026, Plan „Demo zuerst“ Teil 4).
// Nur 10-Zeichen-Codes kommen hierher (Rewrite in vercel.json vor /v/:code); die 8-Zeichen-Codes der E-Mail-Videos
// bleiben auf der statischen v/index.html. Die Seite wird auf dem Server gerendert, weil die Link-Vorschau von WhatsApp
// und LinkedIn kein JavaScript ausführt: Titel, Beschreibung und Vorschaubild müssen im ausgelieferten HTML stehen.
// Datenschutz: Loom lädt erst nach dem Klick auf das Vorschaubild (Zwei-Klick), das Vorschaubild kommt von uns
// (/v/<code>/og.jpg, demo-og.js). Gezählt wird nur per JavaScript im Browser (demo_open, demo_play, demo_try,
// demo_book an video-view.js), so zählt die Vorschau-Abfrage eines Messengers nie als Aufruf.
const crypto = require('node:crypto');
const { configured, loadDemoRow, codeFromRequest, queryFlag } = require('../_demoPages.js');

const SITE = 'https://hybote.ai';
const DEFAULT_TRY_WA = '16505146359'; // Hadi, beantwortet Anruf und WhatsApp unter +1 650 514 6359
const DEFAULT_BOOKING = 'https://calendly.com/hybote-demo/free-intro-call';
const LOOM_ID = /^[0-9a-f]{32}$/;
const DEMO_CODE = /^[a-z2-9]{10}$/;

// Alle sichtbaren Texte. Regeln (verify.mjs prüft sie): keine Gedankenstriche, keine Ausrufezeichen, Sie-Form, keine
// Preise, nie „test“ oder „Stichprobe“ (wir sagen „ausprobieren“). Schweiz: ß wird beim Rendern zu ss.
const TEXTS = {
  de: {
    title: 'Ihre Demo für {company}',
    titlePlain: 'Ihre Demo',
    description: 'Gut eine Minute Video, danach können Sie den Assistenten selbst ausprobieren.',
    eyebrow: 'Persönliche Demo',
    leadBroker: 'So beantwortet Ihr Assistent Käuferanfragen in Sekunden, rund um die Uhr und in mehreren Sprachen.',
    leadDeveloper: 'So bekommt beim Launch jede Registrierung sofort eine Antwort, auch wenn Hunderte gleichzeitig kommen.',
    play: 'Video abspielen',
    videoTitle: 'Demo-Video',
    imageAlt: 'Vorschaubild der Demo',
    loomNote: 'Das Video lädt erst nach Ihrem Klick von Loom.',
    try: 'Selbst ausprobieren',
    tryNoteWa: 'Öffnet WhatsApp mit einer vorbereiteten Nachricht an Hadi, unseren Assistenten.',
    tryNoteUrl: 'Eine Minute im Browser: Bitten Sie Ihren Assistenten, eine Besichtigung zu buchen.',
    tryText: 'Hallo Hadi, ich habe gerade die Demo für {company} gesehen und habe eine Frage.',
    tryTextPlain: 'Hallo Hadi, ich habe gerade die Demo gesehen und habe eine Frage.',
    book: 'Termin buchen',
    contact: 'Mohamed auf WhatsApp schreiben',
    contactText: 'Hallo Mohamed, ich habe die Demo für {company} gesehen.',
    contactTextPlain: 'Hallo Mohamed, ich habe die Demo gesehen.',
    note: 'Diese Seite vermerkt einmal je Besuch, ob sie geöffnet, das Video gestartet oder einer der beiden Knöpfe genutzt wurde, damit Mohamed weiß, dass seine Nachricht angekommen ist. Keine Cookies.',
    privacy: 'Datenschutz',
    privacyHref: '/datenschutz.html?lang=de#demo-de',
    terms: 'AGB',
    termsHref: '/agb.html?lang=de',
    imprint: 'Impressum',
    preview: 'Vorschau: Aufrufe und Klicks werden nicht gezählt.',
    home: '/?lang=de'
  },
  en: {
    title: 'Your demo for {company}',
    titlePlain: 'Your demo',
    description: 'About a minute of video, then you can try the assistant yourself.',
    eyebrow: 'Personal demo',
    leadBroker: 'How your assistant answers buyer enquiries within seconds, around the clock and in several languages.',
    leadDeveloper: 'How every registration gets an instant answer at launch, even when hundreds arrive at once.',
    play: 'Play the video',
    videoTitle: 'Demo video',
    imageAlt: 'Preview of the demo',
    loomNote: 'The video loads from Loom only after you click.',
    try: 'Try it yourself',
    tryNoteWa: 'Opens WhatsApp with a prepared message to Hadi, our assistant.',
    tryNoteUrl: 'One minute in your browser: ask your concierge to book a viewing.',
    tryText: 'Hi Hadi, I just watched the demo for {company} and have a question.',
    tryTextPlain: 'Hi Hadi, I just watched the demo and have a question.',
    book: 'Book a call',
    contact: 'Message Mohamed on WhatsApp',
    contactText: 'Hi Mohamed, I watched the demo for {company}.',
    contactTextPlain: 'Hi Mohamed, I watched the demo.',
    note: 'This page notes once per visit whether it was opened, the video was started or one of the two buttons was used, so Mohamed knows his message reached you. No cookies.',
    privacy: 'Privacy',
    privacyHref: '/datenschutz.html?lang=en#demo-en',
    terms: 'Terms',
    termsHref: '/agb.html?lang=en',
    imprint: 'Legal notice',
    preview: 'Preview: visits and clicks are not counted.',
    home: '/?lang=en'
  }
};

// Anbieterkennzeichnung direkt in der Fußzeile: hybote.ai hat keine eigene Impressumsseite (Stand 03.11.2026).
// Geschützte Leerzeichen, damit „Ste R“ und „WY 82801“ am Handy nicht auseinanderbrechen.
const PROVIDER = 'Hybote AI Systems LLC, 30 N Gould St, Ste\u00a0R, Sheridan, WY\u00a082801, USA';
const PROVIDER_MAIL = 'Contact@hybote.ai';

const UNAVAILABLE = {
  404: { title: 'HYBOTE', de: 'Diese Seite ist nicht verfügbar.', en: 'This page is not available.' },
  503: { title: 'HYBOTE', de: 'Die Seite ist gerade nicht erreichbar. Bitte versuchen Sie es in einer Minute erneut.', en: 'This page is temporarily unavailable. Please try again in a minute.' }
};

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Nur https-Adressen ohne Zugangsdaten; alles andere (http, javascript:, Unsinn) ergibt ''. */
function safeHttpsUrl(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text.length > 2000) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return '';
    return url.toString();
  } catch (_error) {
    return '';
  }
}

function digits(value) {
  const d = String(value == null ? '' : value).replace(/\D/g, '');
  return d.length >= 8 && d.length <= 15 ? d : '';
}

function truthy(value) {
  return value === true || value === 1 || /^(true|1|yes)$/i.test(String(value == null ? '' : value).trim());
}

function fill(template, company) {
  // split/join statt replace: ein Firmenname mit „$&“ würde replace() sonst als Muster deuten.
  return String(template).split('{company}').join(company);
}

/** Wörterbuch der Zeile: Sprache aus lang, Schweiz ohne ß. */
function texts(lang, swiss) {
  const base = TEXTS[lang === 'de' ? 'de' : 'en'];
  if (!(lang === 'de' && swiss)) return base;
  const out = {};
  for (const [key, value] of Object.entries(base)) out[key] = value.replace(/ß/g, 'ss');
  return out;
}

function contentSecurityPolicy(nonce) {
  return [
    "default-src 'none'",
    // 'self' für /calendly-popup.js, assets.calendly.com lädt dieses Skript erst beim Klick auf „Termin buchen“.
    `script-src 'self' 'nonce-${nonce}' https://assets.calendly.com`,
    // Calendlys widget.js setzt style-Attribute, deshalb 'unsafe-inline' nur für Styles.
    "style-src 'self' 'unsafe-inline' https://assets.calendly.com",
    // assets.calendly.com: Schließen-Symbol des Calendly-Fensters (widget.css).
    "img-src 'self' data: https://assets.calendly.com",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src https://www.loom.com https://calendly.com",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'"
  ].join('; ');
}

function baseHeaders(nonce) {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy': contentSecurityPolicy(nonce),
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
  };
}

const STYLE = `
    :root {
      --bg: #070b16; --s1: #0c1222; --s2: #131b30; --line: rgba(255,255,255,.10);
      --fg: #f5f1eb; --muted: #8b95aa; --accent: #38BDF8; --accent-lt: #7DD3FC;
    }
    * { box-sizing: border-box; }
    html { background: var(--bg); color: var(--fg); -webkit-text-size-adjust: 100%; }
    body {
      margin: 0; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column;
      font-family: "Montserrat", -apple-system, "Segoe UI", Arial, sans-serif; font-weight: 400; line-height: 1.6;
      background: radial-gradient(900px 520px at 50% -12%, rgba(56,189,248,.11), transparent 70%), var(--bg);
    }
    .band { position: sticky; top: 0; z-index: 5; margin: 0; padding: 10px 16px; text-align: center; font-size: 13px; font-weight: 500; color: var(--bg); background: var(--accent); }
    .page { width: 100%; max-width: 760px; margin: 0 auto; padding: 28px 16px 8px; }
    .brand { display: flex; justify-content: center; margin: 0 0 36px; }
    .brand img { display: block; height: 22px; width: auto; opacity: .92; }
    .eyebrow { margin: 0 0 12px; text-align: center; font-size: 13px; font-weight: 500; letter-spacing: .22em; text-transform: uppercase; color: var(--muted); }
    h1 {
      margin: 0 0 14px; text-align: center; font-family: "Cormorant Garamond", Georgia, serif; font-weight: 300;
      font-size: clamp(34px, 9vw, 54px); line-height: 1.08; letter-spacing: -.01em; overflow-wrap: anywhere;
    }
    .lead { margin: 0 auto 28px; max-width: 560px; text-align: center; font-size: 16px; color: var(--muted); }
    .frame {
      position: relative; aspect-ratio: 16 / 10; border-radius: 12px; overflow: hidden;
      background: var(--s1); border: 1px solid var(--line); box-shadow: 0 24px 70px rgba(0,0,0,.45);
    }
    .poster { position: absolute; inset: 0; display: block; cursor: pointer; }
    .poster img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .poster::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(7,11,22,0) 45%, rgba(7,11,22,.5)); }
    .play {
      position: absolute; left: 50%; top: 50%; z-index: 1; width: 76px; height: 76px; margin: -38px 0 0 -38px;
      border-radius: 50%; background: rgba(12,18,34,.72); border: 3px solid #fff; box-shadow: 0 12px 34px rgba(0,0,0,.4);
      transition: transform .15s ease;
    }
    .play::after { content: ""; position: absolute; left: 28px; top: 20px; border-style: solid; border-width: 15px 0 15px 24px; border-color: transparent transparent transparent #fff; }
    .poster:hover .play, .poster:focus-visible .play { transform: scale(1.06); }
    .poster:focus-visible { outline: 2px solid var(--accent); outline-offset: -4px; }
    .frame iframe { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; border: 0; transition: opacity .3s ease; }
    .frame iframe.is-pending { opacity: 0; }
    .poster.is-loading { cursor: default; }
    .poster.is-loading .play { display: none; }
    .poster.is-loading::before {
      content: ""; position: absolute; left: 50%; top: 50%; z-index: 1; width: 40px; height: 40px; margin: -20px 0 0 -20px;
      border-radius: 50%; border: 3px solid rgba(255,255,255,.3); border-top-color: #fff; background: rgba(12,18,34,.6);
      box-shadow: 0 0 0 10px rgba(12,18,34,.6); animation: spin .9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .hint { margin: 10px 0 0; text-align: center; font-size: 13px; color: var(--muted); }
    .actions { display: flex; flex-direction: column; gap: 12px; margin: 30px 0 0; }
    .btn {
      display: flex; align-items: center; justify-content: center; min-height: 52px; padding: 0 26px; border-radius: 999px;
      font: inherit; font-size: 15px; font-weight: 500; letter-spacing: .02em; text-decoration: none;
      transition: background .15s ease, border-color .15s ease;
    }
    .btn-primary { background: var(--accent); color: var(--bg); }
    .btn-primary:hover { background: var(--accent-lt); }
    .btn-ghost { border: 1px solid var(--line); color: var(--fg); background: rgba(255,255,255,.03); }
    .btn-ghost:hover { border-color: rgba(255,255,255,.28); }
    a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
    /* Hinweis direkt unter „Selbst ausprobieren“, nicht unter „Termin buchen“ (03.11.2026). */
    .action { display: flex; flex-direction: column; }
    .try-note { margin: 8px 0 0; text-align: center; font-size: 13px; color: var(--muted); }
    .contact { margin: 22px 0 0; text-align: center; font-size: 14px; }
    .contact a { color: var(--fg); text-underline-offset: 3px; text-decoration-color: rgba(255,255,255,.35); }
    footer { margin-top: auto; padding: 36px 16px 32px; text-align: center; font-size: 13px; line-height: 1.6; color: var(--muted); }
    footer p { margin: 0 auto 8px; max-width: 600px; }
    footer a { color: var(--muted); text-underline-offset: 3px; }
    .nowrap { white-space: nowrap; }
    .msg { margin: 18vh auto 0; max-width: 520px; padding: 0 16px; text-align: center; }
    .msg p { margin: 0 0 10px; color: var(--muted); }
    .msg a { color: var(--fg); }
    @media (min-width: 560px) {
      .page { padding-top: 40px; }
      .actions { flex-direction: row; justify-content: center; align-items: flex-start; }
      .btn { display: inline-flex; min-width: 220px; }
    }
    @media (prefers-reduced-motion: reduce) { .btn, .play, .frame iframe { transition: none; } .poster.is-loading::before { animation: none; } }
`;

// Das einzige Inline-Skript (mit Nonce). Es enthält keine Werte aus der Tabelle; Code, Sprache und Vorschau-Schalter
// stehen escaped in data-Attributen von <main id="demo">.
const SCRIPT = `
(function () {
  var root = document.getElementById('demo');
  if (!root) return;
  var code = root.getAttribute('data-code') || '';
  var lang = root.getAttribute('data-lang') === 'de' ? 'de' : 'en';
  var preview = root.getAttribute('data-preview') === '1';
  var ENDPOINT = '/api/connect/video-view';
  var sent = {};
  function newId() {
    try { if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID(); } catch (e) {}
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12) + '-' + Math.random().toString(36).slice(2, 12);
  }
  // Jedes Ereignis höchstens einmal je Seitenaufruf; die Vorschau (?preview=1) sendet nie.
  function send(event) {
    if (preview || !code || sent[event]) return;
    sent[event] = true;
    var body = JSON.stringify({ event_id: newId(), code: code, event: event, lang: lang });
    try { if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return; } catch (e) {}
    try { fetch(ENDPOINT, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: body }).catch(function () {}); } catch (e) {}
  }
  // demo_open erst nach 2 Sekunden sichtbarer Seite (Hintergrund-Tabs und Vorlader zählen nicht).
  var timer = null;
  function arm() {
    if (sent.demo_open || timer || document.visibilityState === 'hidden') return;
    timer = setTimeout(function () { timer = null; if (document.visibilityState !== 'hidden') send('demo_open'); }, 2000);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { if (timer) { clearTimeout(timer); timer = null; } } else { arm(); }
  });
  arm();
  // Zwei-Klick-Video: erst der Klick setzt das Loom-iframe ein, vorher gibt es keine Verbindung zu Loom.
  // Der Loom-Player lädt rund 30 Skripte; bis sein Dokument geladen ist (spätestens 12 s), bleibt unser Vorschaubild
  // mit einem Ladering sichtbar statt eines leeren dunklen Kastens.
  var poster = document.getElementById('demo-poster');
  if (poster) poster.addEventListener('click', function (e) {
    if (e && e.preventDefault) e.preventDefault();
    var src = poster.getAttribute('data-embed');
    if (!src || poster.getAttribute('data-started')) return;
    poster.setAttribute('data-started', '1');
    send('demo_play');
    var frame = document.createElement('iframe');
    frame.className = 'is-pending';
    frame.src = src;
    frame.title = poster.getAttribute('data-title') || '';
    frame.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    function reveal() { frame.className = ''; }
    frame.addEventListener('load', reveal);
    setTimeout(reveal, 12000);
    poster.className += ' is-loading';
    poster.setAttribute('aria-hidden', 'true');
    poster.setAttribute('tabindex', '-1');
    poster.parentNode.appendChild(frame);
  });
  function bind(id, event) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function () { send(event); });
  }
  bind('demo-try', 'demo_try');
  bind('demo-book', 'demo_book');
})();
`;

function head({ lang, title, description, extra }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${escapeHtml(title)}</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <meta name="theme-color" content="#070b16" />
  <meta name="description" content="${escapeHtml(description)}" />
${extra || ''}  <link rel="icon" href="data:," />
  <link rel="preload" href="/fonts/montserrat-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/fonts/cormorant-garamond-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link href="/fonts/fonts.css" rel="stylesheet" />
  <style>${STYLE}  </style>
</head>`;
}

/** Neutrale Seite ohne Firmenbezug (unbekannter oder zurückgezogener Code, n8n nicht erreichbar). */
function renderUnavailable(status, nonce) {
  const s = status === 503 ? 503 : 404;
  const t = UNAVAILABLE[s];
  const n = nonce || crypto.randomBytes(16).toString('base64');
  const html = `${head({ lang: 'en', title: t.title, description: t.en })}
<body>
  <main class="msg">
    <div class="brand"><img src="/logo-mobile-white.png" alt="HYBOTE" width="2328" height="374" /></div>
    <p lang="de">${escapeHtml(t.de)}</p>
    <p>${escapeHtml(t.en)}</p>
    <p><a href="/">hybote.ai</a></p>
  </main>
</body>
</html>
`;
  const headers = baseHeaders(n);
  if (s === 503) headers['Retry-After'] = '60';
  return { status: s, html, headers };
}

/**
 * Rendert die Demo-Seite aus einer Zeile der n8n-Tabelle demo_pages. Reine Funktion (für build/demo-page.test.mjs).
 * Unbekannt, zurückgezogen oder ohne gültige Loom-ID ergibt eine neutrale 404-Seite.
 * @returns {{ status: number, html: string, headers: Record<string, string> }}
 */
function renderDemoPage(row, { nonce, preview } = {}) {
  const n = nonce || crypto.randomBytes(16).toString('base64');
  const code = String(row && row.code || '').trim().toLowerCase();
  const loomId = String(row && row.loom_id || '').trim().toLowerCase();
  if (!row || String(row.status || '').trim().toLowerCase() !== 'live' || !DEMO_CODE.test(code) || !LOOM_ID.test(loomId)) {
    return renderUnavailable(404, n);
  }
  const lang = String(row.lang || '').toLowerCase() === 'de' ? 'de' : 'en';
  const swiss = truthy(row.swiss);
  const T = texts(lang, swiss);
  const company = String(row.company || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  const title = company ? fill(T.title, company) : T.titlePlain;
  const lead = String(row.kind || '').toLowerCase() === 'developer' ? T.leadDeveloper : T.leadBroker;
  const version = Number.isFinite(Number(row.version)) ? Math.max(0, Math.floor(Number(row.version))) : 0;
  const pageUrl = `${SITE}/v/${code}`;
  const ogImage = `${SITE}/v/${code}/og.jpg?v=${version}`;
  const locale = lang === 'de' ? (swiss ? 'de_CH' : 'de_DE') : 'en_US';

  // „Selbst ausprobieren“: eigener Ausprobier-Link der Firma (nur https), sonst WhatsApp an Hadi mit vorbereitetem Text.
  const testUrl = safeHttpsUrl(row.test_url);
  const tryText = String(row.try_text || '').trim() || (company ? fill(T.tryText, company) : T.tryTextPlain);
  const tryHref = testUrl || `https://wa.me/${digits(row.try_wa) || DEFAULT_TRY_WA}?text=${encodeURIComponent(tryText)}`;
  const tryNote = testUrl ? T.tryNoteUrl : T.tryNoteWa;

  // „Termin buchen“: Calendly im Fenster auf unserer Seite (calendly-popup.js), ohne JavaScript der normale Link.
  const bookingFromRow = safeHttpsUrl(row.booking_url);
  const bookHref = bookingFromRow ||
    `${DEFAULT_BOOKING}?utm_source=hybote_demo&utm_medium=demo_page&utm_campaign=${encodeURIComponent(code)}`;
  const bookPopup = new URL(bookHref).hostname === 'calendly.com';

  const contactWa = digits(row.contact_wa);
  const contactHref = contactWa
    ? `https://wa.me/${contactWa}?text=${encodeURIComponent(company ? fill(T.contactText, company) : T.contactTextPlain)}`
    : '';

  const embed = `https://www.loom.com/embed/${loomId}?autoplay=1&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`;
  const share = `https://www.loom.com/share/${loomId}`;
  const poster = `/v/${code}/og.jpg?v=${version}`;

  const og = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'HYBOTE'],
    ['property', 'og:locale', locale],
    ['property', 'og:title', title],
    ['property', 'og:description', T.description],
    ['property', 'og:url', pageUrl],
    ['property', 'og:image', ogImage],
    ['property', 'og:image:alt', T.imageAlt],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', T.description],
    ['name', 'twitter:image', ogImage]
  ].map(([attr, key, value]) => `  <meta ${attr}="${key}" content="${escapeHtml(value)}" />\n`).join('');

  const html = `${head({ lang, title, description: T.description, extra: og })}
<body>
${preview ? `  <p class="band" role="status">${escapeHtml(T.preview)}</p>\n` : ''}  <main class="page" id="demo" data-code="${escapeHtml(code)}" data-lang="${lang}" data-preview="${preview ? '1' : '0'}">
    <div class="brand"><a href="${escapeHtml(T.home)}"><img src="/logo-mobile-white.png" alt="HYBOTE" width="2328" height="374" /></a></div>
    <p class="eyebrow">${escapeHtml(T.eyebrow)}</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="lead">${escapeHtml(lead)}</p>
    <div class="frame">
      <a class="poster" id="demo-poster" href="${escapeHtml(share)}" target="_blank" rel="noopener" data-embed="${escapeHtml(embed)}" data-title="${escapeHtml(T.videoTitle)}" aria-label="${escapeHtml(T.play)}">
        <img src="${escapeHtml(poster)}" alt="${escapeHtml(T.imageAlt)}" decoding="async" fetchpriority="high" />
        <span class="play" aria-hidden="true"></span>
      </a>
    </div>
    <p class="hint">${escapeHtml(T.loomNote)}</p>
    <div class="actions">
      <div class="action">
        <a class="btn btn-primary" id="demo-book" href="${escapeHtml(bookHref)}"${bookPopup ? ' data-cal-popup' : ' target="_blank" rel="noopener"'}>${escapeHtml(T.book)}</a>
      </div>
      <div class="action">
        <a class="btn btn-ghost" id="demo-try" href="${escapeHtml(tryHref)}" target="_blank" rel="noopener">${escapeHtml(T.try)}</a>
        <p class="try-note">${escapeHtml(tryNote)}</p>
      </div>
    </div>
${contactHref ? `    <p class="contact"><a id="demo-contact" href="${escapeHtml(contactHref)}" target="_blank" rel="noopener">${escapeHtml(T.contact)}</a></p>\n` : ''}  </main>
  <footer>
    <p>${escapeHtml(T.note)} <span class="nowrap"><a href="${escapeHtml(T.privacyHref)}">${escapeHtml(T.privacy)}</a> · <a href="${escapeHtml(T.termsHref)}">${escapeHtml(T.terms)}</a></span></p>
    <p>${escapeHtml(T.imprint)}: ${escapeHtml(PROVIDER)} · <a class="nowrap" href="mailto:${PROVIDER_MAIL}">${PROVIDER_MAIL}</a></p>
  </footer>
${bookPopup ? '  <script src="/calendly-popup.js" defer></script>\n' : ''}  <script nonce="${escapeHtml(n)}">${SCRIPT}</script>
</body>
</html>
`;
  return { status: 200, html, headers: baseHeaders(n) };
}

function send(request, response, result) {
  for (const [key, value] of Object.entries(result.headers)) response.setHeader(key, value);
  response.status(result.status);
  if (request.method === 'HEAD') return response.end();
  return response.send(result.html);
}

module.exports = async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    return response.status(405).end();
  }
  const nonce = crypto.randomBytes(16).toString('base64');
  const code = codeFromRequest(request);
  if (!code) return send(request, response, renderUnavailable(404, nonce));
  if (!configured()) return send(request, response, renderUnavailable(503, nonce));
  let row;
  try {
    row = await loadDemoRow(code);
  } catch (error) {
    console.error('[demo-page]', error && error.message, error && error.status);
    return send(request, response, renderUnavailable(503, nonce));
  }
  return send(request, response, renderDemoPage(row, { nonce, preview: queryFlag(request, 'preview') === '1' }));
};

module.exports.renderDemoPage = renderDemoPage;
module.exports.renderUnavailable = renderUnavailable;
module.exports.contentSecurityPolicy = contentSecurityPolicy;
module.exports.safeHttpsUrl = safeHttpsUrl;
module.exports.escapeHtml = escapeHtml;
module.exports.TEXTS = TEXTS;
