const assert = require('node:assert/strict');
const test = require('node:test');

const { signInviteToken, verifyInviteToken, normalizeLanguage } = require('../api/meta/_invite.js');
const inviteHandler = require('../api/meta/invite.js');

const ORIGINAL_ENV = { ...process.env };

test.beforeEach(() => { process.env.META_INVITE_SECRET = 'c'.repeat(64); });
test.afterEach(() => { process.env = { ...ORIGINAL_ENV }; });

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

test('round-trips language and tenant key through the signed token', () => {
  const token = signInviteToken({
    company: 'Probe Immobilien', email: 'Owner@Example.test', customerReference: 'K-7',
    tenantKey: 'probe-immobilien-7', language: 'ru', inviteId: 'jti-1'
  });
  const invite = verifyInviteToken(token);
  assert.equal(invite.language, 'ru');
  assert.equal(invite.tenantKey, 'probe-immobilien-7');
  assert.equal(invite.customerReference, 'K-7');
  assert.equal(invite.email, 'owner@example.test');
  assert.equal(invite.inviteId, 'jti-1');
});

test('falls back to English for unknown languages and to ref for old tokens without tenant_key', () => {
  assert.equal(normalizeLanguage('zh'), 'en');
  assert.equal(normalizeLanguage('FR'), 'fr');
  const token = signInviteToken({ company: 'Example GmbH', email: 'a@b.test', customerReference: 'K-1', language: 'xx' });
  const invite = verifyInviteToken(token);
  assert.equal(invite.language, 'en');
  assert.equal(invite.tenantKey, 'K-1');
});

test('rejects expired and tampered tokens', () => {
  const expired = signInviteToken({ company: 'Example GmbH', email: 'a@b.test', ttlSeconds: -10 });
  assert.equal(verifyInviteToken(expired), null);
  const valid = signInviteToken({ company: 'Example GmbH', email: 'a@b.test' });
  assert.equal(verifyInviteToken(`${valid}x`), null);
});

test('GET /api/meta/invite exposes language and tenant key', async () => {
  const token = signInviteToken({ company: 'Example GmbH', email: 'a@b.test', tenantKey: 'example-1', language: 'fr' });
  const response = createResponse();
  await inviteHandler({ method: 'GET', url: `/api/meta/invite?token=${encodeURIComponent(token)}`, headers: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.invite.language, 'fr');
  assert.equal(response.body.invite.tenantKey, 'example-1');
});
