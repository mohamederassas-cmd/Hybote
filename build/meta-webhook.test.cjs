const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { Readable } = require('node:stream');

const handler = require('../api/meta/webhook.js');

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

const APP_SECRET = 'test-app-secret';
const VERIFY_TOKEN = 'v'.repeat(64);
const AUTH_VALUE = 'w'.repeat(64);
const WEBHOOK_URL = 'https://flow.example.test/webhook/meta-inbound';

// Absichtlich krumm: unregelmaessiger Whitespace, Unicode-Escapes statt
// Literale, Zahlen mit Leerzeichen. Genau das reproduziert JSON.stringify
// nach einem Reparse NICHT – daran haengt die ganze Signaturpruefung.
const RAW = '{"object":"whatsapp_business_account",  "entry":[{"id":"1","t":"gr\\u00fc\\u00dfe","y":[1, 2]}]}';

function configureEnvironment() {
  process.env.META_APP_SECRET = APP_SECRET;
  process.env.META_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;
  process.env.N8N_WHATSAPP_WEBHOOK_URL = WEBHOOK_URL;
  process.env.N8N_WEBHOOK_AUTH_HEADER = 'X-Hybote-Webhook-Token';
  process.env.N8N_WEBHOOK_AUTH_VALUE = AUTH_VALUE;
  process.env.N8N_BASE_URL = 'https://n8n.example.test';
  process.env.N8N_API_KEY = 'test-n8n-key';
  delete process.env.N8N_WEBHOOK_LOG_TABLE_ID;
}

function sign(raw, secret = APP_SECRET) {
  return `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
}

let ipCounter = 0;
function createRequest({ method = 'POST', raw = '', headers = {}, url = '/api/meta/webhook' } = {}) {
  ipCounter += 1;
  const request = Readable.from([Buffer.from(raw, 'utf8')]);
  request.method = method;
  request.url = url;
  request.headers = {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(raw, 'utf8')),
    'x-forwarded-for': `203.0.113.${ipCounter}`,
    ...headers
  };
  // Vercel legt request.body als enumerable Getter an, der bei fehlerhaftem
  // JSON wirft. Dieser Endpunkt darf ihn nie anfassen – hier wird das erzwungen.
  Object.defineProperty(request, 'body', {
    enumerable: true,
    get() { throw new Error('request.body darf im Webhook nie gelesen werden'); }
  });
  return request;
}

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    send(payload) { this.body = payload; return this; }
  };
}

function installFetchMock({ forwardStatus = 200, throwOnForward = false } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url) === WEBHOOK_URL) {
      if (throwOnForward) throw new Error('ECONNREFUSED');
      return {
        ok: forwardStatus >= 200 && forwardStatus < 300,
        status: forwardStatus,
        async text() { return 'ok'; }
      };
    }
    if (String(url).includes('/rows/upsert')) {
      return { ok: true, status: 200, async json() { return {}; }, async text() { return '{}'; } };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  return calls;
}

function forwardCalls(calls) {
  return calls.filter((call) => call.url === WEBHOOK_URL);
}

test.beforeEach(configureEnvironment);

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
});

test('the test payload really cannot be reproduced by re-serialising', () => {
  // Belegt die Praemisse des ganzen Endpunkts: waere das hier gleich, waere
  // JSON.stringify(request.body) ein zulaessiger Rueckfall.
  assert.notEqual(JSON.stringify(JSON.parse(RAW)), RAW);
});

test('answers the verification handshake with the plain challenge', async () => {
  const calls = installFetchMock();
  const response = createResponse();
  await handler(createRequest({
    method: 'GET',
    url: `/api/meta/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1234567890`
  }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body, '1234567890');
  assert.match(String(response.headers['Content-Type']), /^text\/plain/);
  assert.equal(response.headers['Cache-Control'], 'no-store, max-age=0');
  assert.equal(calls.length, 0);
});

test('rejects a verification handshake with the wrong token', async () => {
  const calls = installFetchMock();
  const response = createResponse();
  await handler(createRequest({
    method: 'GET',
    url: '/api/meta/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1234567890'
  }), response);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'VERIFY_TOKEN_INVALID');
  assert.equal(calls.length, 0);
});

test('forwards the exact bytes it verified, never a re-serialised payload', async () => {
  const calls = installFetchMock();
  const response = createResponse();
  await handler(createRequest({ raw: RAW, headers: { 'x-hub-signature-256': sign(RAW) } }), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);

  const forwarded = forwardCalls(calls);
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].options.body.toString('utf8'), RAW);
  assert.equal(forwarded[0].options.headers['X-Hybote-Webhook-Token'], AUTH_VALUE);
  assert.equal('X-N8N-API-KEY' in forwarded[0].options.headers, false);
  assert.match(String(forwarded[0].options.headers['X-Hybote-Delivery']), /^[0-9a-f]{32}$/);
});

test('does not forward anything when the signature was tampered with', async () => {
  const calls = installFetchMock();
  const valid = sign(RAW);
  const tampered = `${valid.slice(0, -1)}${valid.endsWith('a') ? 'b' : 'a'}`;
  const response = createResponse();
  await handler(createRequest({ raw: RAW, headers: { 'x-hub-signature-256': tampered } }), response);

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'SIGNATURE_INVALID');
  assert.equal(calls.length, 0);
});

test('does not forward anything when the payload was tampered with', async () => {
  const calls = installFetchMock();
  const response = createResponse();
  await handler(createRequest({
    raw: RAW.replace('gr\\u00fc\\u00dfe', 'hacked'),
    headers: { 'x-hub-signature-256': sign(RAW) }
  }), response);

  assert.equal(response.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('rejects a delivery without a signature header', async () => {
  const calls = installFetchMock();
  const response = createResponse();
  await handler(createRequest({ raw: RAW }), response);

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'SIGNATURE_MISSING');
  assert.equal(calls.length, 0);
});

test('answers 502 so Meta retries when n8n is down', async () => {
  const calls = installFetchMock({ forwardStatus: 500 });
  const response = createResponse();
  await handler(createRequest({ raw: RAW, headers: { 'x-hub-signature-256': sign(RAW) } }), response);

  assert.equal(response.statusCode, 502);
  assert.equal(response.body.code, 'FORWARD_FAILED');
  assert.equal(forwardCalls(calls).length, 1);
});

test('answers 502 when the forward throws outright', async () => {
  installFetchMock({ throwOnForward: true });
  const response = createResponse();
  await handler(createRequest({ raw: RAW, headers: { 'x-hub-signature-256': sign(RAW) } }), response);

  assert.equal(response.statusCode, 502);
  assert.equal(response.body.code, 'FORWARD_FAILED');
});

test('writes a failure row without ever putting the payload into it', async () => {
  process.env.N8N_WEBHOOK_LOG_TABLE_ID = 'webhook-log-1';
  const calls = installFetchMock();
  const response = createResponse();
  await handler(createRequest({ raw: RAW, headers: { 'x-hub-signature-256': sign(RAW, 'wrong-secret') } }), response);

  assert.equal(response.statusCode, 401);
  const auditCall = calls.find((call) => call.url.includes('/rows/upsert'));
  assert.ok(auditCall, 'ein Signaturfehler muss protokolliert werden');
  assert.equal(JSON.parse(auditCall.options.body).data.outcome, 'SIGNATURE_INVALID');
  assert.equal(auditCall.options.body.includes('whatsapp_business_account'), false);
});

test('reports 503 instead of silently dropping when the endpoint is not configured', async () => {
  delete process.env.N8N_WEBHOOK_AUTH_VALUE;
  const calls = installFetchMock();
  const response = createResponse();
  await handler(createRequest({ raw: RAW, headers: { 'x-hub-signature-256': sign(RAW) } }), response);

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.code, 'WEBHOOK_NOT_CONFIGURED');
  assert.equal(calls.length, 0);
});

test('answers 405 for any other method', async () => {
  const response = createResponse();
  await handler(createRequest({ method: 'PUT' }), response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, 'GET, POST');
});
