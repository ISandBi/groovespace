import { useEffect, useMemo, useState } from 'react';
import { FaChevronLeft, FaCube, FaLock } from 'react-icons/fa';
import { api, formatDate, mxn } from '../lib/http';
import { Link, Redirect, navigate } from '../lib/router.jsx';
import { computeQuote, loadCatalog, newDraft, readDraft, saveDraft } from '../lib/quote';
import { bandActor, useSessions } from '../lib/session';
import { QuoteBuilder, QuotePanel } from '../components/QuoteBuilder.jsx';
import DemoUploader from '../components/DemoUploader.jsx';
import { ErrorNote, Skeleton, useAsync } from '../ui/kit.jsx';

const isoAfter = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Reserva: sesión → fecha y hora → pago (contado, anticipo o apartar 12 h). El servidor recalcula el precio. */
export default function Booking({ roomId }) {
  const sessions = useSessions();
  const actor = bandActor(sessions);
  const catalog = useAsync(loadCatalog, []);
  const room = catalog.data?.rooms.find((item) => item.id === roomId);
  const [draft, setDraft] = useState(() => ({ ...newDraft(roomId), ...(readDraft(roomId) || {}) }));
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState('deposit');
  const [availability, setAvailability] = useState([]);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [terms, setTerms] = useState(null);
  const [typedName, setTypedName] = useState('');

  useEffect(() => { if (!draft.date) setDraft((current) => ({ ...current, date: isoAfter(2) })); }, [draft.date]);
  useEffect(() => { saveDraft(draft); }, [draft]);
  useEffect(() => {
    if (!draft.date) return undefined;
    let cancelled = false;
    api(`/reservations/room/${encodeURIComponent(roomId)}?date=${encodeURIComponent(draft.date)}`).then((list) => { if (!cancelled) setAvailability(list.filter((item) => item.date === draft.date)); }).catch(() => { if (!cancelled) setAvailability([]); });
    return () => { cancelled = true; };
  }, [roomId, draft.date]);
  useEffect(() => { if (actor) api('/contracts/terms', { token: actor.token }).then(setTerms).catch(() => {}); }, [actor?.token]); // eslint-disable-line react-hooks/exhaustive-deps

  const quote = useMemo(() => computeQuote(catalog.data, draft), [catalog.data, draft]);
  const overlaps = useMemo(() => {
    const start = minutes(draft.startTime || '00:00');
    const end = start + draft.duration * 60;
    return conflict || availability.some((item) => start < minutes(item.startTime) + item.duration * 60 && minutes(item.startTime) < end);
  }, [availability, draft.startTime, draft.duration, conflict]);
  const engineer = catalog.data?.engineers.find((item) => item.id === draft.engineerId);

  if (!actor) return <Redirect to={`/registro?next=${encodeURIComponent(`/reservar/${roomId}`)}`} />;
  if (catalog.loading) return <div className="gs-page"><Skeleton rows={4} /></div>;
  if (!room) return <div className="gs-page"><ErrorNote error={catalog.error || 'No encontramos esa sala.'} /></div>;
  if (sessions.band == null) return <div className="gs-page"><p className="gs-error">Sólo el líder de la banda puede apartar salas. Pídele que reserve o que te dé el cargo de tesorero para pagar.</p></div>;

  const setField = (key) => (event) => { setConflict(false); setDraft((current) => ({ ...current, [key]: event.target.value })); };
  const needsTerms = terms && !terms.accepted;

  const submit = async (mode) => {
    setBusy(true); setError('');
    try {
      if (needsTerms) await api('/contracts/terms/accept', { method: 'POST', token: actor.token, body: { typedName } }).then(setTerms);
      const booked = await api('/reservations/book', {
        method: 'POST', token: actor.token,
        body: { bandId: actor.bandId, roomId: room.id, date: draft.date, startTime: draft.startTime, duration: draft.duration, attendees: draft.attendees, rentedGear: draft.gearIds, extras: draft.extraIds, engineerId: draft.engineerId || undefined, payPlan: plan }
      });
      sessionStorage.removeItem('groovespace.quoteDraft');
      if (mode === 'hold') { navigate('/banda?tab=sesiones'); return; }
      const checkout = await api('/payments/checkout', { method: 'POST', token: actor.token, body: { reservationId: booked.reservation._id, paymentType: plan === 'full' ? 'full' : 'deposit' } });
      window.location.assign(checkout.checkoutUrl);
    } catch (requestError) {
      if (/traslapa|ya tiene una sesi|no est[aá] disponible/i.test(requestError.message)) { setConflict(true); setStep(1); }
      setError(requestError.message); setBusy(false);
    }
  };

  const demoRoom = async () => {
    setBusy(true); setError('');
    try { const data = await api('/reservations/demo', { method: 'POST', token: actor.token, body: { roomId: room.id } }); window.location.assign(`/?payment=demo&reservation_id=${encodeURIComponent(data.reservation._id)}`); }
    catch (requestError) { setError(requestError.message); setBusy(false); }
  };

  return (
    <div className="gs-page">
      <button className="gs-btn gs-btn--sm" onClick={() => (step === 2 ? setStep(1) : navigate('/'))}><FaChevronLeft size={10} /> {step === 2 ? 'Ajustar sesión' : 'Salas'}</button>
      <div className="gs-page-head" style={{ marginTop: 18 }}><div><p className="gs-eyebrow">Reserva</p><h1 className="gs-h1">{room.name}</h1></div></div>
      <div className="gs-steps"><span className="done">✓ Cuenta</span><span className={step === 1 ? 'on' : 'done'}>Sesión y fecha</span><span className={step === 2 ? 'on' : ''}>Pago</span></div>

      <div className="gs-split">
        {step === 1 ? (
          <div style={{ display: 'grid', gap: 18 }}>
            <section className="gs-card">
              <h2 className="gs-h2">Fecha y hora</h2>
              <div className="gs-grid gs-grid--2" style={{ gap: 14 }}>
                <label className="gs-field"><span>Día</span><input type="date" min={isoAfter(1)} value={draft.date} onChange={setField('date')} required /></label>
                <label className="gs-field"><span>Hora de entrada</span><input type="time" step="900" value={draft.startTime} onChange={setField('startTime')} required /></label>
              </div>
              {availability.length > 0 && <p className="gs-hint">Ocupado ese día: {availability.map((item) => `${item.startTime} (${item.duration} h)`).join(' · ')}</p>}
              {overlaps && <p className="gs-error" role="alert">Ese horario ya está ocupado. Elige otra hora u otro día.</p>}
            </section>
            <QuoteBuilder catalog={catalog.data} room={room} draft={draft} setDraft={setDraft} />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 18 }}>
            <section className="gs-card">
              <h2 className="gs-h2">¿Cómo quieres pagar?</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                <label className={`gs-choice ${plan === 'deposit' ? 'on' : ''}`}><input type="radio" checked={plan === 'deposit'} onChange={() => setPlan('deposit')} /><div><b>Anticipo del 50% — {mxn(quote.deposit)}</b><small>El saldo de {mxn(quote.balance)} se liquida hasta 24 h antes de tu sesión.</small></div></label>
                <label className={`gs-choice ${plan === 'full' ? 'on' : ''}`}><input type="radio" checked={plan === 'full'} onChange={() => setPlan('full')} /><div><b>Al contado — {mxn(quote.total)}</b><small>Pagas todo hoy y no vuelves a pensar en el saldo.</small></div></label>
              </div>
              <p className="gs-hint" style={{ marginTop: 12 }}><FaLock size={11} /> Al reservar, la sala queda bloqueada 12 horas para tu banda; si no se paga, se libera sola. Recibirás un boleto con QR para el acceso.</p>
            </section>
            {needsTerms && (
              <section className="gs-card">
                <h2 className="gs-h2">{terms.title}</h2>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--color-text-body)', fontSize: 13, lineHeight: 1.6 }}>{terms.body}</pre>
                <label className="gs-field"><span>Acepto firmando con mi nombre completo ({actor.person})</span><input value={typedName} onChange={(event) => setTypedName(event.target.value)} placeholder={actor.person} /></label>
              </section>
            )}
            {engineer && <DemoUploader token={actor.token} engineer={engineer} />}
          </div>
        )}

        <QuotePanel quote={quote} room={room}>
          <p className="gs-hint" style={{ marginTop: 10 }}>{formatDate(draft.date)} · {draft.startTime} · {draft.duration} h</p>
          <ErrorNote error={error} />
          {step === 1 ? (
            <button className="gs-btn gs-btn--primary gs-btn--block" style={{ marginTop: 12 }} disabled={overlaps || !draft.date} onClick={() => { setError(''); setStep(2); }}>Continuar al pago</button>
          ) : (
            <>
              <button className="gs-btn gs-btn--primary gs-btn--block" style={{ marginTop: 12 }} disabled={busy || overlaps || (needsTerms && !typedName.trim())} onClick={() => submit('pay')}>{busy ? 'Procesando…' : plan === 'full' ? `Pagar ${mxn(quote.total)}` : `Pagar anticipo ${mxn(quote.deposit)}`}</button>
              <button className="gs-btn gs-btn--block" style={{ marginTop: 10 }} disabled={busy || overlaps || (needsTerms && !typedName.trim())} onClick={() => submit('hold')}>Apartar y pagar después (12 h)</button>
            </>
          )}
          {import.meta.env.DEV && room.customizable && <button className="gs-btn gs-btn--sm gs-btn--block" style={{ marginTop: 10 }} onClick={demoRoom} disabled={busy}><FaCube /> Probar sala 3D sin pago</button>}
          <Link to={`/cotizar/${room.id}`} className="gs-hint" style={{ display: 'block', marginTop: 10 }}>Ver cotizador</Link>
        </QuotePanel>
      </div>
    </div>
  );
}
