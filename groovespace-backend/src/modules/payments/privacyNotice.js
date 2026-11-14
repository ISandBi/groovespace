const crypto = require('crypto');

// Aviso que la banda debe aceptar antes de pagar. Se versiona y se firma con un hash para dejar
// constancia exacta de qué texto aceptó cada persona (evidencia de consentimiento).
const notice = {
  version: '2026-11-v1',
  title: 'Aviso de protección de datos de pago',
  intro: 'GrooveSpace trata los datos de tu tarjeta conforme a PCI DSS v4.0 y a las guías NIST de seguridad. Este entorno es de simulación: no se realiza ningún cargo real.',
  sections: [
    { heading: 'Qué datos se usan', body: 'Número de tarjeta, vencimiento y código de seguridad se utilizan sólo para validar el pago. El número completo y el CVC no se guardan, no se escriben en bitácoras y se descartan al terminar la operación. Únicamente conservamos la marca y los últimos 4 dígitos para tu recibo.' },
    { heading: 'PCI DSS (Payment Card Industry Data Security Standard)', body: 'Req. 3: no se almacenan datos sensibles de autenticación ni el PAN completo. Req. 4: los datos viajan cifrados por HTTPS/TLS. Req. 6 y 7: el acceso a la información de pagos se limita a quien lo necesita. Req. 8 y 10: sesiones autenticadas y registro de eventos sin datos de tarjeta. En producción, el cobro se aprueba en PayPal (proveedor certificado PCI DSS): GrooveSpace nunca recibe el número de tarjeta ni los datos de la cuenta del pagador, sólo la confirmación del cobro.' },
    { heading: 'NIST', body: 'Aplicamos controles alineados con NIST CSF 2.0 (Identificar, Proteger, Detectar, Responder, Recuperar) y NIST SP 800-53/800-63B: autenticación firmada con vigencia limitada, límite de intentos de pago, mensajes de error genéricos, mínimo privilegio y trazabilidad de acciones.' },
    { heading: 'Tus derechos', body: 'Puedes solicitar acceso, rectificación o cancelación de tus datos personales, y oponerte a su uso, escribiendo a privacidad@groovespace.mx. Conservamos el historial de pagos sólo el tiempo necesario para fines contables y fiscales.' },
    { heading: 'Métodos aceptados', body: 'Visa, Mastercard, American Express, Banorte y Banco Azteca.' }
  ]
};

notice.hash = crypto.createHash('sha256').update(JSON.stringify({ v: notice.version, i: notice.intro, s: notice.sections })).digest('hex');

module.exports = notice;
