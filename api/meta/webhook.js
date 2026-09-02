// Eingangstor fuer alle Meta/WhatsApp-Callbacks.
//
// Warum hier und nicht in n8n: Auf der Produktivinstanz darf ein Code-Node
// weder Umgebungsvariablen lesen ("access to env vars denied") noch
// require('crypto') benutzen ("Module 'crypto' is disallowed"). Eine
// Signaturpruefung ist dort also nur moeglich, wenn man die Sandbox fuer ALLE
// Code-Nodes global aufweicht. Stattdessen prueft Vercel – das App Secret liegt
// ohnehin schon hier – und reicht die geprueften Bytes an einen
// header-authentifizierten n8n-Webhook weiter.
//
// Die Helfer sind bewusst aus complete.js dupliziert und nicht ausgelagert:
// build/verify.mjs nagelt deren Inhalt in complete.js per String-Match fest,
// und complete.js ist der Live-Onboarding-Pfad, den man fuer einen neuen
// Endpunkt nicht anfasst.
const crypto = require('node:crypto');

// Bewusst kuerzer als die 15 s in complete.js: Meta erwartet eine schnelle
// Antwort, und der n8n-Webhook quittiert sofort ("respond immediately").
const FORWARD_TIMEOUT_MS = 5000;
const RAW_BODY_TIMEOUT_MS = 3000;
const MAX_RAW_BODY_BYTES = 1024 * 1024;

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function clientFingerprint(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(forwarded || 'unknown').digest('hex').slice(0, 32);
}

/** Best-effort-Drossel, nur pro Instanz. Wird ausschliesslich auf Fehlerpfaden
 *  aufgerufen: Metas Zustellungen kommen in Schueben von vielen Quell-IPs, ein
 *  429 auf eine echte Zustellung waere selbstgebauter Nachrichtenverlust. */
const recentFailures = new Map();
function rateLimited(key, limit = 20, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const hits = (recentFailures.get(key) || []).filter((stamp) => now - stamp < windowMs);
  hits.push(now);
  recentFailures.set(key, hits);
  if (recentFailures.size > 500) {
    for (const [entry, stamps] of recentFailures) {
      if (!stamps.some((stamp) => now - stamp < windowMs)) recentFailures.delete(entry);
    }
  }
  return hits.length > limit;
}

async function fetchWithTimeout(url, options) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS) });
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
  if (!apiResponse.ok) {
    const error = new Error('N8N_API_ERROR');
    error.status = apiResponse.status;
    throw error;
  }
  return apiResponse.json().catch(() => ({}));
}

/** Nur auf Fehlerpfaden, nie im Erfolgsfall: ein zusaetzlicher Netzwerk-Roundtrip
 *  je eingehender Nachricht passt nicht in Metas Antwortbudget. Bewusst nicht
 *  fatal – ein fehlendes Protokoll darf keine Zustellung verhindern. */
async function writeFailureRow(row) {
  const tableId = process.env.N8N_WEBHOOK_LOG_TABLE_ID || '';
  const baseUrl = process.env.N8N_BASE_URL || '';
  const apiKey = process.env.N8N_API_KEY || '';
  if (!tableId || !baseUrl || !apiKey) return;
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

/** Liest die Rohbytes des Requests.
 *
 *  Vercels Node-Helper puffert den Body eager und spielt ihn danach ueber einen
 *  PassThrough wieder ab – aber nur ueber die gepatchten request.on('data') und
 *  request.on('end'). for-await, once() und pipe() laufen daran vorbei und
 *  liefern nichts. Deshalb ausschliesslich .on().
 *
 *  Es gibt bewusst KEINEN Rueckfall auf JSON.stringify(request.body): eine
 *  neu serialisierte Nutzlast reproduziert Metas Bytes nicht (Schluesselreihen-
 *  folge, Unicode-Escapes, Whitespace) und die Signaturpruefung wuerde
 *  sporadisch scheitern. Bleibt der Stream stumm, scheitert dieser Endpunkt
 *  lieber laut mit RAW_BODY_UNAVAILABLE. */
function readRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };

    const timer = setTimeout(() => {
      const error = new Error('RAW_BODY_UNAVAILABLE');
      error.code = 'RAW_BODY_UNAVAILABLE';
      finish(error);
    }, RAW_BODY_TIMEOUT_MS);

    request.on('data', (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_RAW_BODY_BYTES) {
        const error = new Error('RAW_BODY_TOO_LARGE');
        error.code = 'RAW_BODY_TOO_LARGE';
        finish(error);
        return;
      }
      chunks.push(buffer);
    });
    request.on('end', () => finish(null, Buffer.concat(chunks)));
    request.on('error', (error) => finish(error));
  });
}

function verifySignature(rawBody, headerValue, appSecret) {
  const header = String(headerValue || '');
  if (!header.startsWith('sha256=')) return false;
  const provided = header.slice('sha256='.length);
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return safeEqual(provided, expected);
}

function webhookConfig() {
  return {
    appSecret: process.env.META_APP_SECRET || '',
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
    webhookUrl: process.env.N8N_WHATSAPP_WEBHOOK_URL || '',
    authHeader: process.env.N8N_WEBHOOK_AUTH_HEADER || 'X-Hybote-Webhook-Token',
    authValue: process.env.N8N_WEBHOOK_AUTH_VALUE || ''
  };
}

// Liefert die Namen der Variablen, die den Endpunkt blockieren – niemals deren
// Werte. Eine Fehlkonfiguration kostet jede eingehende Nachricht, also muss aus
// dem Log ohne Raten hervorgehen, welche der fuenf Variablen fehlt.
function misconfigured(config) {
  const missing = [];
  if (!config.appSecret) missing.push('META_APP_SECRET');
  if (config.verifyToken.length < 32) missing.push('META_WEBHOOK_VERIFY_TOKEN');
  if (!config.webhookUrl.startsWith('https://')) missing.push('N8N_WHATSAPP_WEBHOOK_URL');
  if (!/^[A-Za-z0-9-]{3,64}$/.test(config.authHeader)) missing.push('N8N_WEBHOOK_AUTH_HEADER');
  if (config.authValue.length < 32) missing.push('N8N_WEBHOOK_AUTH_VALUE');
  return missing;
}

async function forwardToN8n(rawBody, signatureHeader, deliveryId, config) {
  const forwarded = await fetchWithTimeout(config.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      [config.authHeader]: config.authValue,
      // Nur zur Diagnose in n8n – geprueft wurde hier, nicht dort.
      'X-Hub-Signature-256': String(signatureHeader || ''),
      'X-Hybote-Delivery': deliveryId
    },
    body: rawBody
  });
  // Die Antwort von n8n wird gelesen und verworfen: sie darf niemals an Meta
  // durchgereicht werden.
  await forwarded.text().catch(() => '');
  return { ok: forwarded.ok, status: forwarded.status };
}

function handleVerification(request, response) {
  const config = webhookConfig();
  if (config.verifyToken.length < 32) {
    return response.status(503).json({ ok: false, code: 'WEBHOOK_NOT_CONFIGURED' });
  }

  // Bewusst ueber die URL statt ueber request.query: der body-Getter der
  // Vercel-Helper ist enumerable und wirft bei fehlerhaftem JSON. Dieses
  // Request-Objekt wird nirgends geloggt, gespreadet oder stringifiziert.
  const url = new URL(request.url || '/', 'https://hybote.ai');
  const mode = url.searchParams.get('hub.mode') || '';
  const token = url.searchParams.get('hub.verify_token') || '';
  const challenge = url.searchParams.get('hub.challenge') || '';

  if (mode !== 'subscribe' || !safeEqual(token, config.verifyToken)) {
    rateLimited(clientFingerprint(request));
    return response.status(403).json({ ok: false, code: 'VERIFY_TOKEN_INVALID' });
  }
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(challenge)) {
    return response.status(400).json({ ok: false, code: 'CHALLENGE_INVALID' });
  }

  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return response.status(200).send(challenge);
}

async function handleDelivery(request, response) {
  const config = webhookConfig();
  const missing = misconfigured(config);
  if (missing.length > 0) {
    // 503 statt 200: eine Fehlkonfiguration darf keine Nachrichten
    // stillschweigend verschlucken, Meta soll wiederholen.
    console.error('meta_webhook not_configured missing=%s', missing.join(','));
    return response.status(503).json({ ok: false, code: 'WEBHOOK_NOT_CONFIGURED' });
  }

  const signatureHeader = request.headers['x-hub-signature-256'];
  if (!signatureHeader) {
    rateLimited(clientFingerprint(request));
    return response.status(401).json({ ok: false, code: 'SIGNATURE_MISSING' });
  }

  let rawBody;
  try {
    rawBody = await readRawBody(request);
  } catch (error) {
    if (error.code === 'RAW_BODY_TOO_LARGE') {
      return response.status(413).json({ ok: false, code: 'PAYLOAD_TOO_LARGE' });
    }
    // Das ist das Signal, dass Vercels restoreBody nicht mehr greift.
    console.error('meta_webhook raw_body_unavailable', error.code || error.message);
    await writeFailureRow({
      event_id: crypto.randomUUID(),
      at: new Date().toISOString(),
      ip_hash: clientFingerprint(request),
      outcome: 'RAW_BODY_UNAVAILABLE',
      detail: String(error.code || error.message).slice(0, 500)
    });
    return response.status(503).json({ ok: false, code: 'RAW_BODY_UNAVAILABLE' });
  }

  const deliveryId = crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 32);

  if (!verifySignature(rawBody, signatureHeader, config.appSecret)) {
    rateLimited(clientFingerprint(request));
    // Nie den Body loggen – nur, was zur Diagnose eines falschen App Secrets reicht.
    console.warn('meta_webhook signature_invalid raw_len=%d content_length=%s',
      rawBody.length, String(request.headers['content-length'] || ''));
    await writeFailureRow({
      event_id: crypto.randomUUID(),
      at: new Date().toISOString(),
      ip_hash: clientFingerprint(request),
      outcome: 'SIGNATURE_INVALID',
      detail: `raw_len=${rawBody.length}`
    });
    return response.status(401).json({ ok: false, code: 'SIGNATURE_INVALID' });
  }

  let forwarded;
  try {
    forwarded = await forwardToN8n(rawBody, signatureHeader, deliveryId, config);
  } catch (error) {
    forwarded = { ok: false, status: 0, detail: String(error.name || error.message) };
  }

  if (!forwarded.ok) {
    console.error('meta_webhook forward_failed delivery=%s n8n_status=%s', deliveryId, String(forwarded.status));
    await writeFailureRow({
      event_id: deliveryId,
      at: new Date().toISOString(),
      ip_hash: clientFingerprint(request),
      outcome: 'FORWARD_FAILED',
      detail: `n8n_status=${forwarded.status}${forwarded.detail ? `:${forwarded.detail}` : ''}`
    });
    // 502 statt 200: eingehende WhatsApp-Nachrichten sind nicht reproduzierbar,
    // Meta ist die einzige Quelle. Metas At-least-once-Retry ist damit unsere
    // Warteschlange fuer kurze n8n-Ausfaelle. Der Workflow dedupliziert.
    return response.status(502).json({ ok: false, code: 'FORWARD_FAILED' });
  }

  console.log('meta_webhook ok delivery=%s raw_len=%d content_length=%s n8n_status=%s',
    deliveryId, rawBody.length, String(request.headers['content-length'] || ''), String(forwarded.status));
  return response.status(200).json({ ok: true });
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');

  if (request.method === 'GET') return handleVerification(request, response);
  if (request.method === 'POST') return handleDelivery(request, response);

  response.setHeader('Allow', 'GET, POST');
  return response.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
};
