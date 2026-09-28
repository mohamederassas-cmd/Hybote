// Rendert die Abschnitte einer Branchen-Landingpage.
//
// Jeder Textbaustein in den Seiten-Konfigurationen ist ein Objekt {en, de, ar}.
// Aus derselben Konfiguration entstehen hier zwei Dinge gleichzeitig: das HTML
// (mit englischem Inline-Default, wie auf der Startseite) und die Ergänzungen
// für das T-Dictionary. Damit können EN, DE und AR nicht auseinanderlaufen.
//
// Es kommen ausschliesslich bestehende CSS-Klassen aus index.html zum Einsatz:
// sec-label, t-display, t-h2, t-h3, t-body, t-small, t-label, tile-grid (g-2, g-3, g-6),
// tile, tile--feature, tile-num, tile-figure, process-grid, process-step, btn-dark,
// btn-outline, grad-text, dot-live, reveal, rule.
// Die Kachel-Raster teilen die Kachelzahl gleichmäßig durch die Spaltenzahl (3 → 1,
// 2 → 1, 6 → 3 → 2 → 1), deshalb prüfen die Funktionen unten die Anzahl der Einträge.

const LANGS = ['en', 'de', 'ar'];

const isLeaf = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && LANGS.every((l) => typeof v[l] === 'string');

/** Sammelt alle {en,de,ar}-Blätter unter dotted paths ein, Präfix "lp.". */
export function collect(node, path, dict) {
  if (isLeaf(node)) {
    for (const l of LANGS) dict[l]['lp.' + path] = node[l];
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => collect(v, `${path}.${i}`, dict));
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) collect(v, path ? `${path}.${k}` : k, dict);
  }
}

export function makeDict(cfg) {
  const dict = { en: {}, de: {}, ar: {} };
  collect(cfg, '', dict);
  return dict;
}

/** Erzeugt die Helfer A() für das data-i18n-Attribut und E() für den EN-Default. */
function helpers(dict) {
  const A = (p) => {
    if (dict.en['lp.' + p] === undefined) throw new Error(`i18n-Key fehlt: lp.${p}`);
    return `data-i18n="lp.${p}"`;
  };
  const E = (p) => dict.en['lp.' + p];
  return { A, E };
}

const delay = (ms) => (ms ? `transition-delay:${ms}ms;` : '');

/* ── Hero ───────────────────────────────────────────────────────────────── */
function hero(c, { A, E }) {
  return `
<section style="padding:220px 32px 96px;position:relative;overflow:hidden;">
  <div style="position:absolute;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse 90% 70% at 22% 38%,rgba(56,189,248,0.06) 0%,transparent 60%);"></div>

  <div style="max-width:1100px;margin:0 auto;position:relative;z-index:2;">

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:30px;">
      <span class="dot-live"></span>
      <span class="t-label" ${A('hero.badge')}>${E('hero.badge')}</span>
    </div>

    <div style="font-family:'Montserrat',sans-serif;font-weight:400;font-size:0.65rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--a3);margin-bottom:18px;" ${A('hero.eyebrow')}>${E('hero.eyebrow')}</div>

    <h1 class="t-display" style="font-size:clamp(2.3rem,4.4vw,4rem);margin-bottom:14px;max-width:900px;hyphens:none;overflow-wrap:normal;" ${A('hero.h1')}>${E('hero.h1')}</h1>

    <div class="hero-line" style="height:1px;background:linear-gradient(90deg,#c9a053,#c9a05333,transparent);width:160px;margin-bottom:32px;"></div>

    <p style="font-family:'Montserrat',sans-serif;font-weight:300;font-size:clamp(0.95rem,1.4vw,1.08rem);color:var(--a1);line-height:1.8;max-width:600px;margin-bottom:40px;" ${A('hero.sub')}>${E('hero.sub')}</p>

    <div style="display:flex;flex-wrap:wrap;gap:14px;">
      <a href="#kontakt" class="btn-dark">
        <span ${A('hero.cta1')}>${E('hero.cta1')}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </a>
      <a href="#numbers" class="btn-outline" ${A('hero.cta2')}>${E('hero.cta2')}</a>
    </div>

    <!-- Trust row. hero.trust* are global keys from the shared T dictionary (not lp.* keys),
         so they are written literally instead of going through A()/E(). -->
    <div style="display:flex;flex-wrap:wrap;gap:12px 22px;align-items:center;margin-top:32px;max-width:600px;">
      <span class="t-small" style="display:flex;align-items:center;gap:7px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
        <span data-i18n="hero.trust1">Verified Meta Tech Provider</span>
      </span>
      <span class="t-small" style="display:flex;align-items:center;gap:7px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--a3)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span data-i18n="hero.trust2">GDPR Compliant</span>
      </span>
      <span class="t-small" style="display:flex;align-items:center;gap:7px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--a3)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span data-i18n="hero.trust3">No Commitment</span>
      </span>
      <span class="t-small" style="display:flex;align-items:center;gap:7px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--a3)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span data-i18n="hero.trust4">24/7 Active</span>
      </span>
    </div>

  </div>
</section>

<hr class="rule" />`;
}

/* ── Problem: drei konkrete Situationen aus dem Alltag der Branche ──────── */
function problem(c, { A, E }) {
  if (c.problem.items.length !== 3) throw new Error('problem: genau 3 Einträge erwartet');
  const cards = c.problem.items
    .map(
      (_, i) => `
      <div class="tile reveal" style="${delay(i * 80)}">
        <div class="tile-num">0${i + 1}</div>
        <h3 class="t-h3" ${A(`problem.items.${i}.t`)}>${E(`problem.items.${i}.t`)}</h3>
        <p class="t-body" ${A(`problem.items.${i}.d`)}>${E(`problem.items.${i}.d`)}</p>
      </div>`
    )
    .join('\n');

  return `
<section id="problem" style="padding:100px 32px;">
  <div style="max-width:1100px;margin:0 auto;">

    <div style="max-width:640px;margin-bottom:64px;">
      <div class="sec-label reveal" ${A('problem.label')}>${E('problem.label')}</div>
      <h2 class="t-h2 reveal" style="margin-bottom:20px;" ${A('problem.h2')}>${E('problem.h2')}</h2>
      <p class="t-body reveal" style="transition-delay:60ms;" ${A('problem.sub')}>${E('problem.sub')}</p>
    </div>

    <div class="tile-grid g-3">
${cards}
    </div>
  </div>
</section>

<hr class="rule" />`;
}

/* ── Die Rechnung: der Case aus #beispiele, aufgeklappt ────────────────── */
function numbers(c, { A, E }) {
  const rows = c.math.rows
    .map(
      (_, i) => `
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;">
            <span class="t-small" style="flex:1;" ${A(`math.rows.${i}.k`)}>${E(`math.rows.${i}.k`)}</span>
            <span style="font-family:'Montserrat',sans-serif;font-weight:400;font-size:0.85rem;color:var(--fg);white-space:nowrap;" ${A(`math.rows.${i}.v`)}>${E(`math.rows.${i}.v`)}</span>
          </div>`
    )
    .join('\n');

  return `
<section id="numbers" style="padding:100px 32px;background:transparent;">
  <div style="max-width:1100px;margin:0 auto;">

    <div style="margin-bottom:56px;max-width:640px;">
      <div class="sec-label reveal" ${A('math.label')}>${E('math.label')}</div>
      <h2 class="t-h2 reveal" ${A('math.h2')}>${E('math.h2')}</h2>
      <p class="t-body reveal" style="margin-top:20px;" ${A('math.sub')}>${E('math.sub')}</p>
    </div>

    <div class="tile-grid g-2">

      <div class="tile tile--feature reveal">
        <div style="font-family:'Montserrat',sans-serif;font-weight:400;font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--accent);margin-bottom:18px;" ${A('math.tag')}>${E('math.tag')}</div>
        <p class="t-body" style="margin-bottom:26px;" ${A('math.setup')}>${E('math.setup')}</p>

        <div style="border-top:1px solid var(--line);padding-top:20px;display:flex;flex-direction:column;gap:12px;margin-bottom:26px;">
${rows}
        </div>

        <div style="margin-top:auto;border-top:1px solid var(--line);padding-top:24px;">
          <div class="t-label" style="color:var(--a3);margin-bottom:8px;" ${A('math.yearLabel')}>${E('math.yearLabel')}</div>
          <div class="tile-figure" ${A('math.year')}>${E('math.year')}</div>
        </div>
      </div>

      <div class="tile reveal" style="transition-delay:80ms;">
        <div style="font-family:'Montserrat',sans-serif;font-weight:400;font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--accent);margin-bottom:18px;" ${A('math.howTag')}>${E('math.howTag')}</div>
        <p class="t-body" style="margin-bottom:20px;" ${A('math.how')}>${E('math.how')}</p>
        <div style="margin-top:auto;border-top:1px solid var(--line);padding-top:24px;">
          <p class="t-body" style="font-size:0.8rem;color:var(--a3);"><strong style="font-weight:400;color:var(--fg);" ${A('math.withLabel')}>${E('math.withLabel')}</strong> <span ${A('math.with')}>${E('math.with')}</span></p>
        </div>
      </div>

    </div>

    <p class="t-small reveal" style="text-align:center;margin-top:28px;color:var(--a4);" ${A('math.disclaimer')}>${E('math.disclaimer')}</p>

  </div>
</section>

<hr class="rule" />`;
}

/* ── Fähigkeiten: was HYBOTE in dieser Branche konkret übernimmt ────────── */
function capabilities(c, { A, E }) {
  if (c.caps.items.length !== 6) throw new Error('caps: genau 6 Einträge erwartet (3×2)');
  const items = c.caps.items
    .map(
      (_, i) => `
      <div class="tile reveal" style="${delay(i * 60)}">
        <div class="tile-num">0${i + 1}</div>
        <h3 class="t-h3" ${A(`caps.items.${i}.t`)}>${E(`caps.items.${i}.t`)}</h3>
        <p class="t-body" ${A(`caps.items.${i}.d`)}>${E(`caps.items.${i}.d`)}</p>
      </div>`
    )
    .join('\n');

  return `
<section id="leistungen" style="padding:100px 32px;">
  <div style="max-width:1100px;margin:0 auto;">

    <div style="max-width:640px;margin-bottom:64px;">
      <div class="sec-label reveal" ${A('caps.label')}>${E('caps.label')}</div>
      <h2 class="t-h2 reveal" style="margin-bottom:20px;" ${A('caps.h2')}>${E('caps.h2')}</h2>
      <p class="t-body reveal" style="transition-delay:60ms;" ${A('caps.sub')}>${E('caps.sub')}</p>
    </div>

    <div class="tile-grid g-6">
${items}
    </div>
  </div>
</section>

<hr class="rule" />`;
}

/* ── Ablauf ─────────────────────────────────────────────────────────────── */
function process(c, { A, E }) {
  if (c.process.steps.length !== 4) throw new Error('process: genau 4 Schritte erwartet (4 → 2 → 1)');
  const steps = c.process.steps
    .map(
      (_, i) => `
      <li class="process-step reveal" style="${delay(i * 60)}">
        <div class="tile-num">0${i + 1}</div>
        <h3 class="t-h3" ${A(`process.steps.${i}.t`)}>${E(`process.steps.${i}.t`)}</h3>
        <p class="t-body" ${A(`process.steps.${i}.d`)}>${E(`process.steps.${i}.d`)}</p>
      </li>`
    )
    .join('\n');

  return `
<section id="ablauf" style="padding:100px 32px;background:transparent;position:relative;overflow:hidden;">
  <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 60% 50% at 80% 50%,rgba(56,189,248,0.04) 0%,transparent 60%);z-index:0;"></div>
  <div style="max-width:1100px;margin:0 auto;position:relative;z-index:1;">

    <div style="margin-bottom:56px;">
      <div class="sec-label reveal"><span ${A('process.label')}>${E('process.label')}</span></div>
      <h2 class="t-h2 reveal" style="max-width:540px;" ${A('process.h2')}>${E('process.h2')}</h2>
    </div>

    <ol class="process-grid">
${steps}
    </ol>
  </div>
</section>

<hr class="rule" />`;
}

/* ── Branchen-FAQ. toggleFaq() ist DOM-Positions-basiert: die Indizes
      müssen bei 0 beginnen und lückenlos der DOM-Reihenfolge folgen. ─────── */
function faq(c, { A, E }) {
  const items = c.faq.items
    .map(
      (_, i) => `
      <div class="faq-item reveal" style="${delay(i * 40)}">
        <button class="faq-q" onclick="toggleFaq(${i})" aria-expanded="false">
          <span ${A(`faq.items.${i}.q`)}>${E(`faq.items.${i}.q`)}</span>
          <svg class="faq-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="faq-a" id="faq-a-${i}"><div class="faq-a-inner t-body" ${A(`faq.items.${i}.a`)}>${E(`faq.items.${i}.a`)}</div></div>
      </div>`
    )
    .join('\n');

  return `
<section id="faq" style="padding:100px 32px;">
  <div style="max-width:820px;margin:0 auto;">

    <div style="margin-bottom:64px;">
      <div class="sec-label reveal" ${A('faq.label')}>${E('faq.label')}</div>
      <h2 class="t-h2 reveal" style="max-width:500px;" ${A('faq.h2')}>${E('faq.h2')}</h2>
    </div>

    <div id="faq-list" style="border-top:1px solid var(--line);">
${items}
    </div>
  </div>
</section>

<hr class="rule" />`;
}

/* ── Querverweise auf die Schwesterseiten (interne Verlinkung) ──────────── */
function crossLinks(c, { A, E }, siblings) {
  const links = siblings
    .map(
      (s) =>
        `<a href="/${s.slug}" class="btn-outline" ${A(`cross.${s.slug.replace(/-/g, '_')}`)}>${E(`cross.${s.slug.replace(/-/g, '_')}`)}</a>`
    )
    .join('\n        ');

  return `
<section style="padding:80px 32px;">
  <div style="max-width:1100px;margin:0 auto;text-align:center;">
    <div class="sec-label reveal" style="justify-content:center;" ${A('cross.label')}>${E('cross.label')}</div>
    <div class="reveal" style="display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-top:24px;">
        ${links}
    </div>
  </div>
</section>

<hr class="rule" />`;
}

export function renderBody(cfg, dict, siblings) {
  const h = helpers(dict);
  return [
    hero(cfg, h),
    problem(cfg, h),
    numbers(cfg, h),
    capabilities(cfg, h),
    process(cfg, h),
    faq(cfg, h),
    crossLinks(cfg, h, siblings),
  ].join('\n');
}
