// Prüft die Seiten, ohne einen Browser zu starten.
//
//   node build/verify.mjs
//
// Pfade, Meta-Angaben, i18n-Vollständigkeit und die FAQ-Nummerierung.
// Läuft in Sekunden und lohnt sich vor jedem Deploy.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
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

// Sichtbarer Text einer Seite: ohne Skripte, Styles, Kommentare und Attribute (tel:-Links und aria-label zählen nicht)
const visibleText = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' ');

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
    // Seit 26.10.2026: breit (Kalender und Uhrzeiten nebeneinander) feste Höhe, damit Calendly beim Monatswechsel nicht
    // mitten in der Schiebe-Animation die Größe ändert (Geisterbilder in Chrome); schmal wächst das iframe weiter mit.
    'Advanced Embed: schmal automatische Höhe, breit feste Höhe':
      h.includes('Calendly.initInlineWidget({') && h.includes('resize: !wide') && h.includes('.hybote-calendly-widget.is-fixed { height:'),
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
    // Owner-Freigabe 16.11.2026: Qualifikation als eigene Zeile auf der Gründerkarte, Text bleibt unverändert
    'Gründerkarte nennt die Hotelfachschule Heidelberg (EN, DE, AR)':
      h.includes('data-i18n="founder.cred"') && /Heidelberg/.test(T.en['founder.cred'] || '') &&
      /Hotelfachschule Heidelberg/.test(T.de['founder.cred'] || '') && /هايدلبرغ/.test(T.ar['founder.cred'] || ''),
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
    // Kein Gold als CSS-Farbe (seit CI v3). Die Geschmacksregeln zu Schatten und Blur hat der Owner am
    // 25.10.2026 mit dem Scroll-Film aufgehoben.
    'kein Gold mehr (CI v3)': !/c9a053|e8c47a|fff6e2/i.test(h),
    'kein Gold-Token mehr im CSS': !/var\(--gold|var\(--teal/.test(h),
    // Trustpilot-Markenrichtlinien: keine nachgebauten Sterne oder TrustScores. Kundenstimmen immer mit
    // Echtheitshinweis (§ 5b Abs. 3 UWG) direkt daneben. Seit 26.10.2026 (Owner): freigegebene Stimmen dürfen vor
    // Trustpilot online gehen; sobald die Seite Trustpilot erwähnt, muss das Profil verlinkt sein.
    'keine nachgebauten Bewertungssterne': !/★|☆|trustscore/i.test(h),
    'Kundenstimmen mit Echtheitshinweis': !h.includes('id="kunden"') || T.en['kunden.note'] !== undefined,
    'Trustpilot nur mit Profil-Link':
      // sichtbarer Text und Attribute zählen, Kommentare, Stylesheets und Skripte nicht
      !/trustpilot/i.test(copy.join(' ') + h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '')) ||
      h.includes('href="https://www.trustpilot.com/review/hybote.ai"'),
  });
}

/* ── Startseite „Nacht bis Morgen“: Standbilder statt Scroll-Film (seit 16.11.2026) ─────────── */
// Der Scroll-Film (Bildfolgen, Handy-Film, GSAP/ScrollTrigger/Lenis) ist entfernt: am iPhone ruckelte er oder wirkte
// wie mehrere Videos hintereinander, am Desktop zerrte das Scrollen. Seitdem nur natives Scrollen und Standbilder aus
// build/site-images.mjs; nichts hängt am Scroll, kein Video läuft von selbst.
console.log('\nStartseite: Aufbau und Bilder');
{
  const h = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  const css = (h.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const siteDir = join(ROOT, 'media', 'site');
  const siteFiles = existsSync(siteDir) ? readdirSync(siteDir).filter((f) => !f.startsWith('.')) : [];
  // Jede Bildangabe mit aktuellem Hash (sonst liefert der Jahres-Cache alte Fassungen), keine verwaiste Datei
  const refs = [...h.matchAll(/\/media\/site\/([\w-]+\.(?:webp|mp4))\?v=([0-9a-f]*)/g)];
  const sha = (f) => createHash('sha1').update(readFileSync(join(siteDir, f))).digest('hex').slice(0, 8);
  const staleRefs = refs.filter(([, f, v]) => !existsSync(join(siteDir, f)) || sha(f) !== v).map(([, f]) => f);
  if (staleRefs.length) console.log('     Bild fehlt oder Hash veraltet:', [...new Set(staleRefs)].join(', '), '(node build/site-images.mjs)');
  const referenced = new Set(refs.map(([, f]) => f));
  const orphans = siteFiles.filter((f) => !referenced.has(f));
  if (orphans.length) console.log('     nicht verwendet:', orphans.join(', '));
  // iCloud legt Konfliktkopien an („hero-1920 2.webp“); sie gehören nicht ins Repo
  const copies = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (/ \d+(\.\w+)?$/.test(e.name)) copies.push(join(dir, e.name));
      if (e.isDirectory()) walk(join(dir, e.name));
    }
  };
  walk(join(ROOT, 'media'));
  if (copies.length) console.log('     Konfliktkopien:', copies.slice(0, 5).join(', '));
  const kb = (f) => (existsSync(join(siteDir, f)) ? statSync(join(siteDir, f)).size / 1024 : Infinity);
  const heroImg = (h.match(/<img class="hero-img"[^>]*>/) || [''])[0];
  const pos = (id) => h.indexOf(`<section id="${id}"`);
  const daySections = ['beispiele', 'leistungen', 'ueber-uns', 'kunden', 'faq', 'kontakt'].filter((id) => pos(id) !== -1);
  const logCss = (css.match(/\.log[\s\S]*?(?=\/\* ══ Morgengrauen)/) || [''])[0];
  const waLinks = [...h.matchAll(/href="(https:\/\/wa\.me\/[^"]*|tel:[^"]*)"/g)].map((m) => m[1]);
  const cache = (vercel.headers || []).find((x) => x.source === '/media/site/(.*)');
  const hero = pos('top') === -1 ? '' : h.slice(pos('top'), h.indexOf('</section>', pos('top')));
  const ta = h.indexOf('const T = {');
  const T = eval('(' + h.slice(ta + 'const T = '.length, h.indexOf('\n};', ta) + 2) + ')');
  const LANGS = ['en', 'de', 'ar'];
  const footer = h.slice(h.indexOf('<footer class="footer">'), h.indexOf('</footer>'));
  const scripts = [...h.matchAll(/<script(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');

  report('index.html + media/site', {
    'Bilder vorhanden, Hash aktuell': refs.length > 0 && staleRefs.length === 0,
    'keine verwaisten Bilder in media/site': orphans.length === 0,
    'keine iCloud-Konfliktkopien unter media/': copies.length === 0,
    'Größengrenzen (Hero 1920 höchstens 250 KB, Handy 1080 höchstens 150 KB)': kb('hero-1920.webp') <= 250 && kb('hero-phone-1080.webp') <= 150,
    'Hero-Bild: Quelle für hochkant, sofort geladen, mit Maßen':
      /<source media="\(max-aspect-ratio: 1\/1\)" srcset="\/media\/site\/hero-phone-/.test(h) &&
      heroImg.includes('fetchpriority="high"') && !heroImg.includes('loading="lazy"') && /width="\d+" height="\d+"/.test(heroImg),
    'kein Scroll-Film mehr: keine Bibliotheken, kein Canvas, kein Video mit autoplay':
      !/<canvas|\/vendor\/|gsap|lenis|ScrollTrigger|film-manifest|\/film\//i.test(h) && !/<video[^>]*autoplay/.test(h) &&
      ['film.js', 'film-manifest.js', 'film', 'vendor'].every((p) => !existsSync(join(ROOT, p))),
    'keine Fremdskripte über CDN': !/cdn\.jsdelivr|unpkg\.com|cdnjs|gsap\.com\/|lenis\.darkroom/.test(h),
    'Reihenfolge: Hero, Benchmark, Nachtprotokoll, Morgengrauen vor dem Live-Beispiel':
      pos('top') !== -1 && pos('top') < pos('benchmark') && pos('benchmark') < pos('nacht') && pos('nacht') < pos('morgen') && pos('morgen') < pos('beispiele'),
    'Nachtprotokoll mit fünf Einträgen, Tag-Abschnitte hell':
      (h.match(/<li class="log-row/g) || []).length === 5 &&
      daySections.every((id) => new RegExp(`<section id="${id}" data-theme="day"`).test(h)),
    'kein sticky und keine Rastpunkte im Nachtprotokoll, nirgends scroll-snap': !/sticky/.test(logCss) && !/scroll-snap/.test(h),
    // Owner 16.11.2026: das CSS-Blinzeln wirkte roboterhaft, die Meta-Aussage versteht oben niemand, Kundenlogos sagen
    // GCC-Besuchern nichts. Stattdessen „Founded by a hotelier“ und ein Trustpilot-Link ohne Sterne und Score.
    'Hero ruhig: kein Blinzeln, keine Meta-Aussage, keine Kundenlogos, Trustpilot-Link':
      !/class="blink|\.blink\b|@keyframes blink/.test(h) && !/tech provider|hero-clients|\/media\/kunden\//i.test(hero) &&
      hero.includes('href="https://www.trustpilot.com/review/hybote.ai"') && hero.includes('data-i18n="hero.hotelier"'),
    'Live-Zeile: Uhrzeit und Land (aus der Zeitzone) in EN, DE, AR':
      LANGS.every((l) => /\{time\}/.test(T[l]['hero.status'] || '') &&
        /\{time\}/.test(T[l]['hero.statusPlace'] || '') && /\{place\}/.test(T[l]['hero.statusPlace'] || '')) &&
      h.includes('resolvedOptions().timeZone') && h.includes('Intl.DisplayNames'),
    // Die Fünf-Sterne-Antwort ist sichtbar begründet: drei markierte Stellen, drei Notizen mit derselben Nummer
    'Nachtprotokoll: Antwort mit drei Markierungen und drei Notizen':
      LANGS.every((l) => ((T[l]['night.2.a'] || '').match(/<mark>/g) || []).length === 3 && T[l]['night.2.n3']) &&
      (h.match(/data-i18n="night\.2\.n\d"/g) || []).length === 3,
    'reduzierte Bewegung und ?dev=1 (Standbild für Screenshots)':
      h.includes('@media (prefers-reduced-motion: reduce)') && h.includes("classList.add('still')") && h.includes('.js:not(.still) .reveal'),
    'Hadi: alle WhatsApp- und Telefon-Links auf +1 650 514 6359':
      waLinks.length >= 4 && waLinks.every((u) => /^https:\/\/wa\.me\/16505146359(\?|$)/.test(u) || u === 'tel:+16505146359'),
    'QR-Code führt auf /hadi/': (h.match(/data-qr="https:\/\/hybote\.ai\/hadi\/"/g) || []).length >= 1,
    'Kundenstimmen je mit Trustpilot-Link (neuer Tab, noopener)':
      !h.includes('id="kunden"') ||
      (h.match(/<a class="voice-site" href="https:\/\/www\.trustpilot\.com\/review\/hybote\.ai" target="_blank" rel="noopener"/g) || []).length === (h.match(/<figure class="voice[ "]/g) || []).length,
    '/media/site/ ist ein Jahr im Cache': !!cache && cache.headers.some((x) => /max-age=31536000, immutable/.test(x.value)),
    // Owner 16.11.2026: Footer „viel zu hoch“. Unten nur noch Platz für den Cookie-Hinweis; die Floating Buttons
    // sind über dem Footer aus (html.fabs-off), deshalb kein zusätzlicher Puffer mehr.
    'Footer kompakt: Platz für den Cookie-Hinweis, Floating Buttons über dem Footer aus':
      /\.footer \{[^}]*padding-block:[^;]*calc\(\d{1,2}px \+ var\(--cookie-h, 0px\)\)/.test(css) && !h.includes('calc(120px + var(--cookie-h') &&
      h.includes('html.fabs-off .wa-btn'),
    'Footer mit LinkedIn, Facebook, Instagram, YouTube (neuer Tab, noopener)':
      ['https://www.linkedin.com/in/mohamed-erassas-a83568169/', 'https://www.facebook.com/people/Hybote/61589408136844/',
        'https://www.instagram.com/hyboteai/', 'https://www.youtube.com/@HYBOTE'].every((u) =>
        new RegExp(`<a href="${u.replace(/[.?/]/g, '\\$&')}" target="_blank" rel="noopener" aria-label="`).test(footer)),
    // Owner 16.11.2026: die US-Nummer nicht sichtbar zeigen, nur ein Telefon-Icon (tel:-Link bleibt)
    'US-Nummer nirgends sichtbar (nur tel:-Link hinter einem Icon)': !/650[\s-]?514/.test(visibleText(h)),
    // Owner 16.11.2026: Hadis starrer Frontalblick raus; die Lobby ohne Hadi steht fest, der Inhalt gleitet als Glas darüber
    'feste Bühne: zwei feste Ebenen, per clip-path begrenzt, ohne Scroll-Skript, kein Porträt mehr':
      (h.match(/<div class="stage-bg" aria-hidden="true">/g) || []).length === 2 &&
      /\.stage \{[^}]*clip-path: inset\(0\)/.test(css) && /\.stage-bg \{[^}]*position: fixed/.test(css) &&
      !/stage/.test(scripts) && !/\/media\/site\/hadi-\d+\.webp/.test(h),
    // Owner 16.11.2026: Hadi als kleiner Clip im Morgengrauen und in „Try it yourself“ (alte Film-Clips, Schild entfernt).
    // Kein autoplay und kein Loop: das Skript spielt sie einmal, wenn sie im Bild sind; Endbild für ?dev=1 und reduzierte Bewegung.
    'Hadi-Clips: stumm, playsinline, ohne autoplay/loop, mit Start- und Endbild':
      (h.match(/<video class="hadi-vid"[^>]*>/g) || []).length === 2 &&
      (h.match(/<video class="hadi-vid"[^>]*>/g) || []).every((v) => /\bmuted\b/.test(v) && /\bplaysinline\b/.test(v) &&
        !/autoplay|\bloop\b/.test(v) && /poster="\/media\/site\/hadi-[\w-]+-start\.webp\?v=[0-9a-f]{8}"/.test(v) &&
        /data-end="\/media\/site\/hadi-[\w-]+-end\.webp\?v=[0-9a-f]{8}"/.test(v)),
    'Footer-Logo in normaler Größe': h.includes('class="footer-logo"') && !h.includes('footer-mark'),
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
    // Seit 26.10.2026 (Owner-Wunsch) wie die Startseite: schwebende Glasleiste mit weißer Wortmarke statt hoher Kopfzeile
    'schwebende Glas-Kopfzeile mit weißer Wortmarke':
      css.includes('.site-header .header-inner') && css.includes('backdrop-filter') &&
      legalPages.every((h) => h.includes('srcset="logo-mobile-white.png"') && h.includes('<div class="ambient"')),
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
    // 14 Abschnitte je Sprache seit 31.10.2026 (neu: 6. Verbundene Geschäftskonten, Instagram und E-Mail).
    'Datenschutz in allen drei Sprachen vollständig':
      (privacy.match(/<h2>/g) || []).length === 42,
  });
}

/* ── WhatsApp-Selbsttest (Paket 3f, 26.10.2026) ────────────────────────── */
console.log('\nWhatsApp-Selbsttest');
{
  // Seit 01.11.2026 beantwortet Hadi Anrufe und WhatsApp auf +1 650 514 6359. Die 213er ist Demo-Nummer
  // (ohne Demo antwortet dort auch Hadi) und gehört nicht in die Werbung.
  // wa.me kennt keine UTM, deshalb nennt der vorausgefüllte Text die Quelle.
  for (const [name, source] of [['links/index.html', 'Instagram'], ['benchmark/index.html', 'Benchmark']]) {
    const h = readFileSync(join(ROOT, name), 'utf8');
    report(name, {
      'Knopf zeigt auf die WhatsApp-Nummer, Quelle im Text':
        h.includes(`href="https://wa.me/16505146359?text=Hi%20HYBOTE%20(${source})"`),
      'nie die Demo-Nummer': !h.includes('12134234114') && !/wa\.me\/1?213/.test(h),
    });
  }
}

/* ── Weiterleitung /hadi/ (LinkedIn „Im Fokus“, 05.11.2026) ─────────────── */
console.log('\nWeiterleitung /hadi/');
{
  // LinkedIn lädt für wa.me keine Vorschau; /hadi/ liefert Open Graph mit Hadi-Bild und leitet zu WhatsApp weiter.
  const h = readFileSync(join(ROOT, 'hadi/index.html'), 'utf8');
  const text = h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  report('hadi/index.html', {
    'Knopf zeigt auf Hadis WhatsApp-Nummer, Quelle im Text':
      h.includes('href="https://wa.me/16505146359?text=Hi%20Hadi%20(Website)"') && h.includes("'Hi Hadi (' + label + ')'"),
    'nie die Demo-Nummer': !h.includes('12134234114') && !/wa\.me\/1?213/.test(h),
    'US-Nummer nicht sichtbar (Owner 16.11.2026)': !/650[\s-]?514/.test(visibleText(h)),
    'Vorschaubild mit absoluter Adresse und Datei vorhanden':
      h.includes('<meta property="og:image" content="https://hybote.ai/hadi/og.jpg" />') && existsSync(join(ROOT, 'hadi/og.jpg')),
    'noindex': h.includes('<meta name="robots" content="noindex, follow" />'),
    'ohne canonical und og:url (sonst verliert LinkedIn ?src=)': !h.includes('rel="canonical"') && !h.includes('og:url'),
    'keine Gedankenstriche, keine Ausrufezeichen im Text': !/[—–]/.test(h) && !/!/.test(text.replace(/<!DOCTYPE html>/i, '')),
  });
}

/* ── Demo-Seite /v/<10-Zeichen-Code> (Plan „Demo zuerst“, 03.11.2026) ─── */
console.log('\nDemo-Seite');
{
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
  const rewrites = vercel.rewrites || [];
  const at = (source) => rewrites.findIndex((r) => r.source === source);
  const iOg = at('/v/:code([a-z2-9]{10})/og.jpg');
  const iPage = at('/v/:code([a-z2-9]{10})');
  const iVideo = at('/v/:code');
  const vHeaders = (vercel.headers || []).find((h) => h.source === '/v/(.*)');
  const router = readFileSync(join(ROOT, 'api/connect/[...path].js'), 'utf8');
  const videoView = readFileSync(join(ROOT, 'api/connect/_handlers/video-view.js'), 'utf8');
  const videoPage = readFileSync(join(ROOT, 'v/index.html'), 'utf8');
  const pageSource = readFileSync(join(ROOT, 'api/connect/_handlers/demo-page.js'), 'utf8');
  const ds = readFileSync(join(ROOT, 'datenschutz.html'), 'utf8');
  const demoParagraphs = ['de', 'en', 'ar'].map((l) => (new RegExp(`<p id="demo-${l}">[\\s\\S]*?</p>`).exec(ds) || [''])[0]);
  const { TEXTS } = createRequire(import.meta.url)('../api/connect/_handlers/demo-page.js');
  const copy = ['de', 'en'].flatMap((l) => Object.values(TEXTS[l] || {}));
  // Vercel Hobby: höchstens 12 Functions je Deployment; Dateien und Ordner mit Unterstrich zählen nicht.
  const functions = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) walk(join(dir, entry.name));
      else if (/\.(c|m)?js$/.test(entry.name)) functions.push(join(dir, entry.name));
    }
  };
  walk('api');
  report('vercel.json + api/connect + datenschutz.html', {
    // Reihenfolge zählt: der erste passende Rewrite gewinnt, /v/:code würde die Demo-Codes sonst schlucken.
    'Rewrites für 10-Zeichen-Codes stehen vor /v/:code':
      iOg !== -1 && iPage !== -1 && iVideo !== -1 && iOg < iVideo && iPage < iVideo,
    'Demo-Rewrites gehen an den connect-Router (keine neue Function)':
      rewrites[iOg].destination === '/api/connect/route?__connect=demo-og&code=:code' &&
      rewrites[iPage].destination === '/api/connect/route?__connect=demo-page&code=:code',
    'E-Mail-Video-Seite bleibt bei den 8-Zeichen-Codes':
      rewrites[iVideo] && rewrites[iVideo].destination === '/v/index.html' && videoPage.includes('/^[a-z2-9]{8}$/'),
    '/v/ bleibt noindex': !!vHeaders && vHeaders.headers.some((h) => h.key === 'X-Robots-Tag' && /noindex/.test(h.value)),
    'demo-page und demo-og im Router registriert':
      router.includes("'demo-page': require('./_handlers/demo-page.js')") &&
      router.includes("'demo-og': require('./_handlers/demo-og.js')") &&
      existsSync(join(ROOT, 'api/connect/_handlers/demo-og.js')),
    'höchstens 12 Functions (Vercel Hobby)': functions.length > 0 && functions.length <= 12,
    'video-view nimmt 10-Zeichen-Codes mit den vier Demo-Ereignissen':
      videoView.includes('/^[a-z2-9]{10}$/') && videoView.includes('/^[a-z2-9]{8}$/') &&
      ['demo_open', 'demo_play', 'demo_try', 'demo_book'].every((e) => videoView.includes(`'${e}'`)),
    'Loom erst nach Klick, Seite rendert serverseitig mit Nonce':
      pageSource.includes('data-embed=') && !/<iframe/.test(pageSource) && pageSource.includes("'nonce-${nonce}'"),
    'Ausprobieren standardmäßig bei Hadi, nie die Demo-Nummer':
      pageSource.includes("DEFAULT_TRY_WA = '16505146359'") && !pageSource.includes('12134234114'),
    'Demo-Abschnitte im Datenschutz in allen drei Sprachen':
      ['de', 'en', 'ar'].every((l) => (ds.match(new RegExp(`id="demo-${l}"`, 'g')) || []).length === 1) &&
      demoParagraphs.every((p) => p.includes('Loom') && p.includes('atlassian.com/legal/privacy-policy')),
    'Demo-Abschnitte ohne Gedankenstriche und Ausrufezeichen': demoParagraphs.every((p) => p && !/[—–!]/.test(p)),
    'Demo-Seite verlinkt die passenden Datenschutz-Anker':
      TEXTS.de.privacyHref === '/datenschutz.html?lang=de#demo-de' && TEXTS.en.privacyHref === '/datenschutz.html?lang=en#demo-en',
    'Wörterbuch DE und EN mit gleichen Schlüsseln':
      Object.keys(TEXTS.de).sort().join() === Object.keys(TEXTS.en).sort().join(),
    'Wörterbuch ohne Gedankenstriche': copy.length > 0 && !copy.some((v) => /[—–]/.test(v)),
    'Wörterbuch ohne Ausrufezeichen': !copy.some((v) => v.includes('!')),
    'Wörterbuch ohne Emojis': !copy.some((v) => /\p{Emoji_Presentation}/u.test(v)),
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
    // 31.10.2026: Coexistence ist Standard (auch alte Links ohne wa_mode), nur cloud/Sandbox lassen es weg.
    'Coexistence nur bei wa_mode=cloud oder Sandbox abgeschaltet':
      connectJs.includes("invite.waMode !== 'cloud' && !invite.sandbox") &&
      connectJs.includes('...(useCoexistence() ? { featureType: COEXISTENCE_FEATURE_TYPE } : {})'),
    'Sandbox ueberspringt Registrierung und Coexistence-Sync': (() => { const c = readFileSync(join(ROOT, 'api/meta/complete.js'), 'utf8'); return c.includes("reason: 'SANDBOX'") && c.includes("detail: 'CLOUD_MODE'") })(),
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
