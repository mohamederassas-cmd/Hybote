const crypto = require('node:crypto');
const { verifyInviteToken } = require('./_invite.js');

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

/** Best-effort-Drossel. Vercel-Funktionen sind zustandslos und skalieren
 *  horizontal, dieser Zaehler gilt also nur pro Instanz. Das ist bewusst nur die
 *  zweite Verteidigungslinie – die erste ist das signierte Einladungs-Token,
 *  ohne das dieser Endpunkt gar nicht erst arbeitet. */
const recentAttempts = new Map();
function rateLimited(key, limit = 5, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const hits = (recentAttempts.get(key) || []).filter((stamp) => now - stamp < windowMs);
  hits.push(now);
  recentAttempts.set(key, hits);
  if (recentAttempts.size > 500) {
    for (const [entry, stamps] of recentAttempts) {
      if (!stamps.some((stamp) => now - stamp < windowMs)) recentAttempts.delete(entry);
    }
  }
  return hits.length > limit;
}

function clientFingerprint(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(forwarded || 'unknown').digest('hex').slice(0, 32);
}

/** Sechsstellige Registrierungs-PIN, deterministisch aus der Nummern-ID abgeleitet.
 *  Damit steht die PIN nirgends in einer Tabelle und ist trotzdem jederzeit
 *  reproduzierbar, wenn eine Nummer neu registriert werden muss. */
function deriveRegistrationPin(phoneNumberId) {
  const secret = process.env.META_PIN_SECRET || '';
  if (secret.length < 32) throw new Error('META_PIN_SECRET fehlt oder ist zu kurz');
  const digest = crypto.createHmac('sha256', secret).update(String(phoneNumberId)).digest();
  return String(digest.readUInt32BE(0) % 1000000).padStart(6, '0');
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
    // Der Meta-Fehlercode entscheidet ueber die Antwort an den Kunden
    // (z. B. 133005 = eigene 2FA-PIN gesetzt) und darf nicht verloren gehen.
    error.metaCode = payload.error?.code ?? null;
    error.metaSubcode = payload.error?.error_subcode ?? null;
    error.metaMessage = payload.error?.message ?? '';
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

/** Beweist, dass der Token wirklich fuer die vom Browser gemeldete WABA gilt.
 *  Ohne diese Pruefung vertraut der Server IDs, die aus dem Browser kommen. */
async function assertTokenCoversWaba(accessToken, appSecret, wabaId) {
  const debug = await fetchWithTimeout(
    `https://graph.facebook.com/${GRAPH_VERSION}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(`${APP_ID}|${appSecret}`)}`,
    { headers: { Accept: 'application/json' } }
  );
  const payload = await debug.json().catch(() => ({}));
  const data = payload.data || {};
  if (!debug.ok || !data.is_valid) {
    const error = new Error('META_TOKEN_INVALID');
    error.code = 'TOKEN_NOT_VALID';
    throw error;
  }

  const scopes = Array.isArray(data.granular_scopes) ? data.granular_scopes : [];
  const covers = scopes.some((entry) => (
    /^whatsapp_business_(messaging|management)$/.test(entry.scope || '')
    && Array.isArray(entry.target_ids)
    && entry.target_ids.includes(wabaId)
  ));
  if (!covers) {
    const error = new Error('META_TOKEN_SCOPE_MISMATCH');
    error.code = 'WABA_NOT_AUTHORIZED';
    throw error;
  }
  return { expiresAt: data.expires_at || 0, dataAccessExpiresAt: data.data_access_expires_at || 0 };
}

/** Coexistence-Nummern kommen bereits verbunden aus dem Meta-Dialog und duerfen
 *  nicht erneut registriert werden. Nur eine klassisch migrierte Nummer braucht
 *  den register-Aufruf – ohne ihn geht keine einzige Nachricht raus. */
async function registerIfNeeded(accessToken, phoneNumberId, phone) {
  if (String(phone.status || '').toUpperCase() === 'CONNECTED') {
    return { registered: false, reason: 'ALREADY_CONNECTED' };
  }
  await graphJson(`${phoneNumberId}/register`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', pin: deriveRegistrationPin(phoneNumberId) })
  });
  return { registered: true, reason: 'REGISTERED' };
}

/** Stoesst bei Coexistence die Uebernahme von Kontakten und Verlauf an.
 *  Das Zeitfenster betraegt 24 Stunden ab Abschluss des Signups, deshalb hier
 *  und nicht in einem spaeteren Cron. Bewusst nicht fatal: schlaegt der Aufruf
 *  fehl, ist die Nummer hoechstwahrscheinlich keine Coexistence-Nummer. Das
 *  Ergebnis landet im Audit-Log, damit der erste echte Durchlauf die exakte
 *  Signatur dieses Endpunkts belegt statt sie zu vermuten. */
async function syncCoexistenceData(accessToken, phoneNumberId) {
  try {
    await graphJson(`${phoneNumberId}/smb_app_data`, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp' })
    });
    return { coexistence: true, detail: 'SYNC_STARTED' };
  } catch (error) {
    return { coexistence: false, detail: `SYNC_SKIPPED:${error.metaCode ?? error.status ?? 'unknown'}` };
  }
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

/** Schluessel ist die phone_number_id, nicht die waba_id: eine WABA kann mehrere
 *  Nummern tragen, und mit waba_id als Filter ueberschreibt die zweite Nummer
 *  die Zeile der ersten. */
async function upsertTenant({ baseUrl, apiKey, tableId, tenant }) {
  return n8nJson(baseUrl, apiKey, `data-tables/${tableId}/rows/upsert`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        type: 'and',
        filters: [{ columnName: 'phone_number_id', condition: 'eq', value: tenant.phone_number_id }]
      },
      data: tenant,
      returnData: true,
      dryRun: false
    })
  });
}

/** Jeder Versuch hinterlaesst eine Spur, Erfolg wie Fehlschlag. Nicht fatal:
 *  ein fehlendes Log darf ein funktionierendes Onboarding nicht verhindern.
 *  Nutzt upsert mit einem nie zutreffenden Filter, weil der eingeschraenkte
 *  n8n-Schluessel genau dieses eine Schreibrecht auf Datentabellen hat. */
async function writeAuditRow({ baseUrl, apiKey, tableId, row }) {
  if (!tableId) return;
  try {
    await n8nJson(baseUrl, apiKey, `data-tables/${tableId}/rows/upsert`, {
      method: 'POST',
      body: JSON.stringify({
        filter: { type: 'and', filters: [{ columnName: 'event_id', condition: 'eq', value: row.event_id }] },
        data: row,
        returnData: false,
        dryRun: false
      })
    });
  } catch (_error) {
    // bewusst geschluckt
  }
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

  const fingerprint = clientFingerprint(request);
  if (rateLimited(fingerprint)) {
    return response.status(429).json({ ok: false, code: 'TOO_MANY_ATTEMPTS' });
  }

  const appSecret = process.env.META_APP_SECRET || '';
  const n8nBaseUrl = process.env.N8N_BASE_URL || '';
  const n8nApiKey = process.env.N8N_API_KEY || '';
  const n8nProjectId = process.env.N8N_PROJECT_ID || '';
  const n8nTenantTableId = process.env.N8N_TENANT_TABLE_ID || '';
  const n8nLogTableId = process.env.N8N_ONBOARDING_LOG_TABLE_ID || '';
  const n8nCredentialType = process.env.N8N_WHATSAPP_CREDENTIAL_TYPE || 'whatsAppApi';
  if (!appSecret || !n8nBaseUrl || !n8nApiKey || !n8nProjectId || !n8nTenantTableId
      || (process.env.META_PIN_SECRET || '').length < 32 || (process.env.META_INVITE_SECRET || '').length < 32) {
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

  // Firma, E-Mail und Kundennummer stammen ausschliesslich aus dem signierten
  // Einladungs-Token. Was im Formular steht, ist nur Anzeige – sonst waere die
  // Zuordnung wieder frei waehlbar.
  const invite = verifyInviteToken(cleanText(body.inviteToken, 2048));
  if (!invite) {
    return response.status(401).json({ ok: false, code: 'INVITE_INVALID' });
  }

  const code = cleanText(body.code, 4096);
  const businessId = cleanText(body.businessId, 30);
  const wabaId = cleanText(body.wabaId, 30);
  const phoneNumberId = cleanText(body.phoneNumberId, 30);

  if (code.length < 20 || !validId(wabaId) || !validId(phoneNumberId) || (businessId && !validId(businessId))
      || body.authorityAccepted !== true || body.privacyAccepted !== true) {
    return response.status(400).json({ ok: false, code: 'INVALID_ONBOARDING_DATA' });
  }

  const eventId = crypto.randomUUID();
  const auditBase = {
    event_id: eventId,
    at: new Date().toISOString(),
    ip_hash: fingerprint,
    invite_id: invite.inviteId,
    company_name: invite.company,
    waba_id: wabaId,
    phone_number_id: phoneNumberId
  };
  const audit = (outcome, detail) => writeAuditRow({
    baseUrl: n8nBaseUrl, apiKey: n8nApiKey, tableId: n8nLogTableId,
    row: { ...auditBase, outcome, detail: String(detail).slice(0, 500) }
  });

  try {
    const token = await exchangeCode(code, appSecret);
    const accessToken = token.access_token;
    const obtainedAt = new Date();

    const tokenInfo = await assertTokenCoversWaba(accessToken, appSecret, wabaId);
    // Metas Business-Integration-Token laufen je nach Konfiguration gar nicht ab.
    // expires_in aus dem Code-Tausch und expires_at aus debug_token koennen
    // beide 0 bzw. leer sein – dann wird bewusst kein Ablaufdatum geschrieben,
    // statt eines aus der Konfigurationsvorlage abgeschriebenen 60-Tage-Werts.
    const expiresAt = token.expires_in
      ? new Date(obtainedAt.getTime() + Number(token.expires_in) * 1000)
      : (tokenInfo.expiresAt ? new Date(tokenInfo.expiresAt * 1000) : null);

    const [waba, phone] = await Promise.all([
      graphJson(`${wabaId}?fields=id,name`, accessToken),
      graphJson(`${phoneNumberId}?fields=id,display_phone_number,verified_name,status,platform_type,code_verification_status,quality_rating`, accessToken)
    ]);

    await graphJson(`${wabaId}/subscribed_apps`, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });

    let registration;
    try {
      registration = await registerIfNeeded(accessToken, phoneNumberId, phone);
    } catch (error) {
      const map = { 133005: 'PIN_CONFLICT', 133016: 'REGISTRATION_RATE_LIMITED', 133006: 'NUMBER_NOT_VERIFIED' };
      const clientCode = map[error.metaCode] || 'REGISTRATION_FAILED';
      await audit('FAILED', `register:${error.metaCode ?? error.status}:${error.metaMessage}`);
      return response.status(409).json({ ok: false, code: clientCode });
    }

    const coexistence = await syncCoexistenceData(accessToken, phoneNumberId);

    const credentialName = `WA · ${invite.company.slice(0, 54)} · ${phoneNumberId}`;
    const credential = await ensureWhatsAppCredential({
      baseUrl: n8nBaseUrl,
      apiKey: n8nApiKey,
      projectId: n8nProjectId,
      credentialType: n8nCredentialType,
      credentialName,
      accessToken,
      wabaId
    });

    const tenantKey = invite.customerReference || `waba_${wabaId}`;
    await upsertTenant({
      baseUrl: n8nBaseUrl,
      apiKey: n8nApiKey,
      tableId: n8nTenantTableId,
      tenant: {
        tenant_key: tenantKey,
        company_name: invite.company,
        work_email: invite.email,
        customer_reference: invite.customerReference,
        meta_business_id: businessId,
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        credential_id: credential.id,
        workflow_id: '',
        status: 'connected_pending_provisioning',
        token_expires_at: expiresAt ? expiresAt.toISOString() : '',
        platform_type: String(phone.platform_type || ''),
        display_phone_number: String(phone.display_phone_number || ''),
        coexistence: coexistence.coexistence ? 'true' : 'false',
        registered_at: registration.registered ? obtainedAt.toISOString() : '',
        provisioned_at: ''
      }
    });

    await audit('OK', `${registration.reason};${coexistence.detail};expires=${expiresAt ? expiresAt.toISOString() : 'never'}`);

    response.setHeader('Set-Cookie', 'hybote_meta_csrf=; Max-Age=0; Path=/api/meta; HttpOnly; Secure; SameSite=Strict');
    return response.status(200).json({
      ok: true,
      connection: {
        wabaId,
        wabaName: waba.name || '',
        phoneNumberId,
        displayPhoneNumber: phone.display_phone_number || '',
        verifiedName: phone.verified_name || '',
        coexistence: coexistence.coexistence,
        expiresAt: expiresAt ? expiresAt.toISOString() : null
      }
    });
  } catch (error) {
    await audit('FAILED', `${error.code || error.message}:${error.metaCode ?? error.status ?? ''}`);
    if (error.code === 'WABA_NOT_AUTHORIZED' || error.code === 'TOKEN_NOT_VALID') {
      return response.status(403).json({ ok: false, code: error.code });
    }
    return response.status(502).json({ ok: false, code: 'ONBOARDING_COMPLETION_FAILED' });
  }
};
