// Cliente mínimo de PayPal Orders v2 (sin SDK): crear orden, consultar, capturar y verificar webhooks.
// El pagador aprueba el cobro en paypal.com; GrooveSpace nunca recibe datos de la cuenta ni de la tarjeta del pagador.
const crypto = require('crypto');

const baseUrl = () => (process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');

let cachedToken = null;

const fail = (message, status = 502) => { const error = new Error(message); error.status = status; return error; };

const accessToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) return cachedToken.value;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw fail('La pasarela de pago no está configurada.', 503);
  const response = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw fail('PayPal rechazó las credenciales del comercio.', 503);
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + (payload.expires_in || 300) * 1000 };
  return cachedToken.value;
};

const request = async (path, { method = 'GET', body, requestId } = {}) => {
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = fail(payload.details?.[0]?.description || payload.message || 'PayPal no pudo procesar la operación.', response.status);
    error.paypalName = payload.name;
    error.paypalIssue = payload.details?.[0]?.issue;
    throw error;
  }
  return payload;
};

const money = (amount) => (Math.round(Number(amount) * 100) / 100).toFixed(2);
exports.money = money;

/**
 * Crea una orden de cobro inmediato (CAPTURE) en MXN.
 * `customId` = "<reservationId>:<paymentType>" permite conciliar el cobro de vuelta con la reserva.
 */
exports.createOrder = async ({ amount, description, customId, returnUrl, cancelUrl, requestId }) => {
  const order = await request('/v2/checkout/orders', {
    method: 'POST',
    requestId,
    body: {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: customId.slice(0, 120),
        custom_id: customId,
        description: String(description).slice(0, 120),
        amount: { currency_code: 'MXN', value: money(amount) }
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'GrooveSpace',
            locale: 'es-MX',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: returnUrl,
            cancel_url: cancelUrl
          }
        }
      }
    }
  });
  const link = (order.links || []).find((item) => ['payer-action', 'approve'].includes(item.rel));
  if (!order.id || !link) throw fail('PayPal no devolvió el enlace de aprobación.');
  return { id: order.id, approveUrl: link.href };
};

exports.getOrder = (orderId) => request(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);

// Idempotente: el mismo PayPal-Request-Id devuelve la misma captura si se reintenta.
exports.captureOrder = (orderId) => request(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', body: {}, requestId: `capture-${orderId}` });

/** Devuelve { orderId, customId, amount, currency } sólo si la orden está COMPLETED y el cobro fue capturado. */
exports.summarizeCompletedOrder = (order) => {
  if (!order || order.status !== 'COMPLETED') return null;
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (!unit || !capture || capture.status !== 'COMPLETED') return null;
  return { orderId: order.id, customId: unit.custom_id || capture.custom_id, amount: capture.amount?.value, currency: capture.amount?.currency_code };
};

/** Valida la firma de un webhook con el servicio de verificación de PayPal. */
exports.verifyWebhook = async (headers, rawBody) => {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw fail('Webhook de PayPal no configurado.', 503);
  const result = await request('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody.toString('utf8'))
    }
  });
  return result.verification_status === 'SUCCESS';
};

exports.newRequestId = () => crypto.randomBytes(12).toString('hex');
