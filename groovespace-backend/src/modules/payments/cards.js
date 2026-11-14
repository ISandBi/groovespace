// Validación de tarjetas para la pasarela simulada. Sólo trabaja con datos en memoria:
// el número completo y el CVC NUNCA se guardan ni se escriben en logs (PCI DSS req. 3 y 10).

// Métodos aceptados: red de la tarjeta (Visa, Mastercard, American Express) o emisor mexicano.
// Banorte y Banco Azteca son emisores, no redes: sus tarjetas funcionan sobre Visa o Mastercard.
const METHODS = {
  visa: { label: 'Visa', networks: ['visa'] },
  mastercard: { label: 'Mastercard', networks: ['mastercard'] },
  amex: { label: 'American Express', networks: ['amex'] },
  banorte: { label: 'Banorte', networks: ['visa', 'mastercard'] },
  azteca: { label: 'Banco Azteca', networks: ['visa', 'mastercard'] }
};

const NETWORKS = {
  visa: { label: 'Visa', lengths: [16], cvcLength: 3 },
  mastercard: { label: 'Mastercard', lengths: [16], cvcLength: 3 },
  amex: { label: 'American Express', lengths: [15], cvcLength: 4 }
};

exports.METHODS = METHODS;
exports.publicMethods = () => Object.entries(METHODS).map(([id, { label, networks }]) => ({ id, label, networks }));

exports.digitsOnly = (value) => String(value || '').replace(/[\s-]+/g, '');

exports.detectNetwork = (pan) => {
  if (/^4\d*$/.test(pan)) return 'visa';
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)\d*$/.test(pan)) return 'mastercard';
  if (/^3[47]\d*$/.test(pan)) return 'amex';
  return null;
};

exports.luhn = (pan) => {
  if (!/^\d{12,19}$/.test(pan)) return false;
  let sum = 0;
  for (let i = 0; i < pan.length; i += 1) {
    let digit = Number(pan[pan.length - 1 - i]);
    if (i % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
};

const TEST_DECLINE = '4000000000000002';

/**
 * Devuelve { ok, error?, network?, last4? }. Mensajes genéricos: nunca indican qué dígito falló.
 */
exports.validateCard = ({ method, cardNumber, expiry, cvc, holderName }, now = new Date()) => {
  const methodInfo = METHODS[method];
  if (!methodInfo) return { ok: false, error: 'Elige un método de pago aceptado: Visa, Mastercard, American Express, Banorte o Banco Azteca.' };

  const pan = exports.digitsOnly(cardNumber);
  const network = exports.detectNetwork(pan);
  if (!network || !NETWORKS[network].lengths.includes(pan.length) || !exports.luhn(pan)) {
    return { ok: false, error: 'El número de tarjeta no es válido.' };
  }
  if (!methodInfo.networks.includes(network)) {
    return { ok: false, error: `Esta tarjeta es ${NETWORKS[network].label} y no corresponde al método ${methodInfo.label}.` };
  }

  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(expiry || ''));
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12) return { ok: false, error: 'El vencimiento debe tener el formato MM/AA.' };
  const expiresAt = new Date(2000 + Number(match[2]), Number(match[1]), 1); // primer día del mes siguiente
  if (expiresAt <= now) return { ok: false, error: 'La tarjeta está vencida.' };
  if (expiresAt > new Date(now.getFullYear() + 21, now.getMonth(), 1)) return { ok: false, error: 'El vencimiento no es válido.' };

  if (!new RegExp(`^\\d{${NETWORKS[network].cvcLength}}$`).test(String(cvc || ''))) {
    return { ok: false, error: `El código de seguridad debe tener ${NETWORKS[network].cvcLength} dígitos.` };
  }
  if (typeof holderName === 'string' && holderName.trim().length > 80) return { ok: false, error: 'El nombre del titular es demasiado largo.' };

  if (pan === TEST_DECLINE) return { ok: false, declined: true, error: 'Tarjeta rechazada por el banco emisor (simulación). Prueba con 4242 4242 4242 4242.' };
  return { ok: true, network, last4: pan.slice(-4) };
};
