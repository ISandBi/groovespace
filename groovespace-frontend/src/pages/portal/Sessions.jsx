import { useState } from 'react';
import { IcCube, IcTicket, IcWallet } from '../../ui/icons.jsx';
import { api, formatDate, mxn } from '../../lib/http';
import { Empty, ErrorNote, Modal, Skeleton, toast, useAsync } from '../../ui/kit.jsx';
import TicketCard from '../../components/TicketCard.jsx';
import ChatBox from '../../components/ChatBox.jsx';

const STATUS = { deposit_pending: ['gs-badge--warn', 'Esperando anticipo'], deposit_paid: ['gs-badge--violet', 'Anticipo pagado'], paid: ['gs-badge--ok', 'Pagado'], expired: ['gs-badge--err', 'Expirada'] };
const ATTEND = [['going', 'Voy'], ['maybe', 'Tal vez'], ['no', 'No voy']];

function SplitPanel({ reservation, actor, onChange }) {
  const plan = reservation.sharePlan;
  const type = reservation.paymentStatus === 'deposit_pending' ? (reservation.payPlan === 'full' ? 'full' : 'deposit') : 'balance';
  const me = actor.raw?.memberId || 'leader';
  const run = async (action) => { try { const data = await action(); if (data?.checkoutUrl) window.location.assign(data.checkoutUrl); else onChange(); } catch (error) { toast(error.message, 'err'); } };
  if (!plan) return <button className="gs-btn gs-btn--sm" onClick={() => run(() => api(`/splits/${reservation.id}`, { method: 'POST', token: actor.token, body: { paymentType: type, mode: 'equal' } }))}>Dividir pago entre la banda</button>;
  return (
    <div className="gs-list">
      <b style={{ color: 'var(--color-text-title)' }}>Pago dividido</b>
      {plan.shares.map((share) => (
        <div className="gs-item" key={share.memberId}><span>{share.name} · {mxn(share.amount)}</span>
          {share.status === 'paid' ? <span className="gs-badge gs-badge--ok">Pagó</span> : (share.memberId === me || ['lider', 'tesorero'].includes(actor.role)) && <button className="gs-btn gs-btn--sm gs-btn--primary" onClick={() => run(() => api(`/splits/${reservation.id}/pay`, { method: 'POST', token: actor.token, body: { memberId: share.memberId } }))}>Pagar</button>}</div>))}
      {!plan.shares.some((share) => share.status === 'paid') && ['lider', 'tesorero'].includes(actor.role) && <button className="gs-btn gs-btn--sm gs-btn--danger" onClick={() => run(() => api(`/splits/${reservation.id}`, { method: 'DELETE', token: actor.token }).then(() => null))}>Cancelar división</button>}
    </div>
  );
}

function SessionCard({ reservation, actor, reload }) {
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const manager = ['lider', 'tesorero'].includes(actor.role);
  const [badge, label] = STATUS[reservation.paymentStatus] || ['', reservation.paymentStatus];
  const nextType = reservation.paymentStatus === 'deposit_pending' ? (reservation.payPlan === 'full' ? 'full' : 'deposit') : 'balance';
  const amount = nextType === 'full' ? reservation.totalPrice : nextType === 'deposit' ? reservation.depositAmount : reservation.balanceAmount;
  const payable = ['deposit_pending', 'deposit_paid'].includes(reservation.paymentStatus) && amount > 0;

  const checkout = async () => { setBusy(true); try { const data = await api('/payments/checkout', { method: 'POST', token: actor.token, body: { reservationId: reservation.id, paymentType: nextType } }); window.location.assign(data.checkoutUrl); } catch (error) { toast(error.message, 'err'); setBusy(false); } };
  const wallet = async () => { setBusy(true); try { await api('/wallet/pay-reservation', { method: 'POST', token: actor.token, body: { reservationId: reservation.id, paymentType: nextType } }); toast('Pagado con tu cartera'); reload(); } catch (error) { toast(error.message, 'err'); } finally { setBusy(false); } };
  const attend = async (status) => { try { await api(`/band/reservations/${reservation.id}/attendance`, { method: 'POST', token: actor.token, body: { status } }); reload(); } catch (error) { toast(error.message, 'err'); } };

  return (
    <div className="gs-card">
      <div className="gs-row" style={{ justifyContent: 'space-between' }}>
        <div><b style={{ color: 'var(--color-text-title)', fontSize: 17 }}>{reservation.roomName}</b><div className="gs-hint">{formatDate(reservation.date)} · {reservation.startTime} · {reservation.duration} h</div></div>
        <span className={`gs-badge ${badge}`}>{label}</span>
      </div>
      <div className="gs-row" style={{ margin: '12px 0' }}>
        <span className="gs-hint">¿Asistes?</span>
        {ATTEND.map(([id, text]) => <button key={id} className={`gs-btn gs-btn--sm ${reservation.myStatus === id ? 'gs-btn--primary' : ''}`} onClick={() => attend(id)}>{text}</button>)}
        <span className="gs-hint">{reservation.attendance.filter((item) => item.status === 'going').length} confirmados</span>
      </div>
      <div className="gs-row">
        {manager && payable && <button className="gs-btn gs-btn--sm gs-btn--primary" disabled={busy} onClick={checkout}>Pagar {mxn(amount)}</button>}
        {manager && payable && <button className="gs-btn gs-btn--sm" disabled={busy} onClick={wallet}><IcWallet /> Con cartera</button>}
        {reservation.ticketCode && <button className="gs-btn gs-btn--sm" onClick={() => setModal('ticket')}><IcTicket /> Boleto</button>}
        {['sala_estudio_a', 'sala_orquesta_e'].includes(reservation.roomId) && reservation.ticketCode && actor.role === 'lider' && <a className="gs-btn gs-btn--sm" href={`/?payment=view&reservation_id=${reservation.id}`}><IcCube /> Sala 3D</a>}
        {payable && <button className="gs-btn gs-btn--sm" onClick={() => setModal('split')}>Dividir pago</button>}
        <button className="gs-btn gs-btn--sm" onClick={() => setModal('chat')}>Chat</button>
      </div>
      {reservation.balanceDueAt && reservation.paymentStatus === 'deposit_paid' && <p className="gs-hint" style={{ marginTop: 10 }}>Saldo {mxn(reservation.balanceAmount)} antes de {new Date(reservation.balanceDueAt).toLocaleString('es-MX')}</p>}
      {modal === 'ticket' && <Modal title="Boleto de acceso" wide onClose={() => setModal(null)}><TicketCard reservation={{ ticketCode: reservation.ticketCode, roomName: reservation.roomName, date: reservation.date, startTime: reservation.startTime, duration: reservation.duration, attendees: reservation.attendees, paymentStatus: reservation.paymentStatus, checkedInAt: reservation.checkedInAt }} bandName={actor.name} /></Modal>}
      {modal === 'split' && <Modal title="Dividir el pago" onClose={() => setModal(null)}><SplitPanel reservation={reservation} actor={actor} onChange={reload} /></Modal>}
      {modal === 'chat' && <Modal title={`Chat · ${reservation.roomName}`} onClose={() => setModal(null)}><ChatBox reservationId={reservation.id} token={actor.token} selfType={actor.raw?.memberId ? 'member' : 'band'} /></Modal>}
    </div>
  );
}

/** Calendario compartido de sesiones: asistencia, pagos (contado/anticipo/saldo/cartera), división de pagos, boleto y chat. */
export default function Sessions({ actor }) {
  const calendar = useAsync(() => api('/band/calendar', { token: actor.token }), [actor.token]);
  if (calendar.loading) return <Skeleton rows={3} />;
  if (calendar.error) return <ErrorNote error={calendar.error} />;
  if (calendar.data.length === 0) return <Empty>Aún no hay sesiones. Reserva una sala desde el catálogo.</Empty>;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = calendar.data.filter((item) => item.date >= today);
  const past = calendar.data.filter((item) => item.date < today).reverse();
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="gs-grid gs-grid--2">{upcoming.map((item) => <SessionCard key={item.id} reservation={item} actor={actor} reload={calendar.reload} />)}</div>
      {upcoming.length === 0 && <Empty>No tienes sesiones próximas.</Empty>}
      {past.length > 0 && <><h2 className="gs-h2">Anteriores</h2><div className="gs-grid gs-grid--2">{past.map((item) => <SessionCard key={item.id} reservation={item} actor={actor} reload={calendar.reload} />)}</div></>}
    </div>
  );
}
