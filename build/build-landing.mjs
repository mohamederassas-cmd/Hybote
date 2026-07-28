// Generiert die Branchen-Landingpages aus index.html.
//
//   node build/build-landing.mjs
//
// Ausgabe: <slug>/index.html — Vercel serviert das statisch unter /<slug>,
// ohne vercel.json und ohne die bestehenden .html-URLs anzufassen.

import { readShell, absolutise, sha } from './shell.mjs';
import { makeDict, renderBody } from './sections.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import realEstate from './pages/real-estate.mjs';
import carDealerships from './pages/car-dealerships.mjs';
import medicalPractices from './pages/medical-practices.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://hybote.ai';
const PAGES = [realEstate, carDealerships, medicalPractices];

const ANALYTICS = '  <!-- Vercel Web Analytics (cookiefrei, keine IP-Speicherung) -->\n' +
                  '  <script defer src="/_vercel/insights/script.js"></script>\n';

/** Ersetzt genau ein Vorkommen. Fehlt es oder gibt es mehrere, bricht der Build ab. */
function once(html, needle, replacement, label) {
  const first = html.indexOf(needle);
  if (first === -1) throw new Error(`[${label}] Vorlage nicht gefunden:\n  ${needle.slice(0, 90)}`);
  if (html.indexOf(needle, first + 1) !== -1) throw new Error(`[${label}] Vorlage kommt mehrfach vor.`);
  return html.slice(0, first) + replacement + html.slice(first + needle.length);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (s) => s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/* ── <head>: Titel, Meta, Canonical, hreflang, Analytics ────────────────── */
function buildHead(head, cfg) {
  const url = `${SITE}/${cfg.slug}`;
  const title = esc(cfg.meta.title.en);
  const desc = esc(cfg.meta.desc.en);
  let h = head;

  h = once(h, '<title>HYBOTE | The Future Runs On Its Own</title>', `<title>${title}</title>`, 'title');

  h = h.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${desc}" />`
  );
  h = h.replace(
    /<meta name="keywords" content="[^"]*" \/>/,
    `<meta name="keywords" content="${esc(cfg.meta.keywords)}" />`
  );

  h = once(h, '<meta property="og:url" content="https://hybote.ai/" />',
    `<meta property="og:url" content="${url}" />`, 'og:url');
  h = once(h, '<meta property="og:title" content="HYBOTE | The Future Runs On Its Own" />',
    `<meta property="og:title" content="${title}" />`, 'og:title');
  h = once(h, '<meta name="twitter:title" content="HYBOTE | The Future Runs On Its Own" />',
    `<meta name="twitter:title" content="${title}" />`, 'twitter:title');

  h = h.replace(/<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${desc}" />`);
  h = h.replace(/<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${desc}" />`);

  // hreflang + canonical zeigen auf diese Seite, nicht mehr auf die Startseite
  h = once(h,
    `  <link rel="alternate" hreflang="en" href="https://hybote.ai/" />
  <link rel="alternate" hreflang="de" href="https://hybote.ai/?lang=de" />
  <link rel="alternate" hreflang="ar" href="https://hybote.ai/?lang=ar" />
  <link rel="alternate" hreflang="x-default" href="https://hybote.ai/" />
  <link rel="canonical" href="https://hybote.ai/" />`,
    `  <link rel="alternate" hreflang="en" href="${url}" />
  <link rel="alternate" hreflang="de" href="${url}?lang=de" />
  <link rel="alternate" hreflang="ar" href="${url}?lang=ar" />
  <link rel="alternate" hreflang="x-default" href="${url}" />
  <link rel="canonical" href="${url}" />`,
    'hreflang/canonical');

  // index.html trägt das Analytics-Script bereits, dann wird es mitkopiert.
  // Fehlt es dort einmal, ergänzen wir es hier, damit keine Seite ohne Messung live geht.
  if (h.includes('/_vercel/insights/script.js')) return h;
  return once(h, '\n</head>', '\n' + ANALYTICS + '</head>', 'analytics');
}

/* ── Kontaktblock: Danke-Redirect und Betreff je Branche ────────────────── */
function buildContact(contact, cfg) {
  let c = contact;
  c = once(c,
    "window.location.href = 'danke.html?lang=' + currentLang;",
    `window.location.href = '/danke.html?lang=' + currentLang + '&src=${cfg.slug}';`,
    'danke-redirect');
  c = once(c,
    '<input type="hidden" name="subject" value="New HYBOTE Demo Request" />',
    `<input type="hidden" name="subject" value="New HYBOTE Demo Request · ${esc(cfg.meta.lead.en)}" />`,
    'form-subject');
  return c;
}

/* ── Seiteneigene i18n-Keys, Titel je Sprache, absolute Legal-Links ─────── */
function buildPageScript(cfg, dict) {
  const titles = JSON.stringify({ en: cfg.meta.title.en, de: cfg.meta.title.de, ar: cfg.meta.title.ar });
  return `<script>
// Seiteneigene Texte. Werden auf das T-Dictionary aus index.html gelegt und
// sofort gerendert: synchron, vor dem ersten Paint, also ohne Flackern.
(function () {
  var PAGE_T = ${JSON.stringify(dict, null, 2)};
  ['en', 'de', 'ar'].forEach(function (l) { Object.assign(T[l], PAGE_T[l]); });

  var TITLES = ${titles};
  var _setLang = window.setLang;
  window.setLang = function (l) {
    _setLang(l);
    // setLang() setzt relative Legal-Links und den Startseiten-Titel.
    // Beides muss hier korrigiert werden, weil die Seite eine Ebene tiefer liegt.
    var lp = document.getElementById('link-privacy'), lt = document.getElementById('link-terms');
    if (lp) lp.href = '/datenschutz.html?lang=' + l;
    if (lt) lt.href = '/agb.html?lang=' + l;
    document.title = TITLES[l] || TITLES.en;
  };
  window.setLang(currentLang);
})();
</script>`;
}

/* ── Structured Data: Breadcrumb, Dienstleistung, Branchen-FAQ ──────────── */
function buildJsonLd(cfg) {
  const url = `${SITE}/${cfg.slug}`;
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'HYBOTE', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: cfg.meta.lead.en, item: url },
    ],
  };
  const service = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: cfg.meta.serviceName.en,
    serviceType: cfg.meta.serviceName.en,
    description: plain(cfg.meta.desc.en),
    provider: { '@type': 'Organization', name: 'HYBOTE', url: SITE },
    areaServed: 'Worldwide',
    audience: { '@type': 'BusinessAudience', name: cfg.meta.lead.en },
    url,
  };
  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: cfg.content.faq.items.map((it) => ({
      '@type': 'Question',
      name: plain(it.q.en),
      acceptedAnswer: { '@type': 'Answer', text: plain(it.a.en) },
    })),
  };
  return [breadcrumb, service, faqPage]
    .map((o) => `<script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n</script>`)
    .join('\n');
}

/* ── Prüfung: trägt die erzeugte Seite die Hülle unverändert? ───────────── */
function verify(html, shell, cfg) {
  const styles = shell.parts.head.match(/<style>[\s\S]*?<\/style>/g) || [];
  if (styles.length !== 2) throw new Error(`Erwartet 2 <style>-Blöcke im <head>, gefunden: ${styles.length}`);

  const musts = [
    ['CSS-Block 1 (Arabisch/Sprachumschalter)', styles[0]],
    ['CSS-Block 2 (CI, Typo, Hintergrund-Layer)', styles[1]],
    ['Hintergrund-Animation', absolutise(shell.parts.background)],
    ['Header', absolutise(shell.parts.header)],
    ['Footer', absolutise(shell.parts.footer)],
    ['FAQ-Optik + toggleFaq', absolutise(shell.parts.faq)],
    ['Scroll-Reveal', absolutise(shell.parts.reveal)],
    ['Cookie-Banner', absolutise(shell.parts.cookie)],
    ['WhatsApp-Button', absolutise(shell.parts.whatsapp)],
  ];

  for (const [label, block] of musts) {
    if (!html.includes(block)) {
      throw new Error(`[${cfg.slug}] Hülle weicht ab: "${label}" steht nicht zeichengleich in der Ausgabe.`);
    }
  }
  return musts.map(([label, block]) => `${label} ${sha(block)}`);
}

/* ── Zusammenbau ────────────────────────────────────────────────────────── */
function buildPage(shell, cfg, siblings) {
  const dict = makeDict(cfg.content);
  const body = renderBody(cfg.content, dict, siblings);

  const html = [
    buildHead(shell.parts.head, cfg),
    '',
    '<body>',
    '',
    absolutise(shell.parts.background),
    '',
    absolutise(shell.parts.header),
    '',
    body,
    '',
    // FAQ-Optik und die toggleFaq-Mechanik, unverändert aus index.html
    absolutise(shell.parts.faq),
    '',
    absolutise(buildContact(shell.parts.contact, cfg)),
    '',
    absolutise(shell.parts.footer),
    '',
    absolutise(shell.parts.reveal),
    '',
    shell.parts.i18n,
    '',
    buildPageScript(cfg, dict),
    '',
    buildJsonLd(cfg),
    '',
    absolutise(shell.parts.logoResize),
    '',
    absolutise(shell.parts.cookie),
    '',
    absolutise(shell.parts.whatsapp),
    '',
    '</body>',
    '</html>',
    '',
  ].join('\n');

  verify(html, shell, cfg);

  const dir = join(ROOT, cfg.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  return { slug: cfg.slug, bytes: html.length, keys: Object.keys(dict.en).length };
}

/* ── Lauf ───────────────────────────────────────────────────────────────── */
const shell = readShell(join(ROOT, 'index.html'));
console.log('Hülle aus index.html gelesen. Prüfsummen der optik-tragenden Teile:');
for (const [k, v] of Object.entries(shell.hashes)) console.log(`  ${k.padEnd(12)} ${v}`);
console.log('');

for (const cfg of PAGES) {
  const siblings = PAGES.filter((p) => p.slug !== cfg.slug);
  const r = buildPage(shell, cfg, siblings);
  console.log(`  ✓ ${r.slug}/index.html   ${(r.bytes / 1024).toFixed(0)} KB, ${r.keys} eigene i18n-Keys, Hülle identisch`);
}
console.log('\nFertig.');
