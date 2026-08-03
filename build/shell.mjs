// Schneidet die gemeinsame Hülle aus index.html heraus.
//
// index.html ist die einzige Quelle für CI, Hintergrund-Animation, Header, Footer,
// Cookie-Banner, WhatsApp-Button und das komplette i18n-Dictionary. Hier wird nichts
// nachgebaut, sondern zeichengenau kopiert. Findet ein Marker nicht oder nicht
// eindeutig, bricht der Build ab, statt stillschweigend kaputte Seiten zu schreiben.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

const BAR = '<!-- ══════════════════════════════════════════════════════════';
// Der abschliessende Zeilenumbruch ist nötig: "HERO" wäre sonst auch in
// "HERO ENTRANCE ANIMATION" enthalten und der Marker nicht mehr eindeutig.
const sec = (name) => `${BAR}\n     ${name}\n`;

function at(src, marker, label) {
  const first = src.indexOf(marker);
  if (first === -1) throw new Error(`Marker für "${label}" nicht gefunden:\n  ${JSON.stringify(marker.slice(0, 70))}`);
  if (src.indexOf(marker, first + 1) !== -1) {
    throw new Error(`Marker für "${label}" ist nicht eindeutig:\n  ${JSON.stringify(marker.slice(0, 70))}`);
  }
  return first;
}

/** Alles ab `from` bis (ausschliesslich) `to`. Beide Marker müssen eindeutig sein. */
function between(src, from, to, label) {
  const a = at(src, from, label + ' [Start]');
  const b = at(src, to, label + ' [Ende]');
  if (b <= a) throw new Error(`Slice "${label}": Endmarker liegt vor dem Startmarker.`);
  return src.slice(a, b).trimEnd();
}

/**
 * Macht relative Pfade absolut. Die Landingpages liegen unter /<slug>/index.html,
 * relative Links würden sonst auf /<slug>/datenschutz.html zeigen.
 *
 * `#kontakt` bleibt bewusst relativ: der Buchungsblock existiert auf jeder
 * Landingpage selbst, dorthin soll der Header-CTA springen, nicht zur Startseite.
 * Wird ausschliesslich auf kopierte Hüllen-Slices angewendet, nie auf Seiteninhalt.
 */
export function absolutise(html) {
  return html
    .replace(/src="logo\.png"/g, 'src="/logo.png"')
    .replace(/href="(datenschutz|agb|danke)\.html/g, 'href="/$1.html')
    .replace(/href="#"/g, 'href="/"')
    .replace(/href="#(problem|loesung|leistungen|ablauf|mission|assessment|faq)"/g, 'href="/#$1"');
}

export function readShell(indexPath) {
  const src = readFileSync(indexPath, 'utf8');

  const parts = {
    // <head> inkl. beider <style>-Blöcke: CI-Variablen, Typo, Hintergrund-Layer, Utilities
    head: between(src, '<!DOCTYPE html>', '\n<body>', 'head'),

    // #beams-bg, WebGL-Fallback und das Three.js-Terrain (Desktop) bzw. 2D-Feld (Mobil)
    background: between(src, '<!-- Global animated 3D terrain background', sec('NAVIGATION'), 'background'),

    // Header inkl. Nav-Resize- und Hero-Scroll-Script
    header: between(src, '<header id="nav"', sec('HERO'), 'header'),

    // FAQ-Optik und die toggleFaq-Mechanik. Die trennende <hr> gehört zum
    // Endmarker, damit sie nicht mitkopiert wird: die Landingpage setzt ihre
    // Trennlinien selbst und bekäme sonst zwei direkt hintereinander.
    faq: between(src, '<style>\n  .faq-item {', '<hr class="rule" />\n\n\n' + sec('CONTACT'), 'faq'),

    // Buchungsblock: Calendly-Kalender + Web3Forms-Formular
    contact: between(src, '<section id="kontakt"', sec('FOOTER'), 'contact'),

    // Footer inkl. Grid-Resize-Script
    footer: between(src, '<footer style="background:transparent;padding:60px 32px 40px;', sec('SCROLL REVEAL'), 'footer'),

    // Scroll-Reveal-Observer (.reveal → .in)
    reveal: between(src, sec('SCROLL REVEAL'), sec('STATS COUNT-UP ANIMATION'), 'reveal'),

    // T-Dictionary (de/en/ar), setLang() und die Sprach-Init
    i18n: between(src, sec('TRANSLATIONS / i18n'), '<!-- JSON-LD Structured Data -->', 'i18n'),

    // Logo-Höhe je Viewport
    logoResize: between(src, '<!-- Mobile logo responsive size -->', sec('COOKIE CONSENT BANNER'), 'logo-resize'),

    cookie: between(src, sec('COOKIE CONSENT BANNER'), sec('WHATSAPP FLOATING BUTTON'), 'cookie-banner'),

    // WhatsApp-Button inkl. Style, RTL-Regeln und setLang-Wrapper
    whatsapp: between(src, sec('WHATSAPP FLOATING BUTTON'), '\n</body>', 'whatsapp'),
  };

  // Prüfsummen der optik-tragenden Teile. Der Build vergleicht sie später gegen
  // die erzeugten Seiten: weicht ein Byte ab, ist die Hülle nicht mehr identisch.
  const critical = ['head', 'background', 'header', 'footer', 'faq'];
  const hashes = Object.fromEntries(critical.map((k) => [k, sha(parts[k])]));

  const rewritten = Object.fromEntries(
    Object.entries(parts).map(([k, v]) => [k, absolutise(v)])
  );

  return { raw: src, parts, rewritten, hashes, critical };
}
