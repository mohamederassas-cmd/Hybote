// Prüft die erzeugten Landingpages, ohne einen Browser zu starten.
//
//   node build/verify.mjs
//
// Ergänzt die Hüllen-Prüfung im Generator: dort geht es darum, dass die Optik
// zeichengleich übernommen wurde, hier darum, dass Pfade, Meta-Angaben und
// die FAQ-Nummerierung stimmen. Beides zusammen läuft in Sekunden und lohnt
// sich vor jedem Deploy.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLUGS = ['real-estate', 'car-dealerships', 'medical-practices'];
const BOOKING_PAGES = [
  ['index.html', join(ROOT, 'index.html')],
  ...SLUGS.map((slug) => [`${slug}/index.html`, join(ROOT, slug, 'index.html')]),
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

/* ── Landingpages ───────────────────────────────────────────────────────── */
console.log('\nLandingpages');
for (const slug of SLUGS) {
  const h = readFileSync(join(ROOT, slug, 'index.html'), 'utf8');
  const base = `https://hybote.ai/${slug}`;

  report(slug, {
    'canonical zeigt auf die Seite': h.includes(`<link rel="canonical" href="${base}" />`),
    'og:url zeigt auf die Seite': h.includes(`<meta property="og:url" content="${base}" />`),
    'hreflang de/ar/x-default gesetzt':
      h.includes(`hreflang="de" href="${base}?lang=de"`) &&
      h.includes(`hreflang="ar" href="${base}?lang=ar"`) &&
      h.includes(`hreflang="x-default" href="${base}"`),
    'eigener Title (nicht der Startseiten-Title)':
      !h.includes('<title>HYBOTE | The Future Runs On Its Own</title>'),
    'keine relativen Asset-Pfade': !h.includes('src="logo.png"'),
    'keine relativen Legal-Links': !/href="(datenschutz|agb|danke)\.html/.test(h),
    'Danke-Redirect absolut und mit Quelle':
      h.includes(`'/danke.html?lang=' + currentLang + '&src=${slug}'`),
    'genau ein Analytics-Tag': (h.match(/_vercel\/insights/g) || []).length === 1,
    'drei JSON-LD-Blöcke': (h.match(/application\/ld\+json/g) || []).length === 3,
    'FAQ lückenlos ab 0': Array.from({ length: 6 }, (_, i) => i).every(
      (i) => h.includes(`toggleFaq(${i})`) && h.includes(`id="faq-a-${i}"`)
    ),
    'keine FAQ-Lücke dahinter': !h.includes('toggleFaq(6)'),
    'Formular-Betreff branchenspezifisch':
      /name="subject" value="New HYBOTE Demo Request · /.test(h),
    'Header-CTA bleibt auf der Seite': h.includes('href="#kontakt" class="btn-dark"'),
    'Header-Nav führt zur Startseite': h.includes('href="/#problem"'),
    'mobiles weißes Logo vorhanden': h.includes('srcset="/logo-mobile-white.png"'),
    'mobiler Header auf 112 px begrenzt':
      h.includes('@media (max-width: 767px)') && h.includes('height: 112px !important;'),
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
  const used = [...new Set([...h.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]))];

  report('index.html', {
    'DE vollständig gegenüber EN': enKeys.every((k) => T.de[k] !== undefined),
    'AR vollständig gegenüber EN': enKeys.every((k) => T.ar[k] !== undefined),
    'keine verwaisten DE-Keys': Object.keys(T.de).every((k) => T.en[k] !== undefined),
    'keine verwaisten AR-Keys': Object.keys(T.ar).every((k) => T.en[k] !== undefined),
    'jedes data-i18n hat einen Eintrag': used.every((k) => T.en[k] !== undefined),
    'genau ein Analytics-Tag': (h.match(/_vercel\/insights/g) || []).length === 1,
    'drei Verweise aus den Beispielrechnungen':
      SLUGS.every((s) => h.includes(`href="/${s}" class="case-link"`)),
    'drei Footer-Verweise': SLUGS.every((s) => h.includes(`href="/${s}" style=`)),
    'mobiles weißes Logo vorhanden': h.includes('srcset="/logo-mobile-white.png"'),
    'mobiler Header auf 112 px begrenzt':
      h.includes('@media (max-width: 767px)') && h.includes('height: 112px !important;'),
  });
  console.log(`     i18n-Keys je Sprache: ${enKeys.length}`);
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
    'aktuelle Typografie geladen':
      legalPages.every((h) => h.includes('family=Cormorant+Garamond')) &&
      css.includes("'Cormorant Garamond', serif") &&
      css.includes("'Montserrat', sans-serif") &&
      css.includes("'Cairo', sans-serif"),
    'mobile Headerhöhe und Logo entsprechen der Hauptseite':
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

/* ── Sitemap und Datenschutz ────────────────────────────────────────────── */
console.log('\nWeitere Dateien');
{
  const sm = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
  const ds = readFileSync(join(ROOT, 'datenschutz.html'), 'utf8');
  report('sitemap.xml + datenschutz.html', {
    'alle drei Seiten in der Sitemap':
      SLUGS.every((s) => sm.includes(`<loc>https://hybote.ai/${s}</loc>`)),
    'Analytics in allen drei Sprachblöcken der Datenschutzerklärung':
      (ds.match(/Vercel Web Analytics/g) || []).length === 3,
    'Calendly-Datenschutzhinweis in allen drei Sprachblöcken':
      (ds.match(/calendly\.com\/legal\/privacy-notice/g) || []).length === 3,
    'Calendly-DPA in allen drei Sprachblöcken':
      (ds.match(/calendly\.com\/legal\/data-processing-addendum/g) || []).length === 3,
    'Teams-Übergabe in allen drei Sprachblöcken':
      (ds.match(/Microsoft(?:-| )Teams/g) || []).length >= 3,
  });
}

console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen.\n` : '\nAlles in Ordnung.\n');
process.exit(failures ? 1 : 0);
