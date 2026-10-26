import { useState } from 'react';
import { FaCreditCard, FaLock } from 'react-icons/fa';
import './BookingScreen.css';

export default function StripeCheckout({ total, onFinalize }) {
  const [loading, setLoading] = useState(false);

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simula una latencia de red de 1.2 segundos para la validación de Stripe
    setTimeout(() => {
      setLoading(false);
      onFinalize();
    }, 1200);
  };

  return (
    <div className="booking-form-scrollable" style={{ padding: '24px 20px' }}>
      <form onSubmit={handlePaymentSubmit} className="console-section-card">
        <h4 className="console-section-title"><FaCreditCard /> Checkout Protegido (Stripe Link)</h4>
        <div style={{ marginBottom: '16px' }}>
          <label className="form-label-lux">Número de Tarjeta Bancaria</label>
          <input type="text" className="input-corporate" required placeholder="4000 1234 5678 9010" disabled={loading} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <div>
            <label className="form-label-lux">Vencimiento</label>
            <input type="text" className="input-corporate" required placeholder="MM/AA" disabled={loading} />
          </div>
          <div>
            <label className="form-label-lux">Código CVC</label>
            <input type="password" className="input-corporate" required placeholder="•••" disabled={loading} />
          </div>
        </div>
        <div style={{ backgroundColor: 'var(--color-surface-background)', padding: '16px', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px', border: '1px solid var(--color-border-default)' }}>
          <FaLock size={16} style={{ color: 'var(--color-booking-available)' }} />
          <span>Liquidación garantizada con abono inmediato y prevención de doble reserva.</span>
        </div>

        <div className="console-sticky-footer" style={{ position: 'static', padding: '20px 0 0 0', marginTop: '24px', boxShadow: 'none', borderTop: '1px solid var(--color-border-default)' }}>
          <div className="total-calculation-block">
            <div><span className="total-label">Total Operación</span></div>
            <div className="total-amount-display" style={{ color: 'var(--color-booking-available)' }}>${total} <span>MXN</span></div>
          </div>
          <button type="submit" className="btn-action-submit-grand btn-stripe-success" disabled={loading}>
            <span>{loading ? 'Validando Fondos...' : 'Liquidar e Inmovilizar Sala'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
