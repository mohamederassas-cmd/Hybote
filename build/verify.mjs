// Prüft die Seiten, ohne einen Browser zu starten.
//
//   node build/verify.mjs
//
// Pfade, Meta-Angaben, i18n-Vollständigkeit und die FAQ-Nummerierung.
// Läuft in Sekunden und lohnt sich vor jedem Deploy.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Die Branchenseiten wurden am 21.10.2026 entfernt; alte Links leitet vercel.json um.
const REMOVED_SLUGS = ['real-estate', 'car-dealerships', 'medical-practices'];
const BOOKING_PAGES = [
  ['index.html', join(ROOT, 'index.html')],
];
const LEGACY_CALENDAR_MARKERS = [
  'lead' + 'connector',
  'msg' + 'sndr',
  'go' + 'highlevel',
  'go high' + ' level',
];

let failures = 0;

function report(name, checks) {
  const bad = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  failures += bad.length;
  console.log(
    bad.length
      ? `  ✗ ${name}\n      ${bad.join('\n      ')}`
      : `  ✓ ${name}  (${Object.keys(checks).length} Prüfungen)`
  );
}

/* ── Gemeinsamer Buchungsblock ─────────────────────────────────────────── */
console.log('\nCalendly-Buchungsblock');
for (const [name, path] of BOOKING_PAGES) {
  const h = readFileSync(path, 'utf8');
  report(name, {
    'kein alter Kalender-Anbieter':
      !LEGACY_CALENDAR_MARKERS.some((marker) => h.toLowerCase().includes(marker)),
    'genau ein Calendly-Widget': (h.match(/id="calendly-inline-widget"/g) || []).length === 1,
    'genau ein Calendly-Embed-Script':
      (h.match(/assets\.calendly\.com\/assets\/external\/widget\.js/g) || []).length === 1,
    'direkter Fallback-Link vorhanden':
      h.includes('href="https://calendly.com/hybote-demo/free-intro-call"'),
    'Advanced Embed mit automatischer Höhe':
      h.includes('Calendly.initInlineWidget({') && h.includes('resize: true'),
    'doppelte Details und Calendly-Banner ausgeblendet':
      h.includes('hide_event_type_details=1&hide_gdpr_banner=1'),
    'vollständiges Kampagnen-Tracking':
      h.includes("utmSource: 'hybote.ai'") &&
      h.includes("utmMedium: 'website'") &&
      h.includes("utmCampaign: 'free_intro_call'") &&
      h.includes('utmContent: tracking.content'),
    'Loader, Fehlerzustand und LTR-Kalender vorhanden':
      h.includes('id="calendly-status"') &&
      h.includes("'contact.cal.error'") &&
      h.includes('class="calendly-surface" dir="ltr"'),
  });
}

/* ── Erklärvideo und Gründer-Sektion ───────────────────────────────────── */
console.log('\nErklärvideo und Gründer');
const MEDIA = ['hybote-explainer-en.mp4', 'hybote-explainer-poster.jpg', 'founder-mohamed-erassas.jpg'];
for (const [name, path] of BOOKING_PAGES) {
  const h = readFileSync(path, 'utf8');
  const video = (h.match(/<video id="explainer-video"[^>]*>/) || [''])[0];
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
  const videoLd = ld.find((o) => o && o['@type'] === 'VideoObject');
  const a = h.indexOf('const T = {');
  const T = eval('(' + h.slice(a + 'const T = '.length, h.indexOf('\n};', a) + 2) + ')');
  const founderCopy = ['en', 'de', 'ar'].flatMap((l) => Object.entries(T[l]).filter(([k]) => k.startsWith('founder.')).map(([, v]) => v));

  report(name, {
    'genau ein Erklärvideo': (h.match(/id="explainer-video"/g) || []).length === 1,
    'Video lädt erst beim Klick (preload="none", kein autoplay)':
      video.includes('preload="none"') && !video.includes('autoplay'),
    'Video, Poster und Gründerfoto liegen in /media': MEDIA.every((f) => existsSync(join(ROOT, 'media', f))),
    'VideoObject-JSON-LD mit Dauer und Datei':
      !ld.includes(null) && videoLd !== undefined && videoLd.duration === 'PT1M17S' &&
      videoLd.contentUrl === 'https://hybote.ai/media/hybote-explainer-en.mp4',
    // Neuaufbau 10/2026: das Video gehört zum Live-Beispiel, zwischen Demo und Leistungen
    'Erklärvideo steht im Live-Beispiel':
      h.indexOf('id="beispiele"') !== -1 &&
      h.indexOf('id="beispiele"') < h.indexOf('id="video"') && h.indexOf('id="video"') < h.indexOf('id="leistungen"'),
    'genau eine Gründer-Sektion mit Foto':
      (h.match(/id="ueber-uns"/g) || []).length === 1 && h.includes('src="/media/founder-mohamed-erassas.jpg"'),
    'Gründer-Sektion steht vor dem FAQ': h.indexOf('id="ueber-uns"') < h.indexOf('id="faq"'),
    'Gründer-Texte in EN, DE und AR': ['en', 'de', 'ar'].every((l) => T[l]['founder.p1'] && T[l]['video.h2']),
    // Freigegebene Formulierung (Mohamed, 16.10.2026): "über ein Jahrzehnt in der gehobenen
    // und namhaften Hotellerie". "Zehn Jahre Fünf-Sterne-Hotellerie" ist falsch.
    'Gründer-Fakt: über ein Jahrzehnt, gehobene Hotellerie':
      /over a decade/.test(T.en['founder.p1']) && /ein Jahrzehnt/.test(T.de['founder.p1']) && /عقد/.test(T.ar['founder.p1']) &&
      !founderCopy.some((v) => /\bten years|zehn jahre|five-star hotels|fünf-sterne-hotels|fünf-sterne-hotellerie tätig/i.test(v)),
  });
}

/* ── Startseite ─────────────────────────────────────────────────────────── */
console.log('\nStartseite');
{
  const h = readFileSync(join(ROOT, 'index.html'), 'utf8');

  // T-Dictionary auswerten, um EN/DE/AR gegeneinander zu prüfen
  const a = h.indexOf('const T = {');
  const b = h.indexOf('\n};', a);
  const T = eval('(' + h.slice(a + 'const T = '.length, b + 2) + ')');
  const enKeys = Object.keys(T.en);

  // Doppelte Keys überschreibt das Objektliteral stillschweigend (der spätere gewinnt).
  // Zeilenweise zählen, damit kein toter Alt-Eintrag neben dem gültigen stehen bleibt.
  const dupes = [];
  {
    let lang = null;
    const seen = {};
    for (const line of h.slice(a, b).split('\n')) {
      const m = /^  (de|en|ar): \{$/.exec(line);
      if (m) { lang = m[1]; seen[lang] = new Set(); continue; }
      const k = /^    "([^"]+)": /.exec(line);
      if (lang && k) { if (seen[lang].has(k[1])) dupes.push(`${lang}:${k[1]}`); seen[lang].add(k[1]); }
    }
  }
  if (dupes.length) console.log('     doppelte Keys:', dupes.join(', '));
  const used = [...new Set([...h.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]))];

  // Inline-Defaults müssen dem englischen Wörterbuch entsprechen, sonst blitzt beim Laden anderer Text auf
  const norm = (x) => x.replace(/\s+/g, ' ').trim();
  const escapeRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const inlineMismatches = [];
  for (const key of used) {
    const re = new RegExp(`<([a-zA-Z0-9]+)\\b[^>]*\\bdata-i18n="${escapeRe(key)}"[^>]*>([\\s\\S]*?)</\\1>`, 'g');
    for (const m of h.matchAll(re)) {
      if (T.en[key] !== undefined && norm(m[2]) !== norm(T.en[key])) inlineMismatches.push(key);
    }
  }
  if (inlineMismatches.length) console.log('     abweichende Inline-Defaults:', [...new Set(inlineMismatches)].join(', '));

  // FAQ-Strukturdaten: so viele Fragen wie in der sichtbaren FAQ
  const faqLd = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]))
    .find((o) => o['@type'] === 'FAQPage');

  // Selbst gehostete Schriften: jede url() in fonts.css muss auf eine vorhandene Datei zeigen
  const fontCss = readFileSync(join(ROOT, 'fonts', 'fonts.css'), 'utf8');
  const fontFiles = [...fontCss.matchAll(/url\("\/(fonts\/[^"]+)"\)/g)].map((m) => m[1]);

  // Jeder Seitenanker braucht ein Ziel, sonst springt ein Nav- oder CTA-Link ins Leere
  const ids = new Set([...h.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const deadAnchors = [...new Set([...h.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]))].filter((a) => !ids.has(a));
  if (deadAnchors.length) console.log('     Anker ohne Ziel:', deadAnchors.join(', '));

  // Reihenfolge der Abschnitte (Argument der Seite); #kunden ist optional
  const order = ['beispiele', 'leistungen', 'ueber-uns', 'kunden', 'faq', 'kontakt']
    .map((id) => h.indexOf(`<section id="${id}"`))
    .filter((pos) => pos !== -1);

  report('index.html', {
    'DE vollständig gegenüber EN': enKeys.every((k) => T.de[k] !== undefined),
    'AR vollständig gegenüber EN': enKeys.every((k) => T.ar[k] !== undefined),
    'keine doppelten Keys im Wörterbuch': dupes.length === 0,
    'keine verwaisten DE-Keys': Object.keys(T.de).every((k) => T.en[k] !== undefined),
    'keine verwaisten AR-Keys': Object.keys(T.ar).every((k) => T.en[k] !== undefined),
    'jedes data-i18n hat einen Eintrag': used.every((k) => T.en[k] !== undefined),
    'genau ein Analytics-Tag': (h.match(/_vercel\/insights/g) || []).length === 1,
    'jede Datei aus fonts.css existiert': fontFiles.length > 0 && fontFiles.every((f) => existsSync(join(ROOT, f))),
    'lädt die lokalen Schriften, kein Google Fonts':
      h.includes('<link href="/fonts/fonts.css" rel="stylesheet" />') && !/fonts\.(googleapis|gstatic)\.com/.test(h),
    'Inline-Defaults entsprechen T.en': inlineMismatches.length === 0,
    'FAQ-JSON-LD hat so viele Fragen wie die FAQ':
      faqLd !== undefined && faqLd.mainEntity.length === (h.match(/class="faq-q"/g) || []).length,
    'keine Verweise auf die entfernten Branchenseiten':
      REMOVED_SLUGS.every((s) => !h.includes(`href="/${s}"`)) && !h.includes('case-link'),
    'jeder Seitenanker hat ein Ziel': deadAnchors.length === 0,
    'Redirect-Ziel #beispiele vorhanden': h.includes('<section id="beispiele"'),
    'Abschnitte in der vorgesehenen Reihenfolge':
      order.length >= 5 && order.every((pos, i) => i === 0 || order[i - 1] < pos),
    'weißes Logo im Header': h.includes('src="/logo-mobile-white.png"'),
    // Schlanke Seite: kein Tailwind-CDN, kein Spline-Roboter, kein Three.js-Terrain mehr
    'keine schweren Fremdbibliotheken':
      !/cdn\.tailwindcss\.com|splinetool|spline-viewer|three@|three\.module/i.test(h),
  });
  console.log(`     i18n-Keys je Sprache: ${enKeys.length}`);
}

/* ── CI-Textregeln (Corporate Identity v3, Stand 10/2026) ───────────────── */
console.log('\nCI-Textregeln');
for (const [name, path] of BOOKING_PAGES) {
  const h = readFileSync(path, 'utf8');
  const a = h.indexOf('const T = {');
  const b = h.indexOf('\n};', a);
  const T = eval('(' + h.slice(a + 'const T = '.length, b + 2) + ')');
  // sichtbarer Text: alle Wörterbuch-Werte aller Sprachen, ohne HTML-Tags
  const copy = ['en', 'de', 'ar'].flatMap((l) => Object.values(T[l])).map((v) => v.replace(/<[^>]*>/g, ' '));
  const hits = (re) => copy.filter((v) => re.test(v));

  report(name, {
    'keine Gedankenstriche': hits(/—/).length === 0,
    'keine Ausrufezeichen': hits(/!/).length === 0,
    'keine Emojis': hits(/\p{Emoji_Presentation}/u).length === 0,
    'kein Audit oder Assessment als Angebot': hits(/\baudit|assessment/i).length === 0,
    'keine verbotenen Meta-Formulierungen':
      hits(/meta[- ]partner|official partner|offizieller partner|meta verified|powered by meta/i).length === 0,
    'alter Slogan "Hospitality Meets AI" nirgends': !/Hospitality Meets AI/i.test(h),
    // Formsprache: keine Schlagschatten, kein Gold (seit CI v3), Blur nur auf Overlays
    'keine Schlagschatten': !/box-shadow|drop-shadow/.test(h),
    'kein Gold mehr (CI v3)': !/c9a053|e8c47a|fff6e2/i.test(h),
    'Blur nur auf Header und Cookie-Banner':
      h.split('\n').filter((l) => /backdrop-filter/.test(l)).every((l) => l.includes('id="nav"') || l.includes('id="cookie-banner"')),
    'kein Gold-Token mehr im CSS': !/var\(--gold|var\(--teal/.test(h),
    // Trustpilot-Markenrichtlinien: keine nachgebauten Sterne oder TrustScores; Kundenstimmen
    // nur mit Link zum Profil und Echtheitshinweis (§ 5b Abs. 3 UWG) direkt daneben.
    'keine nachgebauten Bewertungssterne': !/★|☆|trustscore/i.test(h),
    'Kundenstimmen mit Trustpilot-Link und Echtheitshinweis':
      !h.includes('id="kunden"') ||
      (h.includes('href="https://www.trustpilot.com/review/hybote.ai"') && T.en['kunden.note'] !== undefined),
  });
}

/* ── Rechtstextseiten und gemeinsame CI ────────────────────────────────── */
console.log('\nRechtstextseiten');
{
  const terms = readFileSync(join(ROOT, 'agb.html'), 'utf8');
  const privacy = readFileSync(join(ROOT, 'datenschutz.html'), 'utf8');
  const css = readFileSync(join(ROOT, 'legal.css'), 'utf8');
  const legalPages = [terms, privacy];
  const combined = legalPages.join('\n') + css;

  report('AGB + Datenschutz + legal.css', {
    'beide Seiten verwenden die gemeinsame CI-Datei':
      legalPages.every((h) => h.includes('<link rel="stylesheet" href="legal.css" />')),
    'Mitternachtsblau und Flächenhierarchie vollständig':
      ['#070b16', '#0c1222', '#131b30', '#1c2740'].every((token) => css.includes(token)),
    'Cyan ist der einzige Akzent':
      ['#38bdf8', '#7dd3fc', '#0ea5e9'].every((token) => css.includes(token)) &&
      !/gold|#c9a053|#e8c47a|#fff6e2|201\s*,\s*160\s*,\s*83/i.test(combined),
    'aktuelle Typografie geladen (selbst gehostet)':
      legalPages.every((h) => h.includes('<link href="/fonts/fonts.css" rel="stylesheet" />')) &&
      legalPages.every((h) => !/fonts\.(googleapis|gstatic)\.com/.test(h)) &&
      css.includes("'Cormorant Garamond', serif") &&
      css.includes("'Montserrat', sans-serif") &&
      css.includes("'Cairo', sans-serif"),
    'mobile Headerhöhe und Logo der Rechtstextseiten unverändert':
      css.includes('height: 112px;') &&
      legalPages.every((h) => h.includes('srcset="logo-mobile-white.png"')),
    'EN, AR und DE auf beiden Seiten schaltbar':
      legalPages.every((h) =>
        ['en', 'ar', 'de'].every((lang) =>
          h.includes(`data-lang="${lang}"`) && h.includes(`${lang}: {`)
        )
      ),
    'RTL-Layout und arabischer Font vorhanden':
      css.includes("html[dir='rtl']") && legalPages.every((h) => h.includes("dir: 'rtl'")),
    'Sprachwahl meldet aktiven Zustand barrierearm':
      legalPages.every((h) => h.includes("setAttribute('aria-pressed'")),
    'AGB in allen drei Sprachen vollständig': (terms.match(/<h2>/g) || []).length === 30,
    'Datenschutz in allen drei Sprachen vollständig':
      (privacy.match(/<h2>/g) || []).length === 39,
  });
}

/* ── Sitemap, Redirects und Datenschutz ────────────────────────────────────────────── */
console.log('\nWeitere Dateien');
{
  const sm = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  const ds = readFileSync(join(ROOT, 'datenschutz.html'), 'utf8');
  const connect = readFileSync(join(ROOT, 'meta-connect.html'), 'utf8');
  const connectJs = readFileSync(join(ROOT, 'meta-connect.js'), 'utf8');
  const completeApi = readFileSync(join(ROOT, 'api/meta/complete.js'), 'utf8');
  const webhookApi = readFileSync(join(ROOT, 'api/meta/webhook.js'), 'utf8');
  // Nur der Code, ohne Kommentare: sonst schlägt die Prüfung auf genau der
  // Zeile an, die erklärt, warum es diese Prüfung gibt.
  const webhookCode = webhookApi.split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
  report('sitemap.xml + datenschutz.html', {
    'entfernte Branchenseiten nicht in der Sitemap':
      REMOVED_SLUGS.every((s) => !sm.includes(`https://hybote.ai/${s}`)),
    'entfernte Branchenseiten leiten dauerhaft um':
      REMOVED_SLUGS.every((s) => (vercel.redirects || []).some(
        (r) => r.source === `/${s}` && r.destination === '/#beispiele' && r.permanent === true
      )) && REMOVED_SLUGS.every((s) => !existsSync(join(ROOT, s))),
    'Analytics in allen drei Sprachblöcken der Datenschutzerklärung':
      (ds.match(/Vercel Web Analytics/g) || []).length === 3,
    'Calendly-Datenschutzhinweis in allen drei Sprachblöcken':
      (ds.match(/calendly\.com\/legal\/privacy-notice/g) || []).length === 3,
    'Calendly-DPA in allen drei Sprachblöcken':
      (ds.match(/calendly\.com\/legal\/data-processing-addendum/g) || []).length === 3,
    'Teams-Übergabe in allen drei Sprachblöcken':
      (ds.match(/Microsoft(?:-| )Teams/g) || []).length >= 3,
  });
  // Der translations-Block ist ein Objektliteral ohne Code – auswertbar wie das
  // Sprachobjekt der Hauptseite.
  const translationsMatch = connectJs.match(/const translations = (\{[\s\S]*?\n  \});\n\n  const ERROR_KEYS/);
  let connectLanguages = {};
  try { connectLanguages = translationsMatch ? eval(`(${translationsMatch[1]})`) : {}; } catch (_error) { connectLanguages = {}; }
  const connectLanguageKeys = Object.keys(connectLanguages.en || {});
  const inviteApi = readFileSync(join(ROOT, 'api/meta/_invite.js'), 'utf8');
  report('Meta Embedded Signup', {
    'Onboarding-Seite ist nicht indexierbar': connect.includes('content="noindex, nofollow"'),
    'offizielle Meta App-ID gesetzt': connectJs.includes("const META_APP_ID = '1580264870470342'"),
    'Konfigurations-ID ist eine numerische Meta-ID': /const META_CONFIG_ID = '\d{10,20}'/.test(connectJs),
    // v4: Version und Session-Info kommen aus der Konfiguration, ein Parameter
    // dafuer darf nicht mehr auftauchen.
    'kein sessionInfoVersion mehr (Embedded Signup v4)': !connectJs.includes('sessionInfoVersion'),
    'Coexistence-Feature-Typ an genau einer Stelle definiert':
      connectJs.includes("const COEXISTENCE_FEATURE_TYPE = 'whatsapp_business_app_onboarding'") &&
      connectJs.includes('featureType: COEXISTENCE_FEATURE_TYPE'),
    'Coexistence-Abschlussevent wird verarbeitet': connectJs.includes("'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'"),
    'Vorbefuellung aus dem Einladungs-Token': connectJs.includes('setup: {') && connectJs.includes('business: {'),
    'fuenf Sprachen mit identischem Schluesselumfang':
      ['en', 'ar', 'de', 'ru', 'fr'].every((lang) =>
        connectLanguages[lang] && connectLanguageKeys.length >= 40 &&
        connectLanguageKeys.every((key) => typeof connectLanguages[lang][key] === 'string') &&
        connect.includes(`data-set-lang="${lang}"`) && connectJs.includes(`${lang}: '${lang}_`)
      ),
    'Sprache aus dem Token ist der Standard der Seite':
      connectJs.includes('invite.language') && inviteApi.includes("INVITE_LANGUAGES = ['en', 'de', 'ar', 'ru', 'fr']"),
    'Code-Austausch findet ausschließlich serverseitig statt':
      completeApi.includes('META_APP_SECRET') && !connectJs.includes('META_APP_SECRET'),
    'Coexistence-Sync fordert Kontakte und Verlauf getrennt an':
      completeApi.includes("'smb_app_state_sync', 'history'") && completeApi.includes('sync_type: syncType'),
    'Nummer wird bei Coexistence aus der WABA aufgeloest': completeApi.includes('resolvePhoneNumberId('),
    'Mandantenschluessel kommt aus dem Token': completeApi.includes('invite.tenantKey'),
    'n8n-Anbindung nutzt einen eingeschränkten API-Schlüssel':
      completeApi.includes("'X-N8N-API-KEY'") && completeApi.includes('ensureWhatsAppCredential'),
    'Erneute Autorisierung aktualisiert das verschlüsselte Credential':
      completeApi.includes("method: 'PATCH'") && completeApi.includes('credentials/${existing.id}'),
    'Tokens werden nicht in der Mandantentabelle gespeichert':
      completeApi.includes("status: 'connected_pending_provisioning'") &&
      !completeApi.slice(completeApi.indexOf('tenant: {'), completeApi.indexOf('});', completeApi.indexOf('tenant: {'))).includes('accessToken'),
    'Mandanten-IDs werden gemeinsam übergeben':
      ['businessId', 'wabaId', 'phoneNumberId', 'customerReference'].every((key) => completeApi.includes(key)),
  });
  report('Meta Webhook', {
    'Signatur wird zeitkonstant über HMAC-SHA256 geprüft':
      webhookApi.includes("createHmac('sha256'") && webhookApi.includes('timingSafeEqual'),
    'Rohbody wird als Stream gelesen':
      webhookApi.includes("request.on('data'") && webhookApi.includes("request.on('end'"),
    // Der eigentliche Regressionsschutz: eine neu serialisierte Nutzlast
    // reproduziert Metas Bytes nicht, die Signaturprüfung würde sporadisch scheitern.
    'die geparste Nutzlast wird nirgends neu serialisiert':
      !webhookCode.includes('request.body') && !webhookCode.includes('JSON.stringify(body)'),
    'kein for-await auf dem Request':
      !/for\s+await\s*\([^)]*\bof\s+request\b/.test(webhookApi),
    'Weiterleitung nutzt einen eigenen Header, nicht den Public-API-Schlüssel':
      webhookApi.includes('N8N_WEBHOOK_AUTH_VALUE') && webhookApi.includes('N8N_WHATSAPP_WEBHOOK_URL'),
    'ungültige Signatur wird nicht weitergeleitet':
      webhookCode.indexOf("'SIGNATURE_INVALID'") < webhookCode.indexOf('await forwardToN8n('),
    'Verify-Token wird zeitkonstant verglichen':
      webhookApi.includes('safeEqual(token, config.verifyToken)'),
  });
}

console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen.\n` : '\nAlles in Ordnung.\n');
process.exit(failures ? 1 : 0);
