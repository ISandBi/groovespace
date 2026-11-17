import { useState } from 'react';
import { api, formatDateTime, mxn } from '../../lib/http';
import { Empty, ErrorNote, Skeleton, toast, useAsync } from '../../ui/kit.jsx';

/** Cartera interna: saldo, historial, recarga y gasto por mes y por sala. Retiros: aún no. */
export default function Money({ actor }) {
  const wallet = useAsync(() => api('/wallet', { token: actor.token }), [actor.token]);
  const [amount, setAmount] = useState(500);
  const manager = ['lider', 'tesorero'].includes(actor.role);
  const topup = async () => { try { const data = await api('/wallet/topup', { method: 'POST', token: actor.token, body: { amount: Number(amount) } }); window.location.assign(data.checkoutUrl); } catch (error) { toast(error.message, 'err'); } };
  if (wallet.loading) return <Skeleton />;
  if (wallet.error) return <ErrorNote error={wallet.error} />;
  const { balance, entries, spending, withdrawals } = wallet.data;
  const maxMonth = Math.max(1, ...spending.byMonth.map((row) => row.total));
  return (
    <div className="gs-grid gs-grid--2" style={{ alignItems: 'start' }}>
      <div className="gs-card">
        <div className="gs-stat"><span>Saldo disponible</span><strong style={{ color: 'var(--color-brand-primary)', fontSize: 40 }}>{mxn(balance)}</strong></div>
        {manager && <div className="gs-row" style={{ marginTop: 16 }}><input className="gs-input" type="number" min="100" max="20000" step="50" style={{ width: 130 }} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Monto a recargar" /><button className="gs-btn gs-btn--primary" onClick={topup}>Recargar cartera</button></div>}
        <p className="gs-hint" style={{ marginTop: 10 }}>Usa tu saldo para pagar anticipos o saldos desde “Sesiones”. {withdrawals.note}</p>
        <h2 className="gs-h2" style={{ marginTop: 22 }}>Gasto por mes</h2>
        {spending.byMonth.length === 0 ? <p className="gs-hint">Sin gasto todavía.</p> : spending.byMonth.map((row) => <div key={row.month} style={{ margin: '8px 0' }}><div className="gs-row" style={{ justifyContent: 'space-between' }}><span className="gs-hint">{row.month}</span><b>{mxn(row.total)}</b></div><div style={{ height: 8, borderRadius: 0, background: 'rgba(255,255,255,.07)' }}><div style={{ width: `${(row.total / maxMonth) * 100}%`, height: '100%', borderRadius: 0, background: 'var(--color-brand-primary)', transition: 'width .6s' }} /></div></div>)}
        <h2 className="gs-h2" style={{ marginTop: 22 }}>Gasto por sala</h2>
        {spending.byRoom.map((row) => <div className="gs-item" key={row.room} style={{ marginBottom: 8 }}><span>{row.room}</span><b>{mxn(row.total)}</b></div>)}
      </div>
      <div className="gs-card"><h2 className="gs-h2">Historial</h2>
        {entries.length === 0 ? <Empty>Sin movimientos.</Empty> : <div className="gs-list">{entries.map((entry) => <div className="gs-item" key={entry._id}><div><b style={{ color: 'var(--color-text-title)' }}>{entry.concept}</b><div className="gs-hint">{formatDateTime(entry.createdAt)}</div></div><b style={{ color: entry.amount < 0 ? 'var(--color-state-error)' : 'var(--color-brand-primary)' }}>{entry.amount > 0 ? '+' : ''}{mxn(entry.amount)}</b></div>)}</div>}
      </div>
    </div>
  );
}
