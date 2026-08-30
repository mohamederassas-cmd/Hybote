const assert = require('node:assert/strict');
const test = require('node:test');

const handler = require('../api/meta/complete.js');

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function configureEnvironment() {
  process.env.META_APP_SECRET = 'test-app-secret';
  process.env.N8N_BASE_URL = 'https://n8n.example.test';
  process.env.N8N_API_KEY = 'test-n8n-key';
  process.env.N8N_PROJECT_ID = 'project-1';
  process.env.N8N_TENANT_TABLE_ID = 'table-1';
  process.env.N8N_WHATSAPP_CREDENTIAL_TYPE = 'whatsAppApi';
}

function requestBody() {
  return {
    code: 'test-code-that-is-long-enough',
    businessId: '1164771143385164',
    wabaId: '123456789012345',
    phoneNumberId: '987654321098765',
    companyName: 'Example GmbH',
    workEmail: 'owner@example.test',
    customerReference: 'K-1000',
    authorityAccepted: true,
    privacyAccepted: true
  };
}

function createRequest() {
  return {
    method: 'POST',
    headers: {
      origin: 'https://hybote.ai',
      cookie: 'hybote_meta_csrf=test-csrf',
      'x-hybote-csrf': 'test-csrf'
    },
    body: requestBody()
  };
}

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; }
  };
}

function installFetchMock(existingCredential) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/oauth/access_token')) {
      return jsonResponse({ access_token: 'customer-access-token', token_type: 'bearer', expires_in: 3600 });
    }
    if (String(url).includes('/123456789012345?fields=')) {
      return jsonResponse({ id: '123456789012345', name: 'Example WhatsApp' });
    }
    if (String(url).includes('/987654321098765?fields=')) {
      return jsonResponse({ id: '987654321098765', display_phone_number: '+49 30 123456', verified_name: 'Example' });
    }
    if (String(url).includes('/123456789012345/subscribed_apps')) {
      return jsonResponse({ success: true });
    }
    if (String(url).includes('/api/v1/credentials?')) {
      return jsonResponse({ data: existingCredential ? [existingCredential] : [] });
    }
    if (String(url).endsWith('/api/v1/credentials')) {
      return jsonResponse({ id: 'credential-new' });
    }
    if (String(url).includes('/api/v1/credentials/')) {
      return jsonResponse({ id: existingCredential.id });
    }
    if (String(url).includes('/rows/upsert')) {
      return jsonResponse({ data: [{ id: 1 }] });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  return calls;
}

test.beforeEach(configureEnvironment);

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
});

test('creates an encrypted n8n credential and stores only non-secret tenant metadata', async () => {
  const calls = installFetchMock(null);
  const response = createResponse();
  await handler(createRequest(), response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);

  const credentialCall = calls.find((call) => call.url.endsWith('/api/v1/credentials'));
  assert.equal(credentialCall.options.method, 'POST');
  assert.equal(JSON.parse(credentialCall.options.body).data.accessToken, 'customer-access-token');

  const upsertCall = calls.find((call) => call.url.includes('/rows/upsert'));
  const upsertBody = JSON.parse(upsertCall.options.body);
  assert.equal(upsertBody.data.credential_id, 'credential-new');
  assert.equal(JSON.stringify(upsertBody).includes('customer-access-token'), false);
  assert.equal(JSON.stringify(upsertBody).includes('accessToken'), false);
});

test('refreshes an existing credential instead of creating a duplicate', async () => {
  const existingCredential = {
    id: 'credential-existing',
    name: 'WA · Example GmbH · 987654321098765',
    type: 'whatsAppApi'
  };
  const calls = installFetchMock(existingCredential);
  const response = createResponse();
  await handler(createRequest(), response);

  assert.equal(response.statusCode, 200);
  const updateCall = calls.find((call) => call.url.endsWith('/api/v1/credentials/credential-existing'));
  assert.equal(updateCall.options.method, 'PATCH');
  assert.equal(JSON.parse(updateCall.options.body).data.accessToken, 'customer-access-token');
  assert.equal(calls.some((call) => call.url.endsWith('/api/v1/credentials') && call.options.method === 'POST'), false);
});
