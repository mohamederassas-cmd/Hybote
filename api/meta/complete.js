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

async function sendToN8n(url, secret, payload) {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const webhookResponse = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HYBOTE-Signature': `sha256=${signature}`,
          'X-HYBOTE-Event': 'meta.whatsapp.embedded_signup.completed'
        },
        body
      });
      if (webhookResponse.ok) return;
      lastError = new Error(`N8N_STATUS_${webhookResponse.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('N8N_DELIVERY_FAILED');
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
  const webhookUrl = process.env.N8N_META_ONBOARDING_WEBHOOK_URL || '';
  const webhookSecret = process.env.N8N_META_ONBOARDING_WEBHOOK_SECRET || '';
  if (!appSecret || !webhookUrl || !webhookSecret) {
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

    await sendToN8n(webhookUrl, webhookSecret, {
      event: 'meta.whatsapp.embedded_signup.completed',
      version: 1,
      occurredAt: obtainedAt.toISOString(),
      customer: {
        companyName,
        workEmail,
        customerReference: customerReference || null,
        authorityAccepted: true,
        privacyAccepted: true
      },
      meta: {
        appId: APP_ID,
        businessId: businessId || null,
        wabaId,
        phoneNumberId,
        waba,
        phone,
        accessToken,
        tokenType: token.token_type || 'bearer',
        expiresIn: token.expires_in || null,
        obtainedAt: obtainedAt.toISOString(),
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        subscribedApps: true
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
