import { lazy, Suspense, useEffect, useState } from 'react';
import { FaCheckCircle, FaCreditCard } from 'react-icons/fa';
import './BookingScreen.css';
import { API_URL } from '../api';

const RoomCustomizer = lazy(() => import('./RoomCustomizer'));

export default function PaymentReturn() {
  const query = new URLSearchParams(window.location.search);
  const paymentState = query.get('payment');
  const isDemo = paymentState === 'demo';
  const reservationId = query.get('reservation_id');
  const sessionId = query.get('session_id');
  const [reservation, setReservation] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [loading, setLoading] = useState(paymentState === 'success');
  const [payingBalance, setPayingBalance] = useState(false);
  const [error, setError] = useState('');
  const [bandAccessToken] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('groovespace.bandSession') || 'null')?.accessToken || ''; }
    catch { return ''; }
  });

  useEffect(() => {
    if (!reservationId) return;
    const request = paymentState === 'success' && sessionId
      ? fetch(`${API_URL}/payments/verify/${encodeURIComponent(reservationId)}/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${bandAccessToken}` }
      })
      : fetch(`${API_URL}/reservations/${encodeURIComponent(reservationId)}`, {
        headers: { Authorization: `Bearer ${bandAccessToken}` }
      });
    request
      .then(async (paymentResponse) => {
        const paymentData = await paymentResponse.json();
        if (!paymentResponse.ok) throw new Error(paymentData.error || 'No se pudo confirmar el pago.');
        const nextReservation = paymentData.reservation || paymentData;
        setReservation(nextReservation);
        if (!bandAccessToken) return;
        const bandResponse = await fetch(`${API_URL}/bands/${encodeURIComponent(nextReservation.bandId)}/profile`, {
          headers: { Authorization: `Bearer ${bandAccessToken}` }
        });
        if (bandResponse.ok) {
          const bandData = await bandResponse.json();
          setInstruments(bandData.instruments || []);
        }
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [paymentState, reservationId, sessionId, bandAccessToken]);

  const payBalance = async () => {
    setPayingBalance(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bandAccessToken}` },
        body: JSON.stringify({ reservationId: reservation._id, paymentType: reservation.paymentStatus === 'deposit_pending' ? 'deposit' : 'balance' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo iniciar el pago del saldo.');
      window.location.assign(data.checkoutUrl);
    } catch (requestError) {
      setError(requestError.message);
      setPayingBalance(false);
    }
  };

  return (
    <main className="page-slide-transition" style={{ overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{ maxWidth: '720px', width: '100%', margin: 'auto' }}>
        <section className="console-section-card">
          <FaCheckCircle size={28} color="var(--color-booking-available)" />
          <h1 style={{ fontSize: '24px', color: 'var(--color-text-title)' }}>
            {isDemo ? 'Prueba de personalización 3D' : paymentState === 'cancelled' ? 'Pago no completado' : loading ? 'Verificando pago con Stripe' : reservation ? 'Sala apartada' : 'No se pudo confirmar el pago'}
          </h1>
          {isDemo && <p>Reserva de demostración: no se procesó ningún cargo. Puedes mover los instrumentos y guardar la distribución.</p>}
          {paymentState === 'cancelled' && (reservation?.paymentStatus === 'deposit_paid'
            ? <p>El pago del saldo se canceló. Tu apartado sigue confirmado y el saldo continúa pendiente.</p>
            : reservation?.paymentStatus === 'expired'
              ? <p>El apartado expiró y la sala quedó disponible para otras reservas.</p>
              : <p>El pago se canceló. No se realizó ningún cargo y el apartado sigue pendiente.</p>)}
          {loading && <p>Consultando la confirmación segura de tu transacción...</p>}
          {reservation && (
            <>
              <p>{reservation.roomName} · {reservation.date} · {reservation.startTime}</p>
              {!isDemo && <>
                <p>Anticipo confirmado: ${reservation.depositAmount} MXN · saldo pendiente: ${reservation.balanceAmount} MXN</p>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Liquida el saldo antes del {new Date(reservation.balanceDueAt).toLocaleString('es-MX')}.</p>
              </>}
              {!isDemo && ['deposit_pending', 'deposit_paid'].includes(reservation.paymentStatus) && (reservation.paymentStatus === 'deposit_pending' || reservation.balanceAmount > 0) && (
                <button type="button" className="btn-action-submit-grand btn-stripe-success" onClick={payBalance} disabled={payingBalance}>
                  <FaCreditCard /> <span>{payingBalance ? 'Conectando...' : reservation.paymentStatus === 'deposit_pending' ? `Pagar anticipo de $${reservation.depositAmount} MXN` : `Pagar saldo de $${reservation.balanceAmount} MXN`}</span>
                </button>
              )}
              {reservation.paymentStatus === 'paid' && <p role="status">Pago liquidado por completo.</p>}
            </>
          )}
          {error && <p role="alert" style={{ color: 'var(--color-state-error)' }}>{error}</p>}
          <a href="/" className="btn-grid-action" style={{ display: 'inline-flex', marginTop: '16px', textDecoration: 'none' }}>Volver al catálogo</a>
        </section>
        {['sala_estudio_a', 'sala_orquesta_e'].includes(reservation?.roomId) && instruments.length > 0 && (
          <Suspense fallback={<p role="status">Abriendo la sala 3D...</p>}>
            <RoomCustomizer reservation={reservation} instruments={instruments} accessToken={bandAccessToken} />
          </Suspense>
        )}
      </div>
    </main>
  );
}