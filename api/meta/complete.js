const crypto = require('node:crypto');

const APP_ID = process.env.META_APP_ID || '1580264870470342';
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v26.0';
const DEFAULT_ORIGINS = ['https://hybote.ai', 'https://www.hybote.ai'];
const REQUEST_TIMEOUT_MS = 15000;

function allowedOrigins() {
  return new Set([
    ...DEFAULT_ORIGINS,
    ...(process.env.META_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)
  ]);
}

function parseCookies(header) {
  return String(header || '').split(';').reduce((cookies, pair) => {
    const index = pair.indexOf('=');
    if (index < 1) return cookies;
    cookies[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
    return cookies;
  }, {});
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validId(value) {
  return /^\d{5,30}$/.test(value);
}

function validEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function fetchWithTimeout(url, options) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

async function graphJson(path, accessToken, options = {}) {
  const graphResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await graphResponse.json().catch(() => ({}));
  if (!graphResponse.ok || payload.error) {
    const error = new Error('META_GRAPH_ERROR');
    error.status = graphResponse.status;
    throw error;
  }
  return payload;
}

async function exchangeCode(code, appSecret) {
  const body = new URLSearchParams({
    client_id: APP_ID,
    client_secret: appSecret,
    code
  });
  const tokenResponse = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body
  });
  const payload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !payload.access_token) throw new Error('META_CODE_EXCHANGE_FAILED');
  return payload;
}

async function n8nJson(baseUrl, apiKey, path, options = {}) {
  const apiResponse = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/api/v1/${path}`, {
    ...options,
    headers: {
      'X-N8N-API-KEY': apiKey,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await apiResponse.json().catch(() => ({}));
  if (!apiResponse.ok) {
    const error = new Error('N8N_API_ERROR');
    error.status = apiResponse.status;
    throw error;
  }
  return payload;
}

function credentialList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

async function ensureWhatsAppCredential({ baseUrl, apiKey, projectId, credentialType, credentialName, accessToken, wabaId }) {
  const existingPayload = await n8nJson(baseUrl, apiKey, 'credentials?limit=250');
  const existing = credentialList(existingPayload).find((credential) => credential.name === credentialName && credential.type === credentialType);
  const credentialData = {
    name: credentialName,
    type: credentialType,
    data: {
      accessToken,
      businessAccountId: wabaId
    },
    isResolvable: false
  };

  if (existing && existing.id) {
    return n8nJson(baseUrl, apiKey, `credentials/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(credentialData)
    });
  }

  return n8nJson(baseUrl, apiKey, 'credentials', {
    method: 'POST',
    body: JSON.stringify({
      ...credentialData,
      projectId
    })
  });
}

async function upsertTenant({ baseUrl, apiKey, tableId, tenant }) {
  return n8nJson(baseUrl, apiKey, `data-tables/${tableId}/rows/upsert`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        type: 'and',
        filters: [{ columnName: 'waba_id', condition: 'eq', value: tenant.waba_id }]
      },
      data: tenant,
      returnData: true,
      dryRun: false
    })
  });
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Vary', 'Origin');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const origin = request.headers.origin || '';
  if (!allowedOrigins().has(origin)) {
    return response.status(403).json({ ok: false, code: 'ORIGIN_NOT_ALLOWED' });
  }

  const cookies = parseCookies(request.headers.cookie);
  if (!safeEqual(cookies.hybote_meta_csrf, request.headers['x-hybote-csrf'])) {
    return response.status(403).json({ ok: false, code: 'CSRF_VALIDATION_FAILED' });
  }

  const appSecret = process.env.META_APP_SECRET || '';
  const n8nBaseUrl = process.env.N8N_BASE_URL || '';
  const n8nApiKey = process.env.N8N_API_KEY || '';
  const n8nProjectId = process.env.N8N_PROJECT_ID || '';
  const n8nTenantTableId = process.env.N8N_TENANT_TABLE_ID || '';
  const n8nCredentialType = process.env.N8N_WHATSAPP_CREDENTIAL_TYPE || 'whatsAppApi';
  if (!appSecret || !n8nBaseUrl || !n8nApiKey || !n8nProjectId || !n8nTenantTableId) {
    return response.status(503).json({ ok: false, code: 'ONBOARDING_NOT_CONFIGURED' });
  }

  let body;
  try {
    body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
  } catch (_error) {
    return response.status(400).json({ ok: false, code: 'INVALID_JSON' });
  }
  if (JSON.stringify(body).length > 20000) {
    return response.status(413).json({ ok: false, code: 'PAYLOAD_TOO_LARGE' });
  }

  const code = cleanText(body.code, 4096);
  const businessId = cleanText(body.businessId, 30);
  const wabaId = cleanText(body.wabaId, 30);
  const phoneNumberId = cleanText(body.phoneNumberId, 30);
  const companyName = cleanText(body.companyName, 120);
  const workEmail = cleanText(body.workEmail, 254).toLowerCase();
  const customerReference = cleanText(body.customerReference, 120);

  if (code.length < 20 || !validId(wabaId) || !validId(phoneNumberId) || (businessId && !validId(businessId)) || companyName.length < 2 || !validEmail(workEmail) || body.authorityAccepted !== true || body.privacyAccepted !== true) {
    return response.status(400).json({ ok: false, code: 'INVALID_ONBOARDING_DATA' });
  }

  try {
    const token = await exchangeCode(code, appSecret);
    const accessToken = token.access_token;
    const obtainedAt = new Date();
    const expiresAt = token.expires_in ? new Date(obtainedAt.getTime() + Number(token.expires_in) * 1000) : null;

    const [waba, phone] = await Promise.all([
      graphJson(`${wabaId}?fields=id,name`, accessToken).catch(() => ({ id: wabaId })),
      graphJson(`${phoneNumberId}?fields=id,display_phone_number,verified_name`, accessToken).catch(() => ({ id: phoneNumberId }))
    ]);

    await graphJson(`${wabaId}/subscribed_apps`, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });

    const credentialName = `WA · ${companyName.slice(0, 54)} · ${phoneNumberId}`;
    const credential = await ensureWhatsAppCredential({
      baseUrl: n8nBaseUrl,
      apiKey: n8nApiKey,
      projectId: n8nProjectId,
      credentialType: n8nCredentialType,
      credentialName,
      accessToken,
      wabaId
    });

    const tenantKey = customerReference || `waba_${wabaId}`;
    await upsertTenant({
      baseUrl: n8nBaseUrl,
      apiKey: n8nApiKey,
      tableId: n8nTenantTableId,
      tenant: {
        tenant_key: tenantKey,
        company_name: companyName,
        work_email: workEmail,
        customer_reference: customerReference,
        meta_business_id: businessId,
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        credential_id: credential.id,
        workflow_id: '',
        status: 'connected_pending_provisioning',
        token_expires_at: expiresAt ? expiresAt.toISOString() : ''
      }
    });

    response.setHeader('Set-Cookie', 'hybote_meta_csrf=; Max-Age=0; Path=/api/meta; HttpOnly; Secure; SameSite=Strict');
    return response.status(200).json({
      ok: true,
      connection: {
        wabaId,
        wabaName: waba.name || '',
        phoneNumberId,
        displayPhoneNumber: phone.display_phone_number || '',
        verifiedName: phone.verified_name || '',
        expiresAt: expiresAt ? expiresAt.toISOString() : null
      }
    });
  } catch (_error) {
    return response.status(502).json({ ok: false, code: 'ONBOARDING_COMPLETION_FAILED' });
  }
};
