import { useState } from 'react';
import { FaEnvelope, FaTelegramPlane, FaWhatsapp, FaCopy } from 'react-icons/fa';
import { api } from '../lib/http';
import { ErrorNote, toast } from '../ui/kit.jsx';

/** Genera un enlace de invitación y lo comparte por WhatsApp, Telegram, correo del dispositivo o correo enviado por GrooveSpace. */
export default function SharePanel({ token }) {
  const [links, setLinks] = useState(null);
  const [emails, setEmails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setBusy(true); setError('');
    try { setLinks(await api('/band/invite-links', { method: 'POST', token })); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(links.url); toast('Enlace copiado'); } catch { toast('Copia el enlace manualmente', 'err'); }
  };
  const sendEmails = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api('/band/invite-email', { method: 'POST', token, body: { emails: emails.split(/[\s,;]+/).filter(Boolean) } });
      toast(result.simulated ? 'Correos registrados en modo prueba (falta configurar el envío real).' : 'Invitaciones enviadas');
      setEmails('');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  if (!links) return <><button className="gs-btn gs-btn--primary" onClick={generate} disabled={busy}>{busy ? 'Generando…' : 'Crear enlace de invitación'}</button><ErrorNote error={error} /></>;
  return (
    <div>
      <div className="gs-item" style={{ wordBreak: 'break-all', color: 'var(--color-brand-primary)', fontWeight: 700 }}>{links.url}</div>
      <p className="gs-hint">Vigente {links.expiresInDays} días. Cada persona agrega su nombre e instrumento desde su teléfono.</p>
      <div className="gs-row" style={{ margin: '12px 0' }}>
        <a className="gs-btn" href={links.share.whatsapp} target="_blank" rel="noreferrer" style={{ borderColor: '#25d366', color: '#25d366' }}><FaWhatsapp /> WhatsApp</a>
        <a className="gs-btn" href={links.share.telegram} target="_blank" rel="noreferrer" style={{ borderColor: '#35a7e6', color: '#35a7e6' }}><FaTelegramPlane /> Telegram</a>
        <a className="gs-btn" href={links.share.email}><FaEnvelope /> Mi correo</a>
        <button className="gs-btn" onClick={copy}><FaCopy /> Copiar</button>
      </div>
      <form onSubmit={sendEmails}>
        <label className="gs-field"><span>O envía la invitación desde GrooveSpace (hasta 10 correos)</span><input value={emails} onChange={(event) => setEmails(event.target.value)} placeholder="ana@correo.com, luis@correo.com" /></label>
        <button className="gs-btn gs-btn--sm" disabled={busy || !emails.trim()}>Enviar correos</button>
      </form>
      <ErrorNote error={error} />
    </div>
  );
}
