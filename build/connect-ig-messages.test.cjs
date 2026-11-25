const assert = require('node:assert/strict');
const test = require('node:test');

const handler = require('../api/connect/_handlers/ig-messages.js');
const { signInviteToken } = require('../api/meta/_invite.js');

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function configureEnvironment() {
  process.env.META_INVITE_SECRET = 'b'.repeat(64);
  process.env.N8N_BASE_URL = 'https://n8n.example.test';
  process.env.N8N_API_KEY = 'test-n8n-key';
  process.env.N8N_IG_TENANT_TABLE_ID = 'ig-tenants-table';
}

function makeInvite(channel = 'instagram', tenantKey = 'novaestates') {
  return signInviteToken({
    company: 'Nova Estates Dubai',
    email: 'contact@hybote.ai',
    tenantKey,
    language: 'en',
    inviteId: 'inv-ig-1',
    channel
  });
}

function createRequest({ method = 'GET', token = '' } = {}) {
  return {
    method,
    url: `/api/connect/ig/messages${token ? `?token=${encodeURIComponent(token)}` : ''}`,
    headers: {}
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

test.beforeEach(configureEnvironment);
test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
});

test('rejects non-GET methods with 405', async () => {
  const res = createResponse();
  await handler(createRequest({ method: 'POST', token: makeInvite() }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.code, 'METHOD_NOT_ALLOWED');
});

test('rejects missing or tampered invite tokens with 401', async () => {
  const res = createResponse();
  await handler(createRequest({ token: 'bad.token' }), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'INVITE_INVALID');
});

test('rejects non-instagram invites with 403', async () => {
  const res = createResponse();
  await handler(createRequest({ token: makeInvite('email') }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'INVITE_CHANNEL_MISMATCH');
});

test('groups inbound message, AI reply, recipient return reply, and owner echo into the same conversation thread', async () => {
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/data-tables/ig-tenants-table/rows?')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            data: [{
              tenant_key: 'novaestates',
              username: 'hyboteai',
              account_type: 'BUSINESS',
              ig_user_id: '17841400',
              status: 'connected',
              agent_status: 'live',
              connected_at: '2026-11-25T09:00:00.000Z',
              history_table_id: 'hist-nova-1'
            }]
          };
        }
      };
    }
    if (u.includes('/data-tables/hist-nova-1/rows?')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            data: [
              // Out of order on purpose to verify chronological sorting per thread
              { id: 3, wa_id: 'ig-user-1001', role: 'user', text: 'My budget is 150,000 AED. Please connect me.', created_at: '2026-11-25T09:02:10.000Z' },
              { id: 1, wa_id: 'ig-user-1001', role: 'user', text: 'Hi, looking for a 2BR in Dubai Marina.', created_at: '2026-11-25T09:01:00.000Z' },
              { id: 2, wa_id: 'ig-user-1001', role: 'assistant', text: 'Happy to help! What budget range do you have in mind?', created_at: '2026-11-25T09:01:15.000Z' },
              { id: 4, wa_id: 'ig-user-1001', role: 'owner', text: 'Hi, this is the team - calling you now.', created_at: '2026-11-25T09:03:00.000Z' },
              { id: 5, wa_id: 'ig-user-9999', role: 'user', text: 'Older inquiry', created_at: '2026-11-24T12:00:00.000Z' }
            ]
          };
        }
      };
    }
    throw new Error(`Unexpected fetch: ${u}`);
  };

  const res = createResponse();
  await handler(createRequest({ token: makeInvite('instagram', 'novaestates') }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.account.connected, true);
  assert.equal(res.body.account.username, 'hyboteai');
  assert.equal(res.body.threads.length, 2);

  // Newest thread first
  const active = res.body.threads[0];
  assert.equal(active.threadId, 'ig-user-1001');
  assert.equal(active.messageCount, 4);
  assert.deepEqual(
    active.messages.map((m) => m.role),
    ['inbound', 'assistant', 'inbound', 'owner']
  );
  assert.equal(active.messages[2].text, 'My budget is 150,000 AED. Please connect me.');
  assert.equal(res.body.threads[1].threadId, 'ig-user-9999');
});

test('returns empty threads gracefully when tenant has no history_table_id yet', async () => {
  global.fetch = async (url) => {
    if (String(url).includes('/data-tables/ig-tenants-table/rows?')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            data: [{
              tenant_key: 'metareview-ig',
              username: 'reviewer_ig',
              account_type: 'BUSINESS',
              status: 'connected',
              history_table_id: ''
            }]
          };
        }
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const res = createResponse();
  await handler(createRequest({ token: makeInvite('instagram', 'metareview-ig') }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.account.connected, true);
  assert.deepEqual(res.body.threads, []);
});

test('returns 502 when n8n API fails', async () => {
  global.fetch = async () => ({
    ok: false,
    status: 500,
    async json() { return { message: 'db down' }; }
  });

  const res = createResponse();
  await handler(createRequest({ token: makeInvite() }), res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, 'MESSAGES_UNAVAILABLE');
});
