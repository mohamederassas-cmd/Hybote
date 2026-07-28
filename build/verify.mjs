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
  });
  console.log(`     i18n-Keys je Sprache: ${enKeys.length}`);
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
  });
}

console.log(failures ? `\n${failures} Prüfung(en) fehlgeschlagen.\n` : '\nAlles in Ordnung.\n');
process.exit(failures ? 1 : 0);
