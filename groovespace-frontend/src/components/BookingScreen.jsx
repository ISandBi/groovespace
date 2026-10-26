import { useEffect, useState } from 'react';
import { FaChevronLeft, FaCalendarAlt, FaUsers, FaGuitar, FaCreditCard, FaLock, FaCube } from 'react-icons/fa';
import './BookingScreen.css';
import { API_URL } from '../api';

const dateAfterDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function BookingScreen({ room, bandInfo, onClose }) {
  const [selectedDate, setSelectedDate] = useState(() => dateAfterDays(2));
  const [startTime, setStartTime] = useState('16:00');
  const [duration, setDuration] = useState(2);
  const [attendees, setAttendees] = useState(5);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [availability, setAvailability] = useState([]);
  const [error, setError] = useState('');
  const [serverConflict, setServerConflict] = useState(false);
  const [inventory, setInventory] = useState([
    { id: 'git_1', name: 'Gibson Les Paul Standard', price: 80, selected: false },
    { id: 'bass_1', name: 'Fender Jazz Bass', price: 70, selected: false },
    { id: 'amp_1', name: 'Marshall JCM800 Combo', price: 100, selected: false },
    { id: 'drum_1', name: 'Platillos Zildjian K Custom', price: 120, selected: false }
  ]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/reservations/room/${encodeURIComponent(room.id)}?date=${encodeURIComponent(selectedDate)}`)
      .then((response) => response.ok ? response.json() : [])
      .then((reservations) => {
        if (!cancelled) setAvailability(reservations.filter((reservation) => reservation.date === selectedDate));
      })
      .catch(() => { if (!cancelled) setAvailability([]); });
    return () => { cancelled = true; };
  }, [room.id, selectedDate]);

  const calculateTotal = () => {
    const roomCost = room.price * duration;
    const gearCost = inventory.filter((item) => item.selected).reduce((sum, item) => sum + item.price * duration, 0);
    return roomCost + gearCost;
  };
  const depositAmount = Math.ceil(calculateTotal() / 2);
  const requestedStart = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5));
  const requestedEnd = requestedStart + duration * 60;
  const overlaps = serverConflict || availability.some((reservation) => {
    const existingStart = Number(reservation.startTime.slice(0, 2)) * 60 + Number(reservation.startTime.slice(3, 5));
    return requestedStart < existingStart + reservation.duration * 60 && existingStart < requestedEnd;
  });

  const handleCheckout = async (event) => {
    event.preventDefault();
    setLoadingPayment(true);
    setError('');
    try {
      const reservationResponse = await fetch(`${API_URL}/reservations/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bandInfo.accessToken}` },
        body: JSON.stringify({
          bandId: bandInfo._id,
          roomId: room.id,
          roomName: room.name,
          date: selectedDate,
          startTime,
          duration,
          attendees,
          rentedGear: inventory.filter((item) => item.selected).map(({ id, name, price }) => ({ id, name, price })),
          totalPrice: calculateTotal()
        })
      });
      const reservationData = await reservationResponse.json();
      if (!reservationResponse.ok) {
        if (/traslapa|ya tiene una sesión/i.test(reservationData.error || '')) setServerConflict(true);
        throw new Error(reservationData.error || 'No se pudo apartar la sala.');
      }

      const checkoutResponse = await fetch(`${API_URL}/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bandInfo.accessToken}` },
        body: JSON.stringify({ reservationId: reservationData.reservation._id, paymentType: 'deposit' })
      });
      const checkoutData = await checkoutResponse.json();
      if (!checkoutResponse.ok) throw new Error(checkoutData.error || 'No se pudo iniciar el pago.');
      window.location.assign(checkoutData.checkoutUrl);
    } catch (requestError) {
      setError(requestError.message);
      setLoadingPayment(false);
    }
  };

  const handleDemoRoom = async () => {
    setLoadingDemo(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/reservations/demo`, {
        method: 'POST',
        body: new Blob([JSON.stringify({ roomId: room.id })], { type: 'application/json' }),
        headers: { Authorization: `Bearer ${bandInfo.accessToken}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo abrir la sala demo.');
      window.location.assign(`/?payment=demo&reservation_id=${encodeURIComponent(data.reservation._id)}`);
    } catch (requestError) {
      setError(requestError.message);
      setLoadingDemo(false);
    }
  };

  return (
    <div className="full-screen-booking-view">
      <header className="premium-header">
        <div className="header-staff-flex">
          <button onClick={() => showCheckout ? setShowCheckout(false) : onClose()} className="btn-back-console">
            <FaChevronLeft size={12} />
            <span>{showCheckout ? 'Ajustar sesión' : 'Catálogo'}</span>
          </button>
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--color-brand-accent)', textTransform: 'uppercase' }}>
            {showCheckout ? 'Pago seguro Stripe' : 'Reserva de sala'}
          </span>
        </div>
      </header>

      {showCheckout ? (
        <div className="booking-form-scrollable" style={{ padding: '24px 20px' }}>
          <form onSubmit={handleCheckout} className="console-section-card">
            <h2 className="console-section-title"><FaCreditCard /> Aparta con el 50%</h2>
            <p style={{ color: 'var(--color-text-body)', lineHeight: 1.6 }}>Stripe procesará tu pago en una página segura. GrooveSpace no recibe ni almacena los datos de tu tarjeta.</p>
            <div style={{ backgroundColor: 'var(--color-surface-background)', padding: '16px', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center', fontSize: '13px', border: '1px solid var(--color-border-default)' }}>
              <FaLock size={16} style={{ color: 'var(--color-booking-available)', flexShrink: 0 }} />
              <span>Anticipo ${depositAmount} MXN · saldo ${calculateTotal() - depositAmount} MXN, liquidable hasta 24 horas antes de la sesión.</span>
            </div>
            <div className="total-calculation-block" style={{ marginTop: '20px' }}>
              <span className="total-label">Total de la sesión</span>
              <strong className="total-amount-display">${calculateTotal()} <span>MXN</span></strong>
            </div>
            {overlaps && <p role="alert" style={{ color: 'var(--color-state-error)' }}>Ese horario ya no está disponible. Vuelve a ajustar la fecha o la hora.</p>}
            {error && <p role="alert" style={{ color: 'var(--color-state-error)' }}>{error}</p>}
            <button type="submit" className="btn-action-submit-grand btn-stripe-success" style={{ marginTop: '12px' }} disabled={loadingPayment || overlaps}>
              <span>{loadingPayment ? 'Conectando con Stripe...' : `Pagar anticipo de $${depositAmount} MXN`}</span>
            </button>
            {import.meta.env.DEV && room.customizable && (
              <button type="button" className="btn-grid-action" style={{ width: '100%', marginTop: '12px', minHeight: '48px' }} onClick={handleDemoRoom} disabled={loadingDemo}>
                <FaCube /> <span>{loadingDemo ? 'Preparando sala...' : 'Probar sala 3D sin pago'}</span>
              </button>
            )}
          </form>
        </div>
      ) : (
        <div className="booking-form-scrollable">
          <div className="booking-summary-hero">
            <img src={room.imagePath} alt={room.name} className="summary-hero-img" />
            <div className="summary-hero-gradient" />
            <div className="summary-hero-text">
              <h2 style={{ color: 'var(--color-text-onDark)' }}>{room.name}</h2>
              <p style={{ color: '#d1d1d6' }}>{bandInfo?.bandName || bandInfo?.name}</p>
            </div>
          </div>

          <div className="form-sections-wrapper" style={{ marginTop: '16px' }}>
            <section className="console-section-card">
              <h2 className="console-section-title"><FaCalendarAlt /> Fecha y horario</h2>
              <label className="form-label-lux" htmlFor="booking-date">Día de ensayo</label>
              <input id="booking-date" type="date" className="input-corporate" min={dateAfterDays(1)} value={selectedDate} onChange={(event) => { setServerConflict(false); setSelectedDate(event.target.value); }} required />
              <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label-lux" htmlFor="booking-time">Hora de entrada</label>
                  <input id="booking-time" type="time" step="900" className="input-corporate" value={startTime} onChange={(event) => { setServerConflict(false); setStartTime(event.target.value); }} required />
                </div>
                <div>
                  <label className="form-label-lux" htmlFor="booking-duration">Duración</label>
                  <select id="booking-duration" className="input-corporate" value={duration} onChange={(event) => { setServerConflict(false); setDuration(Number(event.target.value)); }}>
                    {[1, 2, 3, 4].map((hours) => <option key={hours} value={hours}>{hours} {hours === 1 ? 'hora' : 'horas'}</option>)}
                  </select>
                </div>
              </div>
              {overlaps && <p role="alert" style={{ color: 'var(--color-state-error)', fontSize: '13px' }}>Ese horario se traslapa con otra reserva. Elige otra hora.</p>}
            </section>

            <section className="console-section-card">
              <h2 className="console-section-title"><FaUsers /> Integrantes</h2>
              <label className="form-label-lux" htmlFor="attendees">Músicos en sesión: <strong>{attendees}</strong></label>
              <input id="attendees" type="range" min="1" max={room.capacity} className="slider-premium" value={attendees} onChange={(event) => setAttendees(Number(event.target.value))} />
            </section>

            <section className="console-section-card">
              <h2 className="console-section-title"><FaGuitar /> Renta de backline</h2>
              <div className="gear-premium-matrix">
                {inventory.map((item) => (
                  <label key={item.id} className={`gear-cell-card ${item.selected ? 'selected' : ''}`} style={{ padding: '14px', border: '1px solid var(--color-border-default)', borderRadius: '8px', cursor: 'pointer', marginBottom: '8px' }}>
                    <input type="checkbox" checked={item.selected} onChange={() => setInventory((current) => current.map((gear) => gear.id === item.id ? { ...gear, selected: !gear.selected } : gear))} />
                    <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: '700' }}>{item.name}</span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--color-brand-primary)', marginTop: '6px' }}>+${item.price}/h</span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <div className="console-sticky-footer">
            <div className="total-calculation-block">
              <div><span className="total-label">Total ${calculateTotal()} MXN</span><span className="total-subtext">Anticipo para apartar: ${depositAmount} MXN</span></div>
            </div>
            {import.meta.env.DEV && room.customizable && (
              <button type="button" className="btn-grid-action" style={{ width: '100%', marginBottom: '10px', minHeight: '46px' }} onClick={handleDemoRoom} disabled={loadingDemo}>
                <FaCube /> <span>{loadingDemo ? 'Preparando sala...' : 'Probar sala 3D sin pago'}</span>
              </button>
            )}
            <button type="button" onClick={() => { setError(''); setShowCheckout(true); }} className="btn-action-submit-grand" disabled={overlaps}>
              <span>Continuar al anticipo</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}