// Envío de correo por HTTP (Resend). Sin llave configurada, el correo se imprime en consola:
// así el desarrollo no necesita credenciales y nada se envía por accidente.
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

exports.escapeHtml = escapeHtml;
exports.isMailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

exports.sendMail = async ({ to, subject, text, html }) => {
  if (!to) return { delivered: false, reason: 'sin_destinatario' };
  if (!exports.isMailConfigured()) {
    console.info(`[GrooveSpace] (correo simulado) Para: ${to} · Asunto: ${subject}`);
    return { delivered: false, reason: 'simulado' };
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text, html: html || `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>` })
  });
  if (!response.ok) throw new Error(`El proveedor de correo respondió ${response.status}.`);
  return { delivered: true };
};
