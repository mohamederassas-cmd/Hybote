// Demo-Seite /v/<10-Zeichen-Code> (03.11.2026, Plan „Demo zuerst“ Teil 4).
//
//   node --test build/demo-page.test.mjs
//
// Prüft das serverseitige Rendern (Escaping, OG-Angaben, CSP-Nonce, 404 bei zurückgezogenen Seiten, Links), das
// Browser-Skript in einer kleinen Nachbildung (Zwei-Klick-Video, Ereignisse höchstens einmal, Vorschau sendet nichts),
// das Vorschaubild (Loom-GIF wird zum JPEG, nur cdn.loom.com) und die Ereignis-Annahme in video-view.js.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const page = require('../api/connect/_handlers/demo-page.js');
const og = require('../api/connect/_handlers/demo-og.js');
const videoView = require('../api/connect/_handlers/video-view.js');
const router = require('../api/connect/[...path].js');
const demoPages = require('../api/connect/_demoPages.js');

const ROW = {
  code: 'abcdefghjk', status: 'live', lang: 'de', swiss: false, kind: 'broker', company: 'Keller Immobilien AG',
  loom_id: '0281766fa2d04bb788eaf19e65135184',
  loom_thumbnail_url: 'https://cdn.loom.com/sessions/thumbnails/0281766fa2d04bb788eaf19e65135184-00001.gif',
  test_url: '', booking_url: 'https://calendly.com/hybote-demo/free-intro-call?utm_source=hybote_demo&utm_medium=whatsapp&utm_campaign=abcdefghjk',
  try_wa: '16505146359', try_text: '', contact_wa: '', version: 3, updated_at: '2026-11-03T10:00:00.000Z'
};
const NONCE = 'n0nce+/AbC12==';

function render(over = {}, opts = {}) {
  return page.renderDemoPage({ ...ROW, ...over }, { nonce: NONCE, ...opts });
}
function unescapeHtml(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function attrsOf(html, id) {
  const tag = new RegExp(`<\\w+\\b[^>]*\\bid="${id}"[^>]*>`).exec(html);
  if (!tag) return null;
  const attrs = {};
  for (const m of tag[0].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) if (m[1] !== tag[0].slice(1).split(/\s/)[0]) attrs[m[1]] = m[2] === undefined ? '' : unescapeHtml(m[2]);
  return attrs;
}
function meta(html, key) {
  const m = new RegExp(`<meta (?:property|name)="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" content="([^"]*)"`).exec(html);
  return m ? unescapeHtml(m[1]) : null;
}

/** Führt das Inline-Skript der Seite in einer Mini-Nachbildung von document/navigator aus. */
function runScript(html, { hidden = false } = {}) {
  const script = /<script nonce="[^"]*">([\s\S]*?)<\/script>/.exec(html)[1];
  const beacons = [];
  const fetches = [];
  const timers = [];
  const docListeners = {};
  let replaced = null;
  function element(id, attributes) {
    return {
      id, attributes, listeners: {},
      getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attributes, n) ? this.attributes[n] : null; },
      setAttribute(n, v) { this.attributes[n] = v; },
      addEventListener(t, f) { (this.listeners[t] ||= []).push(f); },
      click() { const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; for (const f of this.listeners.click || []) f(e); return e; }
    };
  }
  const elements = {};
  for (const id of ['demo', 'demo-poster', 'demo-try', 'demo-book']) {
    const attrs = attrsOf(html, id);
    if (attrs) elements[id] = element(id, attrs);
  }
  if (elements['demo-poster']) elements['demo-poster'].parentNode = { appendChild(next) { if (replaced) throw new Error('zweites iframe'); replaced = next; } };
  const document = {
    visibilityState: hidden ? 'hidden' : 'visible',
    getElementById: (id) => elements[id] || null,
    addEventListener(t, f) { (docListeners[t] ||= []).push(f); },
    createElement: (tag) => element(tag, {})
  };
  const context = {
    document,
    navigator: { sendBeacon(url, body) { beacons.push({ url, body: JSON.parse(body) }); return true; } },
    fetch: (...args) => { fetches.push(args); return Promise.resolve(); },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    crypto: { randomUUID }
  };
  context.window = context;
  vm.runInNewContext(script, context);
  return {
    elements, beacons, fetches, document, timers,
    replaced: () => replaced,
    flushTimers() { while (timers.length) timers.shift().fn(); },
    setVisibility(state) { document.visibilityState = state; for (const f of docListeners.visibilitychange || []) f(); }
  };
}

test('Firmenname mit <script> wird escaped, auch in Titel und OG', () => {
  const evil = 'Evil <script>alert(1)</script> & "Co" \'x\'';
  const { html, status } = render({ company: evil });
  assert.equal(status, 200);
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(html.includes('Evil &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Co&quot; &#39;x&#39;'));
  assert.equal(meta(html, 'og:title'), `Ihre Demo für ${evil}`);
  // genau zwei Skript-Tags: calendly-popup.js und das eigene Inline-Skript
  assert.equal((html.match(/<script\b/g) || []).length, 2);
});

test('og:image ist absolut, Link-Vorschau vollständig, keine Bildmaße, noindex', () => {
  const { html, headers } = render();
  assert.equal(meta(html, 'og:image'), 'https://hybote.ai/v/abcdefghjk/og.jpg?v=3');
  assert.equal(meta(html, 'twitter:image'), 'https://hybote.ai/v/abcdefghjk/og.jpg?v=3');
  assert.equal(meta(html, 'og:title'), 'Ihre Demo für Keller Immobilien AG');
  assert.equal(meta(html, 'og:type'), 'website');
  assert.equal(meta(html, 'og:url'), 'https://hybote.ai/v/abcdefghjk');
  assert.equal(meta(html, 'twitter:card'), 'summary_large_image');
  assert.ok(meta(html, 'og:description'));
  assert.equal(meta(html, 'og:image:width'), null);
  assert.ok(html.includes('<meta name="robots" content="noindex, nofollow" />'));
  assert.equal(headers['X-Robots-Tag'], 'noindex, nofollow');
  assert.match(headers['Cache-Control'], /no-store/);
  assert.ok(html.includes('<title>Ihre Demo für Keller Immobilien AG</title>'));
  const en = render({ lang: 'en' }).html;
  assert.equal(meta(en, 'og:title'), 'Your demo for Keller Immobilien AG');
  assert.ok(en.includes('<html lang="en">'));
});

test('Nonce im CSP ist die Nonce des Inline-Skripts, CSP erlaubt nur Loom und Calendly', () => {
  const { html, headers } = render();
  const csp = headers['Content-Security-Policy'];
  const cspNonce = /'nonce-([^']+)'/.exec(csp)[1];
  assert.equal(cspNonce, NONCE);
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)];
  assert.equal(inline.length, 1);
  assert.equal(/nonce="([^"]+)"/.exec(inline[0][1])[1], cspNonce);
  for (const part of ["frame-src https://www.loom.com https://calendly.com", "frame-ancestors 'none'", "base-uri 'none'", "connect-src 'self'", "default-src 'none'"]) {
    assert.ok(csp.includes(part), part);
  }
  assert.ok(/script-src [^;]*https:\/\/assets\.calendly\.com/.test(csp));
  assert.ok(!/script-src [^;]*'unsafe-inline'/.test(csp));
  // ohne vorgegebene Nonce: jedes Rendern eine neue
  const a = page.renderDemoPage(ROW).headers['Content-Security-Policy'];
  const b = page.renderDemoPage(ROW).headers['Content-Security-Policy'];
  assert.notEqual(a, b);
});

test('zurückgezogen, unbekannt oder ohne Loom-ID ergibt eine neutrale 404-Seite', () => {
  for (const row of [{ ...ROW, status: 'withdrawn' }, null, { ...ROW, loom_id: 'nicht-hex' }, { ...ROW, code: 'abc' }]) {
    const { status, html, headers } = page.renderDemoPage(row, { nonce: NONCE });
    assert.equal(status, 404);
    assert.ok(!html.includes('Keller'));
    assert.ok(!html.includes('loom.com'));
    assert.ok(html.includes('noindex'));
    assert.equal(headers['X-Robots-Tag'], 'noindex, nofollow');
  }
});

test('Standard-Ausprobier-Link ist wa.me/16505146359 mit kodiertem Text', () => {
  const de = attrsOf(render({ try_wa: '', try_text: '' }).html, 'demo-try');
  assert.equal(de.href, 'https://wa.me/16505146359?text=' + encodeURIComponent('Hallo Hadi, ich habe gerade die Demo für Keller Immobilien AG gesehen und habe eine Frage.'));
  assert.equal(de.target, '_blank');
  assert.equal(de.rel, 'noopener');
  const en = attrsOf(render({ lang: 'en', try_wa: '', try_text: '' }).html, 'demo-try');
  assert.equal(en.href, 'https://wa.me/16505146359?text=' + encodeURIComponent('Hi Hadi, I just watched the demo for Keller Immobilien AG and have a question.'));
  // Text aus der Tabelle (Tower-Einstellung) hat Vorrang und wird kodiert, auch mit & und #
  const custom = attrsOf(render({ try_text: 'Hallo Hadi, Frage zu A & B #1', try_wa: '+1 (650) 514-6359' }).html, 'demo-try');
  assert.equal(custom.href, 'https://wa.me/16505146359?text=' + encodeURIComponent('Hallo Hadi, Frage zu A & B #1'));
});

test('test_url nur mit https, sonst gilt der WhatsApp-Link', () => {
  for (const bad of ['http://demo.example.com/keller', 'javascript:alert(1)', 'https://user:pw@demo.example.com/', 'kein link']) {
    const a = attrsOf(render({ test_url: bad }).html, 'demo-try');
    assert.ok(a.href.startsWith('https://wa.me/16505146359?text='), bad);
  }
  const good = render({ test_url: 'https://demo.hybote.ai/keller?x=1&y=2' });
  const a = attrsOf(good.html, 'demo-try');
  assert.equal(a.href, 'https://demo.hybote.ai/keller?x=1&y=2');
  assert.equal(a.target, '_blank');
  assert.equal(a.rel, 'noopener');
  assert.ok(good.html.includes('neuen Fenster'));
});

test('Termin buchen: Calendly im Fenster, ohne https der Standardlink, kleiner WhatsApp-Link nur mit Nummer', () => {
  const r = render();
  const book = attrsOf(r.html, 'demo-book');
  assert.equal(book.href, ROW.booking_url);
  assert.ok('data-cal-popup' in book);
  assert.ok(r.html.includes('<script src="/calendly-popup.js" defer></script>'));
  const fallback = attrsOf(render({ booking_url: 'http://calendly.com/x' }).html, 'demo-book');
  assert.equal(fallback.href, 'https://calendly.com/hybote-demo/free-intro-call?utm_source=hybote_demo&utm_medium=demo_page&utm_campaign=abcdefghjk');
  assert.equal(attrsOf(r.html, 'demo-contact'), null);
  const contact = attrsOf(render({ contact_wa: '49 151 1234 5678' }).html, 'demo-contact');
  assert.ok(contact.href.startsWith('https://wa.me/4915112345678?text='));
});

test('Loom lädt erst nach dem Klick, dann mit den verlangten Parametern', () => {
  const { html } = render();
  assert.ok(!html.includes('<iframe'));
  assert.ok(!/<(link|img|script)[^>]*loom\.com/.test(html));
  const s = runScript(html);
  assert.equal(s.replaced(), null);
  const e = s.elements['demo-poster'].click();
  assert.equal(e.defaultPrevented, true);
  const frame = s.replaced();
  assert.equal(frame.src, 'https://www.loom.com/embed/0281766fa2d04bb788eaf19e65135184?autoplay=1&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true');
  assert.match(frame.attributes.allow, /autoplay/);
  // bis Loom geladen ist, bleibt das Vorschaubild mit Ladering sichtbar; ein zweiter Klick setzt kein zweites iframe ein
  assert.equal(frame.className, 'is-pending');
  s.elements['demo-poster'].click();
  for (const f of frame.listeners.load || []) f();
  assert.equal(frame.className, '');
  // das Vorschaubild kommt von uns
  assert.ok(html.includes('<img src="/v/abcdefghjk/og.jpg?v=3"'));
});

test('Ereignisse: jedes höchstens einmal, demo_open erst nach 2 s sichtbar', () => {
  const s = runScript(render().html, { hidden: true });
  assert.equal(s.timers.length, 0, 'verborgene Seite startet keinen Zähler');
  s.setVisibility('visible');
  assert.equal(s.timers.length, 1);
  assert.equal(s.timers[0].ms, 2000);
  s.flushTimers();
  for (let i = 0; i < 2; i++) {
    s.elements['demo-try'].click();
    s.elements['demo-book'].click();
  }
  s.elements['demo-poster'].click();
  s.setVisibility('hidden');
  s.setVisibility('visible');
  s.flushTimers();
  const events = s.beacons.map((b) => b.body.event).sort();
  assert.deepEqual(events, ['demo_book', 'demo_open', 'demo_play', 'demo_try']);
  for (const b of s.beacons) {
    assert.equal(b.url, '/api/connect/video-view');
    assert.equal(b.body.code, 'abcdefghjk');
    assert.equal(b.body.lang, 'de');
    assert.match(b.body.event_id, /^[A-Za-z0-9-]{8,80}$/);
  }
  assert.equal(new Set(s.beacons.map((b) => b.body.event_id)).size, 4);
  assert.equal(s.fetches.length, 0);
});

test('Vorschau (?preview=1) zeigt das Band und sendet keine Beacons', () => {
  const { html } = render({}, { preview: true });
  assert.ok(html.includes('class="band"'));
  assert.equal(attrsOf(html, 'demo')['data-preview'], '1');
  const s = runScript(html);
  s.flushTimers();
  s.elements['demo-poster'].click();
  s.elements['demo-try'].click();
  s.elements['demo-book'].click();
  assert.equal(s.beacons.length, 0);
  assert.equal(s.fetches.length, 0);
  assert.ok(s.replaced(), 'Video spielt in der Vorschau trotzdem');
  assert.ok(!render().html.includes('class="band"'));
});

test('Schweiz: ß wird zu ss, Entwickler-Unterzeile', () => {
  const { html } = render({ swiss: 'true', kind: 'developer' });
  assert.ok(!html.includes('ß'));
  assert.ok(html.includes('weiss, dass'));
  assert.ok(html.includes('og:locale" content="de_CH"'));
  assert.ok(html.includes('jede Registrierung'));
  assert.ok(render().html.includes('weiß'));
});

test('Wörterbuch ohne Gedankenstriche, Ausrufezeichen und Test-Wörter', () => {
  for (const lang of ['de', 'en']) {
    for (const [key, value] of Object.entries(page.TEXTS[lang])) {
      assert.ok(!/[—–]/.test(value), `${lang}.${key}: Gedankenstrich`);
      assert.ok(!value.includes('!'), `${lang}.${key}: Ausrufezeichen`);
      assert.ok(!/\b(test|testen|sample|benchmark|stichprobe|mystery)\b/i.test(value), `${lang}.${key}: Test-Wort`);
    }
    assert.deepEqual(Object.keys(page.TEXTS[lang]).sort(), Object.keys(page.TEXTS.de).sort());
  }
});

test('Vorschaubild: Loom-GIF wird zum gleichnamigen JPEG, nur https auf cdn.loom.com', () => {
  assert.equal(og.thumbnailUrl('https://cdn.loom.com/sessions/thumbnails/abc-00001.gif'), 'https://cdn.loom.com/sessions/thumbnails/abc-00001.jpg');
  assert.equal(og.thumbnailUrl('https://cdn.loom.com/sessions/thumbnails/abc-7ae9.jpg'), 'https://cdn.loom.com/sessions/thumbnails/abc-7ae9.jpg');
  for (const bad of ['http://cdn.loom.com/a.jpg', 'https://evil.example.com/a.jpg', 'https://cdn.loom.com.evil.com/a.jpg', 'https://169.254.169.254/latest', '', 'javascript:alert(1)']) {
    assert.equal(og.thumbnailUrl(bad), '', bad);
  }
  assert.equal(og.sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])), 'image/jpeg');
  assert.equal(og.sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(og.sniffImageType(Buffer.from('GIF89a\0\0')), '');
  assert.equal(og.sniffImageType(Buffer.from('<?xml version')), '');
});

/* ── Handler mit nachgebildetem n8n ─────────────────────────────────────── */

const realFetch = globalThis.fetch;
const ENV_KEYS = ['N8N_BASE_URL', 'N8N_API_KEY', 'N8N_DEMO_PAGES_TABLE_ID', 'N8N_VIDEO_VIEWS_TABLE_ID'];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
  demoPages.resetDemoCache();
});

function mockRes() {
  return {
    statusCode: 0, headers: {}, body: undefined, ended: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = b; this.ended = true; return this; },
    json(b) { this.body = b; this.ended = true; return this; },
    end(b) { if (b !== undefined) this.body = b; this.ended = true; return this; }
  };
}
// Je nach Laufzeit steht in request.url der Originalpfad; die Query des Rewrite-Ziels ist trotzdem in request.query.
function viaRewrite(method, path, connect) {
  const url = new URL(path, 'https://hybote.ai');
  const code = /^\/v\/([a-z2-9]{10})/.exec(url.pathname)[1];
  return { method, url: path, query: { ...Object.fromEntries(url.searchParams), __connect: connect, code }, headers: {} };
}
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
function fakeN8n(rows, calls, { thumbnail = JPEG } = {}) {
  process.env.N8N_BASE_URL = 'https://flow.example';
  process.env.N8N_API_KEY = 'k';
  delete process.env.N8N_DEMO_PAGES_TABLE_ID;
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.startsWith('https://cdn.loom.com/')) {
      if (!u.endsWith('.jpg')) return new Response('nope', { status: 403 });
      return new Response(thumbnail, { status: 200, headers: { 'content-type': 'application/octet-stream' } });
    }
    if (u.includes('/data-tables?')) return Response.json({ data: [{ id: 'T9', name: 'other' }, { id: 'T1', name: 'demo_pages' }] });
    if (u.includes('/data-tables/T1/rows?')) {
      const filter = JSON.parse(new URL(u).searchParams.get('filter'));
      const code = filter.filters[0].value;
      return Response.json({ data: rows.filter((r) => r.code === code) });
    }
    return new Response('{}', { status: 500 });
  };
}

test('Handler demo-page: findet die Tabelle per Name, cacht die Zeile, HEAD ohne Inhalt, 404 und 503', async () => {
  const calls = [];
  fakeN8n([ROW, { ...ROW, code: 'zzzzzzzzzz', status: 'withdrawn' }], calls);
  // Rewrite-Ziel, wie es vercel.json erzeugt
  const res = mockRes();
  await router({ method: 'GET', url: '/api/connect/route?__connect=demo-page&code=abcdefghjk', query: { __connect: 'demo-page', code: 'abcdefghjk' }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.ok(res.body.includes('Ihre Demo für Keller Immobilien AG'));
  assert.ok(res.headers['content-security-policy'].includes(`'nonce-${/<script nonce="([^"]+)"/.exec(res.body)[1]}'`));
  assert.equal(calls.filter((c) => c.includes('/data-tables?')).length, 1);
  // Originalpfad (manche Laufzeiten reichen ihn durch), Vorschau-Schalter, zweiter Aufruf aus dem Cache
  const res2 = mockRes();
  await router(viaRewrite('GET', '/v/abcdefghjk?preview=1', 'demo-page'), res2);
  assert.equal(res2.statusCode, 200);
  assert.ok(res2.body.includes('class="band"'));
  assert.equal(calls.filter((c) => c.includes('/rows?')).length, 1);
  const head = mockRes();
  await router(viaRewrite('HEAD', '/v/abcdefghjk', 'demo-page'), head);
  assert.equal(head.statusCode, 200);
  assert.equal(head.body, undefined);
  const gone = mockRes();
  await router(viaRewrite('GET', '/v/zzzzzzzzzz', 'demo-page'), gone);
  assert.equal(gone.statusCode, 404);
  assert.equal(gone.headers['x-robots-tag'], 'noindex, nofollow');
  const unknown = mockRes();
  await router(viaRewrite('GET', '/v/yyyyyyyyyy', 'demo-page'), unknown);
  assert.equal(unknown.statusCode, 404);
  demoPages.resetDemoCache();
  globalThis.fetch = async () => { throw new Error('netz weg'); };
  const down = mockRes();
  await router(viaRewrite('GET', '/v/abcdefghjk', 'demo-page'), down);
  assert.equal(down.statusCode, 503);
});

test('Handler demo-og: Loom-JPEG mit eigenem Content-Type, sonst HYBOTE-Standardbild', async () => {
  const calls = [];
  fakeN8n([ROW, { ...ROW, code: 'zzzzzzzzzz', status: 'withdrawn' }, { ...ROW, code: 'xxxxxxxxxx', loom_thumbnail_url: 'https://evil.example.com/a.jpg' }], calls);
  const res = mockRes();
  await router({ method: 'GET', url: '/api/connect/route?__connect=demo-og&code=abcdefghjk&v=3', query: { __connect: 'demo-og', code: 'abcdefghjk', v: '3' }, headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['content-type'], 'image/jpeg');
  assert.match(res.headers['cache-control'], /max-age=3600/);
  assert.ok(Buffer.compare(res.body, JPEG) === 0);
  assert.ok(calls.includes('https://cdn.loom.com/sessions/thumbnails/0281766fa2d04bb788eaf19e65135184-00001.jpg'));
  assert.ok(!calls.some((c) => c.endsWith('.gif')));
  for (const code of ['zzzzzzzzzz', 'xxxxxxxxxx', 'yyyyyyyyyy']) {
    const d = mockRes();
    await router(viaRewrite('GET', `/v/${code}/og.jpg`, 'demo-og'), d);
    assert.equal(d.statusCode, 200, code);
    assert.equal(d.headers['content-type'], 'image/png', code);
    assert.equal(og.sniffImageType(d.body), 'image/png', code);
  }
  assert.ok(!calls.some((c) => c.includes('evil.example.com')));
  // Loom liefert etwas anderes als ein Bild: Standardbild
  demoPages.resetDemoCache();
  fakeN8n([ROW], [], { thumbnail: Buffer.from('<?xml version="1.0"?><Error/>') });
  const xml = mockRes();
  await router(viaRewrite('GET', '/v/abcdefghjk/og.jpg', 'demo-og'), xml);
  assert.equal(xml.headers['content-type'], 'image/png');
});

test('video-view: 10-Zeichen-Codes mit Demo-Ereignissen, 8-Zeichen-Codes unverändert play5', async () => {
  process.env.N8N_BASE_URL = 'https://flow.example';
  process.env.N8N_API_KEY = 'k';
  process.env.N8N_VIDEO_VIEWS_TABLE_ID = 'VV';
  const stored = [];
  globalThis.fetch = async (url, options) => { stored.push(JSON.parse(options.body).data); return new Response('{}', { status: 200 }); };
  const ua = { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' };
  async function post(body) {
    const res = mockRes();
    await videoView({ method: 'POST', headers: ua, body }, res);
    return res.statusCode;
  }
  const id = () => randomUUID();
  // sendBeacon schickt text/plain: kommt als String an
  assert.equal(await post(JSON.stringify({ event_id: id(), code: 'abcdefghjk', event: 'demo_open', lang: 'de' })), 204);
  assert.equal(await post(Buffer.from(JSON.stringify({ event_id: id(), code: 'abcdefghjk', event: 'demo_try', lang: 'en' }))), 204);
  assert.equal(await post({ event_id: id(), code: 'abcdefghjk', event: 'demo_play' }), 204);
  assert.equal(await post({ event_id: id(), code: 'abcdefghjk', event: 'demo_book' }), 204);
  assert.deepEqual(stored.map((r) => [r.code, r.event, r.watched_seconds]), [
    ['abcdefghjk', 'demo_open', 0], ['abcdefghjk', 'demo_try', 0], ['abcdefghjk', 'demo_play', 0], ['abcdefghjk', 'demo_book', 0]
  ]);
  assert.equal(stored[0].lang, 'de');
  assert.equal(stored[1].lang, 'en');
  assert.equal(stored[0].synced, false);
  stored.length = 0;
  assert.equal(await post({ event_id: id(), code: 'abcdefghjk', event: 'play5', watched_s: 30 }), 400);
  assert.equal(await post({ event_id: id(), code: 'abcdefghjk', event: 'quatsch' }), 400);
  assert.equal(await post({ event_id: id(), code: 'abcdefghjkm', event: 'demo_open' }), 400);
  assert.equal(stored.length, 0);
  // 8 Zeichen: wie bisher immer play5 und erst ab 5 Sekunden
  assert.equal(await post({ event_id: id(), code: 'abcdefgh', event: 'play5', watched_s: 3 }), 204);
  assert.equal(stored.length, 0);
  assert.equal(await post({ event_id: id(), code: 'abcdefgh', event: 'play5', watched_s: 6, lang: 'de' }), 204);
  assert.equal(await post({ event_id: id(), code: 'abcdefgh', event: 'demo_open', watched_s: 9 }), 204);
  assert.deepEqual(stored.map((r) => [r.code, r.event, r.watched_seconds]), [['abcdefgh', 'play5', 6], ['abcdefgh', 'play5', 9]]);
  // Bots zählen nie
  stored.length = 0;
  const bot = mockRes();
  await videoView({ method: 'POST', headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }, body: { event_id: id(), code: 'abcdefghjk', event: 'demo_open' } }, bot);
  assert.equal(bot.statusCode, 204);
  assert.equal(stored.length, 0);
});
