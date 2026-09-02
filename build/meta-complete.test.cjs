const assert = require('node:assert/strict');
const test = require('node:test');

const handler = require('../api/meta/complete.js');
const { signInviteToken } = require('../api/meta/_invite.js');

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

const TENANT_TABLE_ID = 'table-1';
const LOG_TABLE_ID = 'log-table-1';
const WABA_ID = '123456789012345';
const PHONE_NUMBER_ID = '987654321098765';

function configureEnvironment() {
  process.env.META_APP_SECRET = 'test-app-secret';
  process.env.N8N_BASE_URL = 'https://n8n.example.test';
  process.env.N8N_API_KEY = 'test-n8n-key';
  process.env.N8N_PROJECT_ID = 'project-1';
  process.env.N8N_TENANT_TABLE_ID = TENANT_TABLE_ID;
  process.env.N8N_ONBOARDING_LOG_TABLE_ID = LOG_TABLE_ID;
  process.env.N8N_WHATSAPP_CREDENTIAL_TYPE = 'whatsAppApi';
  // Beide Geheimnisse werden vom Endpunkt auf mindestens 32 Zeichen geprueft.
  process.env.META_PIN_SECRET = 'a'.repeat(64);
  process.env.META_INVITE_SECRET = 'b'.repeat(64);
}

function requestBody() {
  // Firma, E-Mail und Kundennummer kommen ausschliesslich aus dem signierten
  // Einladungs-Token, nicht aus dem Formular.
  return {
    inviteToken: signInviteToken({
      company: 'Example GmbH',
      email: 'owner@example.test',
      customerReference: 'K-1000',
      inviteId: 'invite-1',
      tenantKey: 'example-42',
      language: 'ru'
    }),
    code: 'test-code-that-is-long-enough',
    businessId: '1164771143385164',
    wabaId: WABA_ID,
    phoneNumberId: PHONE_NUMBER_ID,
    authorityAccepted: true,
    privacyAccepted: true
  };
}

// Der Endpunkt drosselt auf fuenf Versuche je IP. Jeder Testaufruf bekommt
// deshalb eine eigene Absender-IP, sonst laeuft ab dem sechsten Test alles in
// ein 429 statt in die eigentliche Pruefung.
let requestCounter = 0;
function createRequest(overrides = {}) {
  requestCounter += 1;
  return {
    method: 'POST',
    headers: {
      origin: 'https://hybote.ai',
      cookie: 'hybote_meta_csrf=test-csrf',
      'x-hybote-csrf': 'test-csrf',
      'x-forwarded-for': `203.0.113.${requestCounter}`
    },
    body: { ...requestBody(), ...overrides }
  };
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

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; }
  };
}

/** phoneStatus steuert den Registrierungspfad: alles ausser CONNECTED loest
 *  POST /{phone_number_id}/register aus, CONNECTED ist der Coexistence-Fall. */
function installFetchMock(existingCredential, phoneStatus = 'PENDING') {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/oauth/access_token')) {
      return jsonResponse({ access_token: 'customer-access-token', token_type: 'bearer', expires_in: 3600 });
    }
    if (String(url).includes('/debug_token?')) {
      return jsonResponse({
        data: {
          is_valid: true,
          expires_at: 0,
          granular_scopes: [{ scope: 'whatsapp_business_messaging', target_ids: [WABA_ID] }]
        }
      });
    }
    if (String(url).includes(`/${WABA_ID}?fields=`)) {
      return jsonResponse({ id: WABA_ID, name: 'Example WhatsApp' });
    }
    if (String(url).includes(`/${PHONE_NUMBER_ID}?fields=`)) {
      return jsonResponse({
        id: PHONE_NUMBER_ID,
        display_phone_number: '+49 30 123456',
        verified_name: 'Example',
        status: phoneStatus,
        platform_type: phoneStatus === 'CONNECTED' ? 'SMB_APP' : 'CLOUD_API'
      });
    }
    if (String(url).includes(`/${PHONE_NUMBER_ID}/register`)) {
      return jsonResponse({ success: true });
    }
    if (String(url).includes(`/${PHONE_NUMBER_ID}/smb_app_data`)) {
      return jsonResponse({ success: true });
    }
    if (String(url).includes(`/${WABA_ID}/phone_numbers?`)) {
      return jsonResponse({ data: [{ id: PHONE_NUMBER_ID, display_phone_number: '+49 30 123456', status: 'CONNECTED', platform_type: 'SMB_APP', is_on_biz_app: true }] });
    }
    if (String(url).includes(`/${WABA_ID}/subscribed_apps`)) {
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

function tenantUpsert(calls) {
  return calls.find((call) => call.url.includes(`/data-tables/${TENANT_TABLE_ID}/rows/upsert`));
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

  const upsertBody = JSON.parse(tenantUpsert(calls).options.body);
  assert.equal(upsertBody.data.credential_id, 'credential-new');
  assert.equal(upsertBody.data.tenant_key, 'example-42', 'tenant_key kommt aus dem Token des Sales Pilot');
  assert.equal(upsertBody.data.customer_reference, 'K-1000');
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

test('registers a classically migrated number and keeps the PIN out of the tenant row', async () => {
  const calls = installFetchMock(null, 'PENDING');
  const response = createResponse();
  await handler(createRequest(), response);

  assert.equal(response.statusCode, 200);
  const registerCall = calls.find((call) => call.url.includes(`/${PHONE_NUMBER_ID}/register`));
  assert.ok(registerCall, 'register muss fuer eine nicht verbundene Nummer aufgerufen werden');
  const registerBody = JSON.parse(registerCall.options.body);
  assert.equal(registerBody.messaging_product, 'whatsapp');
  assert.match(String(registerBody.pin), /^\d{6}$/);

  const upsertBody = JSON.parse(tenantUpsert(calls).options.body);
  assert.equal(upsertBody.data.registered_at === '', false);
  assert.equal(JSON.stringify(upsertBody).includes(String(registerBody.pin)), false);
});

test('never re-registers a coexistence number that already comes back connected', async () => {
  const calls = installFetchMock(null, 'CONNECTED');
  const response = createResponse();
  await handler(createRequest(), response);

  assert.equal(response.statusCode, 200);
  assert.equal(calls.some((call) => call.url.includes(`/${PHONE_NUMBER_ID}/register`)), false);

  const upsertBody = JSON.parse(tenantUpsert(calls).options.body);
  assert.equal(upsertBody.data.registered_at, '');

  // Metas Doku verlangt zwei getrennte Sync-Aufrufe: Kontakte und Verlauf.
  const syncCalls = calls.filter((call) => call.url.includes(`/${PHONE_NUMBER_ID}/smb_app_data`));
  assert.deepEqual(syncCalls.map((call) => JSON.parse(call.options.body).sync_type), ['smb_app_state_sync', 'history']);
  assert.equal(upsertBody.data.coexistence, 'true');
});

test('resolves the phone number from the WABA when the coexistence dialog reports none', async () => {
  const calls = installFetchMock(null, 'CONNECTED');
  const response = createResponse();
  await handler(createRequest({ phoneNumberId: '' }), response);

  assert.equal(response.statusCode, 200, JSON.stringify(response.body));
  assert.ok(calls.some((call) => call.url.includes(`/${WABA_ID}/phone_numbers?`)), 'die Nummer muss aus der WABA gelesen werden');
  const upsertBody = JSON.parse(tenantUpsert(calls).options.body);
  assert.equal(upsertBody.data.phone_number_id, PHONE_NUMBER_ID);
  assert.equal(response.body.connection.phoneNumberId, PHONE_NUMBER_ID);
});

test('rejects a request without a valid invite token', async () => {
  const calls = installFetchMock(null);
  const response = createResponse();
  await handler(createRequest({ inviteToken: 'not.a-valid-token' }), response);

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'INVITE_INVALID');
  assert.equal(calls.length, 0, 'ohne gueltiges Token darf kein einziger Aufruf rausgehen');
});
