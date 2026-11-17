import { lazy, Suspense, useEffect, useState } from 'react';
import { IcCheckCircle, IcCard } from '../ui/icons.jsx';
import { api, formatDateTime, mxn } from '../lib/http';
import { bandActor, useSessions } from '../lib/session';
import { Link } from '../lib/router.jsx';
import { ErrorNote } from '../ui/kit.jsx';
import TicketCard from './TicketCard.jsx';

const RoomCustomizer = lazy(() => import('./RoomCustomizer'));

/** Regreso de la pasarela: confirma el pago, muestra el boleto 3D y permite liquidar el saldo. */
export default function PaymentReturn() {
  const query = new URLSearchParams(window.location.search);
  const state = query.get('payment');
  const reservationId = query.get('reservation_id');
  const sessionId = query.get('session_id') || query.get('token'); // PayPal regresa con ?token=<id de orden>
  const isDemo = state === 'demo';
  const actor = bandActor(useSessions());
  const token = actor?.token || '';
  const [reservation, setReservation] = useState(null);
  const [band, setBand] = useState({ name: '', instruments: [] });
  const [loading, setLoading] = useState(state === 'success');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reservationId || !token) { setLoading(false); return; }
    const request = state === 'success' && sessionId ? api(`/payments/verify/${encodeURIComponent(reservationId)}/${encodeURIComponent(sessionId)}`, { token }) : api(`/reservations/${encodeURIComponent(reservationId)}`, { token });
    request.then(async (data) => {
      const next = data.reservation || data;
      setReservation(next);
      const profile = await api(`/bands/${encodeURIComponent(next.bandId)}/profile`, { token }).catch(() => null);
      if (profile) setBand({ name: profile.name || profile.bandName || '', instruments: profile.instruments || [] });
    }).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, [state, reservationId, sessionId, token]);

  const payNext = async () => {
    setPaying(true); setError('');
    try {
      const data = await api('/payments/checkout', { method: 'POST', token, body: { reservationId: reservation._id, paymentType: reservation.paymentStatus === 'deposit_pending' ? (reservation.payPlan === 'full' ? 'full' : 'deposit') : 'balance' } });
      window.location.assign(data.checkoutUrl);
    } catch (requestError) { setError(requestError.message); setPaying(false); }
  };

  const title = isDemo ? 'Prueba de personalización 3D' : state === 'cancelled' ? 'Pago no completado' : loading ? 'Confirmando tu pago…' : reservation ? (reservation.ticketCode ? 'Pago confirmado' : 'Sala apartada') : 'No se pudo confirmar el pago';
  const pending = reservation && ['deposit_pending', 'deposit_paid'].includes(reservation.paymentStatus) && (reservation.paymentStatus === 'deposit_pending' || reservation.balanceAmount > 0);
  const nextAmount = reservation ? (reservation.paymentStatus === 'deposit_pending' ? (reservation.payPlan === 'full' ? reservation.totalPrice : reservation.depositAmount) : reservation.balanceAmount) : 0;

  return (
    <div className="gs-page" style={{ maxWidth: 860 }}>
      <div className="gs-card" style={{ textAlign: 'center' }}>
        <IcCheckCircle size={30} color={state === 'cancelled' ? 'var(--color-booking-maintenance)' : 'var(--color-brand-primary)'} />
        <h1 className="gs-h1" style={{ fontSize: 30, margin: '10px 0' }}>{title}</h1>
        {isDemo && <p className="gs-hint">Reserva de demostración: no se procesó ningún cargo. Mueve los instrumentos y guarda la distribución.</p>}
        {state === 'cancelled' && <p className="gs-hint">{reservation?.paymentStatus === 'expired' ? 'El apartado expiró y la sala quedó disponible.' : 'No se realizó ningún cargo. Tu apartado sigue pendiente mientras dure la ventana de 12 horas.'}</p>}
        {!token && !isDemo && <p className="gs-hint">Inicia sesión para ver el estado de tu reserva. <Link to="/banda">Entrar</Link></p>}
        {reservation && (
          <>
            <p className="gs-hint">{reservation.roomName} · {reservation.date} · {reservation.startTime}</p>
            <TicketCard reservation={reservation} bandName={band.name} />
            {!isDemo && reservation.paymentStatus === 'deposit_paid' && reservation.balanceDueAt && <p className="gs-hint" style={{ marginTop: 14 }}>Saldo pendiente {mxn(reservation.balanceAmount)} · liquídalo antes del {formatDateTime(reservation.balanceDueAt)}.</p>}
            {!isDemo && pending && <button className="gs-btn gs-btn--primary" style={{ marginTop: 14 }} onClick={payNext} disabled={paying}><IcCard /> {paying ? 'Conectando…' : reservation.paymentStatus === 'deposit_pending' ? `Pagar ${mxn(nextAmount)}` : `Pagar saldo ${mxn(nextAmount)}`}</button>}
            {reservation.paymentStatus === 'paid' && <p className="gs-ok" role="status">Pago liquidado por completo.</p>}
          </>
        )}
        <ErrorNote error={error} />
        <div className="gs-row" style={{ justifyContent: 'center', marginTop: 16 }}><Link to="/banda" className="gs-btn">Mi banda</Link><Link to="/" className="gs-btn">Volver a las salas</Link></div>
      </div>
      {['sala_estudio_a', 'sala_orquesta_e'].includes(reservation?.roomId) && band.instruments.length > 0 && (
        <Suspense fallback={<p role="status" className="gs-hint">Abriendo la sala 3D…</p>}>
          <RoomCustomizer reservation={reservation} instruments={band.instruments} accessToken={token} />
        </Suspense>
      )}
    </div>
  );
}
