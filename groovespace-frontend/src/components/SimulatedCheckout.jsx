import { useMemo, useState } from 'react';
import { IcLock, IcShield, IcCard } from '../ui/icons.jsx';
import { api, mxn } from '../lib/http';
import { bandActor, useSessions } from '../lib/session';
import { Link } from '../lib/router.jsx';
import { ErrorNote, Modal, Skeleton, useAsync } from '../ui/kit.jsx';
import { Ticket3D } from './TicketCard.jsx';
import { formatDate } from '../lib/http';

const formatCard = (value, amex) => {
  const digits = value.replace(/\D/g, '').slice(0, amex ? 15 : 16);
  return amex ? digits.replace(/^(\d{4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' ')) : digits.replace(/(.{4})/g, '$1 ').trim();
};
const formatExpiry = (value) => { const d = value.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
const detect = (pan) => (/^4/.test(pan) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(pan) ? 'Mastercard' : /^3[47]/.test(pan) ? 'American Express' : '');
const luhn = (pan) => { if (!/^\d{12,19}$/.test(pan)) return false; let sum = 0; for (let i = 0; i < pan.length; i += 1) { let d = Number(pan[pan.length - 1 - i]); if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; } return sum % 10 === 0; };

/** Pantalla de pago con validación en vivo (Luhn, red, vencimiento, CVC) y aviso PCI DSS / NIST obligatorio. */
export default function SimulatedCheckout() {
  const query = new URLSearchParams(window.location.search);
  const reservationId = query.get('reservation_id') || '';
  const sessionId = query.get('session_id') || '';
  const paymentType = query.get('payment_type') || 'deposit';
  const sessions = useSessions();
  const actor = bandActor(sessions);
  const config = useAsync(() => api('/payments/config'), []);
  const session = useAsync(() => api(`/payments/session/${encodeURIComponent(sessionId)}?payment_type=${paymentType}`), [sessionId]);
  const [method, setMethod] = useState('visa');
  const [holder, setHolder] = useState('');
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const pan = card.replace(/\s/g, '');
  const network = detect(pan);
  const amex = network === 'American Express';
  const cardOk = luhn(pan) && (amex ? pan.length === 15 : pan.length === 16);
  const expiryOk = useMemo(() => { const m = /^(\d{2})\/(\d{2})$/.exec(expiry); return Boolean(m) && Number(m[1]) >= 1 && Number(m[1]) <= 12 && new Date(2000 + Number(m[2]), Number(m[1]), 1) > new Date(); }, [expiry]);
  const cvcOk = cvc.length === (amex ? 4 : 3);
  const valid = cardOk && expiryOk && cvcOk && accepted;

  const pay = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const notice = config.data.privacyNotice;
      const data = await api('/payments/simulate', {
        method: 'POST', token: actor?.token,
        body: { reservationId: reservationId || undefined, paymentType, sessionId, method, holderName: holder, cardNumber: pan, expiry, cvc, privacyAccepted: true, privacyVersion: notice.version }
      });
      setCard(''); setCvc('');
      if (reservationId) { window.location.assign(`/?payment=success&reservation_id=${encodeURIComponent(reservationId)}&session_id=${encodeURIComponent(sessionId)}`); return; }
      if (data.purpose === 'event_ticket' && data.result?.code) {
        try { const list = JSON.parse(localStorage.getItem('groovespace.eventTickets') || '[]'); localStorage.setItem('groovespace.eventTickets', JSON.stringify([data.result, ...list].slice(0, 30))); } catch { /* sin almacenamiento */ }
      }
      setDone(data);
    } catch (requestError) { setError(requestError.message); setBusy(false); }
  };

  if (config.loading || session.loading) return <div className="gs-page"><Skeleton rows={4} /></div>;
  if (config.error || session.error) return <div className="gs-page" style={{ maxWidth: 560 }}><div className="gs-card"><ErrorNote error={config.error || session.error} /><Link to="/" className="gs-btn">Volver</Link></div></div>;

  if (done) {
    const result = done.result;
    return (
      <div className="gs-page" style={{ maxWidth: 760, textAlign: 'center' }}>
        <p className="gs-eyebrow">Pago confirmado</p>
        <h1 className="gs-h1">¡Listo!</h1>
        <p className="gs-hint">Pagado con {done.receipt.brand} terminación {done.receipt.last4}. No guardamos tu número de tarjeta.</p>
        {done.purpose === 'event_ticket' && result?.code && <Ticket3D code={result.code} title={result.eventTitle} subtitle={result.venue} details={[['Fecha', formatDate(result.date)], ['Hora', result.startTime], ['Boletos', String(result.quantity)], ['A nombre de', result.buyerName]]} status="Boleto vigente" />}
        {done.purpose === 'wallet_topup' && <p style={{ fontSize: 22, color: 'var(--color-brand-primary)' }}>Nuevo saldo: {mxn(result?.balance)}</p>}
        <Link to={done.returnPath || '/'} className="gs-btn gs-btn--primary" style={{ marginTop: 20 }}>Continuar</Link>
      </div>
    );
  }

  const { methods, privacyNotice, simulated } = config.data;
  const info = session.data;
  if (info.requiresLogin && !actor) return <div className="gs-page" style={{ maxWidth: 560 }}><div className="gs-card"><p>Inicia sesión con la banda que generó este pago para continuar.</p><Link className="gs-btn gs-btn--primary" to={`/registro?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Iniciar sesión</Link></div></div>;

  return (
    <div className="gs-page">
      <p className="gs-eyebrow">Pago seguro</p>
      <h1 className="gs-h1">Confirma tu pago</h1>
      <div className="gs-split" style={{ marginTop: 22 }}>
        <form className="gs-card" onSubmit={pay} autoComplete="off">
          {simulated && <p className="gs-badge gs-badge--warn" style={{ marginBottom: 14 }}>Modo de pruebas · no se realiza ningún cargo real</p>}
          <div className="gs-field"><span>Método de pago</span>
            <div className="gs-row">{methods.map((item) => <button type="button" key={item.id} className={`gs-btn gs-btn--sm ${method === item.id ? 'gs-btn--primary' : ''}`} aria-pressed={method === item.id} onClick={() => setMethod(item.id)}>{item.label}</button>)}</div>
          </div>
          <label className="gs-field"><span>Nombre del titular</span><input value={holder} maxLength={80} onChange={(event) => setHolder(event.target.value)} autoComplete="cc-name" placeholder="Como aparece en la tarjeta" /></label>
          <label className="gs-field"><span>Número de tarjeta {network && <b style={{ color: 'var(--color-brand-primary)' }}>· {network}</b>}</span>
            <input inputMode="numeric" autoComplete="cc-number" value={card} onChange={(event) => setCard(formatCard(event.target.value, /^3[47]/.test(event.target.value.replace(/\D/g, ''))))} placeholder="0000 0000 0000 0000" aria-invalid={card.length > 0 && !cardOk} required />
            {card.length > 0 && !cardOk && pan.length >= 15 && <small className="gs-error">El número no pasa la validación.</small>}
          </label>
          <div className="gs-grid gs-grid--2" style={{ gap: 12 }}>
            <label className="gs-field"><span>Vence (MM/AA)</span><input inputMode="numeric" autoComplete="cc-exp" value={expiry} onChange={(event) => setExpiry(formatExpiry(event.target.value))} placeholder="MM/AA" aria-invalid={expiry.length === 5 && !expiryOk} required /></label>
            <label className="gs-field"><span>CVC</span><input inputMode="numeric" type="password" autoComplete="cc-csc" value={cvc} onChange={(event) => setCvc(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder={amex ? '4 dígitos' : '3 dígitos'} required /></label>
          </div>
          <label className={`gs-choice ${accepted ? 'on' : ''}`} style={{ margin: '6px 0 14px' }}>
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <div><b>He leído el aviso de protección de datos de pago</b><small>PCI DSS v4.0 y NIST. <button type="button" className="gs-btn gs-btn--sm" style={{ minHeight: 24, padding: '0 10px' }} onClick={() => setShowNotice(true)}>Leer aviso</button></small></div>
          </label>
          <ErrorNote error={error} />
          <button className="gs-btn gs-btn--primary gs-btn--block" disabled={!valid || busy}><IcLock size={12} /> {busy ? 'Procesando…' : `Pagar ${mxn(info.amount)}`}</button>
          <p className="gs-hint" style={{ marginTop: 12 }}>Tarjetas de prueba: 4242 4242 4242 4242 (aprobada) · 4000 0000 0000 0002 (rechazada). Cualquier fecha futura y CVC.</p>
        </form>

        <aside className="gs-card gs-sticky">
          <p className="gs-eyebrow">Resumen</p>
          <h3 style={{ margin: '6px 0', color: 'var(--color-text-title)' }}>{info.label}</h3>
          <div className="gs-quote-total"><span className="gs-hint">Total a pagar</span><strong>{mxn(info.amount)}</strong></div>
          <div className="gs-list" style={{ marginTop: 16, fontSize: 12, color: 'var(--color-text-muted)' }}>
            <span><IcShield /> No guardamos tu número de tarjeta ni el CVC.</span>
            <span><IcLock /> Conexión cifrada y aviso versionado con huella digital.</span>
            <span><IcCard /> Aceptamos {methods.map((item) => item.label).join(', ')}.</span>
          </div>
          <Link to={info.returnPath || '/'} className="gs-btn gs-btn--sm gs-btn--block" style={{ marginTop: 16 }}>Cancelar y volver</Link>
        </aside>
      </div>
      {showNotice && (
        <Modal title={privacyNotice.title} onClose={() => setShowNotice(false)}>
          <p className="gs-hint">{privacyNotice.intro}</p>
          {privacyNotice.sections.map((section) => <div key={section.heading} style={{ margin: '14px 0' }}><b style={{ color: 'var(--color-text-title)' }}>{section.heading}</b><p className="gs-hint" style={{ margin: '4px 0 0' }}>{section.body}</p></div>)}
          <p className="gs-hint" style={{ fontFamily: 'ui-monospace,monospace', wordBreak: 'break-all' }}>Versión {privacyNotice.version} · huella {privacyNotice.hash.slice(0, 24)}…</p>
          <button className="gs-btn gs-btn--primary gs-btn--block" onClick={() => { setAccepted(true); setShowNotice(false); }}>Entendido y acepto</button>
        </Modal>
      )}
    </div>
  );
}
