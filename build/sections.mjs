// Rendert die Abschnitte einer Branchen-Landingpage.
//
// Jeder Textbaustein in den Seiten-Konfigurationen ist ein Objekt {en, de, ar}.
// Aus derselben Konfiguration entstehen hier zwei Dinge gleichzeitig: das HTML
// (mit englischem Inline-Default, wie auf der Startseite) und die Ergänzungen
// für das T-Dictionary. Damit können EN, DE und AR nicht auseinanderlaufen.
//
// Es kommen ausschliesslich bestehende CSS-Klassen aus index.html zum Einsatz:
// sec-label, t-display, t-h2, t-h3, t-body, t-small, t-label, prob-card,
// card-filled, step-num, btn-dark, btn-outline, grad-text, dot-live, reveal, rule.

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

  </div>
</section>

<hr class="rule" />`;
}

/* ── Problem: drei konkrete Situationen aus dem Alltag der Branche ──────── */
function problem(c, { A, E }) {
  const cards = c.problem.items
    .map(
      (_, i) => `
      <div class="reveal prob-card" style="${delay(i * 80)}">
        <div style="font-family:'Montserrat',sans-serif;font-weight:200;font-size:2.5rem;color:rgba(56,189,248,0.45);margin-bottom:20px;line-height:1;">0${i + 1}</div>
        <h3 class="t-h3" style="margin-bottom:12px;" ${A(`problem.items.${i}.t`)}>${E(`problem.items.${i}.t`)}</h3>
        <p class="t-body" style="font-size:0.83rem;" ${A(`problem.items.${i}.d`)}>${E(`problem.items.${i}.d`)}</p>
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

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1px;background:var(--line);">
${cards}
    </div>
  </div>
</section>

<hr class="rule" />`;
}

/* ── Die Rechnung: der Case aus #assessment, aufgeklappt ────────────────── */
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

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1px;background:var(--line);">

      <div class="card-filled reveal" style="padding:40px;display:flex;flex-direction:column;background:linear-gradient(160deg,rgba(56,189,248,0.10) 0%,rgba(255,255,255,0.04) 60%);border:1px solid rgba(56,189,248,0.45);">
        <div style="font-family:'Montserrat',sans-serif;font-weight:400;font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:18px;" ${A('math.tag')}>${E('math.tag')}</div>
        <p class="t-body" style="font-size:0.83rem;margin-bottom:26px;" ${A('math.setup')}>${E('math.setup')}</p>

        <div style="border-top:1px solid var(--line);padding-top:20px;display:flex;flex-direction:column;gap:12px;margin-bottom:26px;">
${rows}
        </div>

        <div style="margin-top:auto;border-top:1px solid var(--line);padding-top:24px;">
          <div class="t-label" style="color:var(--a3);margin-bottom:8px;" ${A('math.yearLabel')}>${E('math.yearLabel')}</div>
          <div style="font-family:'Montserrat',sans-serif;font-weight:200;font-size:clamp(1.9rem,3.4vw,2.6rem);letter-spacing:-0.03em;color:var(--gold);line-height:1.05;" ${A('math.year')}>${E('math.year')}</div>
        </div>
      </div>

      <div class="card-filled reveal" style="padding:40px;display:flex;flex-direction:column;transition-delay:80ms;">
        <div style="font-family:'Montserrat',sans-serif;font-weight:400;font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold);margin-bottom:18px;" ${A('math.howTag')}>${E('math.howTag')}</div>
        <p class="t-body" style="font-size:0.83rem;margin-bottom:20px;" ${A('math.how')}>${E('math.how')}</p>
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
  const items = c.caps.items
    .map(
      (_, i) => `
      <div class="reveal prob-card" style="${delay(i * 60)}">
        <h3 class="t-h3" style="margin-bottom:12px;" ${A(`caps.items.${i}.t`)}>${E(`caps.items.${i}.t`)}</h3>
        <p class="t-body" style="font-size:0.83rem;" ${A(`caps.items.${i}.d`)}>${E(`caps.items.${i}.d`)}</p>
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

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1px;background:var(--line);">
${items}
    </div>
  </div>
</section>

<hr class="rule" />`;
}

/* ── Ablauf ─────────────────────────────────────────────────────────────── */
function process(c, { A, E }) {
  const last = c.process.steps.length - 1;
  const steps = c.process.steps
    .map(
      (_, i) => `
      <div class="reveal" style="display:grid;grid-template-columns:56px 1fr;gap:28px;padding:36px 0;${i === last ? '' : 'border-bottom:1px solid var(--line);'}${delay(i * 60)}">
        <div class="step-num">0${i + 1}</div>
        <div style="padding-top:10px;">
          <h3 style="font-family:'Montserrat',sans-serif;font-weight:300;font-size:1.05rem;color:var(--fg);margin-bottom:10px;" ${A(`process.steps.${i}.t`)}>${E(`process.steps.${i}.t`)}</h3>
          <p style="font-family:'Montserrat',sans-serif;font-weight:300;font-size:0.83rem;color:var(--a3);line-height:1.8;" ${A(`process.steps.${i}.d`)}>${E(`process.steps.${i}.d`)}</p>
        </div>
      </div>`
    )
    .join('\n');

  return `
<section id="ablauf" style="padding:100px 32px;background:transparent;position:relative;overflow:hidden;">
  <div style="position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 60% 50% at 80% 50%,rgba(56,189,248,0.04) 0%,transparent 60%);z-index:0;"></div>
  <div style="max-width:900px;margin:0 auto;position:relative;z-index:1;">

    <div style="margin-bottom:64px;">
      <div class="sec-label reveal"><span ${A('process.label')}>${E('process.label')}</span></div>
      <h2 class="t-h2 reveal" style="max-width:540px;" ${A('process.h2')}>${E('process.h2')}</h2>
    </div>

    <div style="display:flex;flex-direction:column;gap:0;border-top:1px solid var(--line);">
${steps}
    </div>
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
