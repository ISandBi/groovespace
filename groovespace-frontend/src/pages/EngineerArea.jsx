import { useState } from 'react';
import { FaHeadphones } from 'react-icons/fa';
import { API_URL, api, absoluteApi, assetUrl, formatBytes, formatDate, formatDateTime } from '../lib/http';
import { clearSession, saveSession, useSessions } from '../lib/session';
import { Empty, ErrorNote, Field, Modal, Skeleton, Tabs, toast, useAsync } from '../ui/kit.jsx';
import SecurePlayer from '../components/SecurePlayer.jsx';
import ChatBox from '../components/ChatBox.jsx';
import DeliverableCard from '../components/DeliverableCard.jsx';
import { demoStatusBadge } from '../components/DemoUploader.jsx';

function Login() {
  const engineers = useAsync(() => api('/bands/engineers'), []);
  const [form, setForm] = useState({ engineerId: '', username: '', password: '' });
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setError('');
    try { const data = await api('/engineers/login', { method: 'POST', body: form }); saveSession('engineer', data); } catch (requestError) { setError(requestError.message); }
  };
  return (
    <div className="gs-page" style={{ maxWidth: 440 }}>
      <form className="gs-card" onSubmit={submit}><FaHeadphones size={24} color="var(--color-brand-primary)" /><h1 className="gs-h1" style={{ fontSize: 28, margin: '10px 0 16px' }}>Acceso de ingeniería</h1>
        <Field label="Perfil"><select value={form.engineerId} onChange={(e) => setForm({ ...form, engineerId: e.target.value })} required><option value="">Selecciona…</option>{(engineers.data || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Usuario"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="username" required /></Field>
        <Field label="Contraseña"><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" required /></Field>
        <ErrorNote error={error} /><button className="gs-btn gs-btn--primary gs-btn--block">Entrar</button></form>
    </div>
  );
}

function Agenda({ session }) {
  const schedule = useAsync(() => api('/engineers/me/schedule', { token: session.token }), [session.token]);
  const [chat, setChat] = useState(null);
  const [pack, setPack] = useState(null);
  const [deliver, setDeliver] = useState(null);
  const openPack = async (item) => { try { setPack({ band: item.bandId.name, data: await api(`/stage-pack/${item.bandId._id || item.bandId}`, { token: session.token }) }); } catch (error) { toast(error.message, 'err'); } };
  if (schedule.loading) return <Skeleton rows={3} />;
  if (schedule.error) return <ErrorNote error={schedule.error} />;
  if (!schedule.data.length) return <Empty>No tienes sesiones próximas.</Empty>;
  return (
    <>
      <div className="gs-list">{schedule.data.map((item) => (
        <div className="gs-item" key={item._id}>
          <div><b style={{ color: 'var(--color-text-title)' }}>{item.bandId?.name || 'Banda'}</b><div className="gs-hint">{formatDate(item.date)} · {item.startTime} · {item.duration} h · {item.roomName} · {item.attendees} integrantes</div></div>
          <div className="gs-row"><span className={`gs-badge ${item.checkedInAt ? 'gs-badge--violet' : item.paymentStatus === 'deposit_pending' ? 'gs-badge--warn' : 'gs-badge--ok'}`}>{item.checkedInAt ? 'Ya ingresó' : item.paymentStatus === 'deposit_pending' ? 'Anticipo pendiente' : 'Confirmada'}</span>
            <button className="gs-btn gs-btn--sm" onClick={() => openPack(item)}>Setlist y rider</button><button className="gs-btn gs-btn--sm" onClick={() => setChat(item)}>Chat</button>
            {item.paymentStatus !== 'deposit_pending' && <button className="gs-btn gs-btn--sm" onClick={() => setDeliver(item)}>Entregables</button>}</div>
        </div>))}</div>
      {chat && <Modal title={`Chat · ${chat.bandId?.name}`} onClose={() => setChat(null)}><ChatBox reservationId={chat._id} token={session.token} selfType="engineer" /></Modal>}
      {pack && <Modal title={`${pack.band} · escenario`} wide onClose={() => setPack(null)}>
        <h3 className="gs-h2">Setlist ({pack.data.setlist.reduce((sum, song) => sum + song.durationMin, 0)} min)</h3>
        {pack.data.setlist.length ? <ol style={{ color: 'var(--color-text-body)', lineHeight: 1.8 }}>{pack.data.setlist.map((song, index) => <li key={index}>{song.title} · {song.durationMin} min{song.notes ? ` — ${song.notes}` : ''}</li>)}</ol> : <p className="gs-hint">Sin setlist.</p>}
        <h3 className="gs-h2">Rider técnico</h3>
        {['stageNeeds', 'backline', 'monitors', 'notes'].map((key) => pack.data.rider?.[key] ? <p key={key} className="gs-hint"><b>{{ stageNeeds: 'Escenario', backline: 'Backline', monitors: 'Monitores', notes: 'Notas' }[key]}:</b> {pack.data.rider[key]}</p> : null)}
        <h3 className="gs-h2">Integrantes e instrumentos</h3><div className="gs-row">{pack.data.members.map((member, index) => <span className="gs-badge" key={index}>{member.name} · {member.instrument}</span>)}{pack.data.instruments.map((name) => <span key={name} className="gs-badge gs-badge--violet">{name}</span>)}</div>
      </Modal>}
      {deliver && <Modal title={`Entregables · ${deliver.bandId?.name}`} wide onClose={() => setDeliver(null)}><DeliverablesFor session={session} reservation={deliver} /></Modal>}
    </>
  );
}

function DeliverablesFor({ session, reservation }) {
  const list = useAsync(() => api(`/deliverables/reservation/${reservation._id}`, { token: session.token }), [reservation._id]);
  const [title, setTitle] = useState('');
  const create = async () => { try { await api('/deliverables', { method: 'POST', token: session.token, body: { reservationId: reservation._id, title } }); setTitle(''); list.reload(); } catch (error) { toast(error.message, 'err'); } };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="gs-row" style={{ flexWrap: 'nowrap' }}><input className="gs-input" placeholder="Nuevo entregable (ej. Mezcla “Noches de ensayo”)" value={title} onChange={(e) => setTitle(e.target.value)} /><button className="gs-btn gs-btn--primary gs-btn--sm" disabled={!title.trim()} onClick={create}>Crear</button></div>
      {list.loading ? <Skeleton rows={1} /> : list.data.map((item) => <DeliverableCard key={item._id} deliverable={item} token={session.token} role="engineer" reload={list.reload} />)}
    </div>
  );
}

function DemoInbox({ session }) {
  const inbox = useAsync(() => api('/demos/inbox', { token: session.token }), [session.token]);
  const agreement = useAsync(() => api('/demos/agreement'), []);
  const [signing, setSigning] = useState(null);
  const [name, setName] = useState('');
  const [accept, setAccept] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [review, setReview] = useState({ status: 'accepted', feedback: '' });
  const [error, setError] = useState('');
  const sign = async () => { setError(''); try { await api(`/demos/${signing._id}/sign`, { method: 'POST', token: session.token, body: { fullName: name, accept } }); toast('Acuerdo firmado: ya puedes escuchar el demo'); setSigning(null); setName(''); setAccept(false); inbox.reload(); } catch (requestError) { setError(requestError.message); } };
  const sendReview = async () => { try { await api(`/demos/${reviewing._id}/review`, { method: 'POST', token: session.token, body: review }); toast('Evaluación enviada a la banda'); setReviewing(null); inbox.reload(); } catch (requestError) { toast(requestError.message, 'err'); } };
  if (inbox.loading || agreement.loading) return <Skeleton rows={2} />;
  if (inbox.error) return <ErrorNote error={inbox.error} />;
  if (!inbox.data.length) return <Empty>Aún no te envían demos.</Empty>;
  const ag = agreement.data;
  return (
    <>
      <div className="gs-list">{inbox.data.map((demo) => {
        const [tone, label] = demoStatusBadge(demo);
        const signed = Boolean(demo.agreement?.engineerSignedAt);
        return (
          <div className="gs-card" key={demo._id}>
            <div className="gs-row" style={{ justifyContent: 'space-between' }}><div><b style={{ color: 'var(--color-text-title)', fontSize: 17 }}>{demo.title}</b><div className="gs-hint">{demo.bandId?.name} · {demo.kind === 'video' ? 'Video en vivo' : 'Audio'} · {formatBytes(demo.size)} · {demo.lossless ? 'Sin pérdida' : 'Comprimido'} · titular: {demo.rights?.holder}</div></div><span className={`gs-badge ${tone}`}>{label}</span></div>
            {signed ? <div style={{ marginTop: 12 }}>
              <SecurePlayer kind={demo.kind} label="Escuchar sin descargar" loadUrl={async () => absoluteApi((await api(`/demos/${demo._id}/stream-token`, { method: 'POST', token: session.token })).url)} />
              <p className="gs-hint">Acuerdo firmado {formatDateTime(demo.agreement.engineerSignedAt)} · sello {demo.agreement.sealHash.slice(0, 16)}…</p>
              <button className="gs-btn gs-btn--sm gs-btn--primary" onClick={() => { setReviewing(demo); setReview({ status: demo.review?.status && demo.review.status !== 'new' && demo.review.status !== 'listened' ? demo.review.status : 'accepted', feedback: demo.review?.feedback || '' }); }}>Evaluar demo</button>
            </div> : <div style={{ marginTop: 12 }}><p className="gs-hint">Para escucharlo debes firmar el acuerdo de uso y confidencialidad.</p><button className="gs-btn gs-btn--primary gs-btn--sm" onClick={() => setSigning(demo)}>Leer y firmar acuerdo</button></div>}
          </div>);
      })}</div>
      {signing && ag && <Modal title={ag.title} wide onClose={() => setSigning(null)}>
        <ol style={{ color: 'var(--color-text-body)', lineHeight: 1.7, paddingLeft: 20 }}>{ag.clauses.map((clause) => <li key={clause}>{clause}</li>)}</ol>
        <div className="gs-grid gs-grid--2" style={{ margin: '14px 0' }}>
          <div className="gs-item" style={{ display: 'block' }}><span className="gs-hint">Por GrooveSpace</span><div style={{ fontFamily: '"Brush Script MT","Segoe Script",cursive', fontSize: 28, color: 'var(--color-brand-primary)' }}>{ag.grooveSpace.signatory}</div><span className="gs-hint">{ag.grooveSpace.role} · {ag.grooveSpace.company}</span></div>
          <div className="gs-item" style={{ display: 'block' }}><span className="gs-hint">Por el ingeniero</span><div style={{ fontFamily: '"Brush Script MT","Segoe Script",cursive', fontSize: 28, color: name ? 'var(--color-brand-accent)' : 'var(--color-text-muted)' }}>{name || 'Tu firma'}</div></div>
        </div>
        <p className="gs-hint">Firmas electrónicas de demostración (ficticias, sin validez legal). Versión {ag.version} · huella {ag.hash.slice(0, 20)}…</p>
        <Field label="Escribe tu nombre completo para firmar"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <label className={`gs-choice ${accept ? 'on' : ''}`}><input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} /><div><b>Acepto el acuerdo y me comprometo a no descargar, grabar ni redistribuir el demo</b></div></label>
        <ErrorNote error={error} /><button className="gs-btn gs-btn--primary" style={{ marginTop: 12 }} disabled={!accept || !name.trim()} onClick={sign}>Firmar acuerdo</button>
      </Modal>}
      {reviewing && <Modal title={`Evaluar “${reviewing.title}”`} onClose={() => setReviewing(null)}>
        <Field label="Decisión"><select value={review.status} onChange={(e) => setReview({ ...review, status: e.target.value })}><option value="accepted">Acepto trabajar con la banda</option><option value="needs_changes">Pido ajustes</option><option value="declined">No puedo tomar el proyecto</option></select></Field>
        <Field label="Comentarios para la banda"><textarea value={review.feedback} onChange={(e) => setReview({ ...review, feedback: e.target.value })} maxLength={1200} /></Field>
        <button className="gs-btn gs-btn--primary" onClick={sendReview}>Enviar evaluación</button>
      </Modal>}
    </>
  );
}

function Portfolio({ session }) {
  const profile = useAsync(() => api('/marketplace/me/profile', { token: session.token }), [session.token]);
  const [bio, setBio] = useState(null);
  const [sample, setSample] = useState({ title: '', genre: '', file: null });
  const [busy, setBusy] = useState(false);
  if (profile.loading) return <Skeleton rows={2} />;
  const text = bio ?? profile.data?.bio ?? '';
  const saveBio = async () => { try { await api('/marketplace/me/bio', { method: 'PUT', token: session.token, body: { bio: text } }); toast('Biografía guardada'); } catch (error) { toast(error.message, 'err'); } };
  const upload = async () => {
    const form = new FormData(); form.append('file', sample.file); form.append('title', sample.title); form.append('genre', sample.genre); setBusy(true);
    try { await api('/marketplace/me/samples', { method: 'POST', token: session.token, form }); setSample({ title: '', genre: '', file: null }); profile.reload(); toast('Muestra agregada'); } catch (error) { toast(error.message, 'err'); } finally { setBusy(false); }
  };
  const remove = async (id) => { try { await api(`/marketplace/me/samples/${id}`, { method: 'DELETE', token: session.token }); profile.reload(); } catch (error) { toast(error.message, 'err'); } };
  return (
    <div className="gs-grid gs-grid--2" style={{ alignItems: 'start' }}>
      <div className="gs-card"><h2 className="gs-h2">Biografía pública</h2><textarea className="gs-input" style={{ minHeight: 130 }} value={text} onChange={(e) => setBio(e.target.value)} maxLength={1000} /><button className="gs-btn gs-btn--primary gs-btn--sm" style={{ marginTop: 10 }} onClick={saveBio}>Guardar</button></div>
      <div className="gs-card"><h2 className="gs-h2">Portafolio de audio ({profile.data.samples.length}/6)</h2>
        <div className="gs-list">{profile.data.samples.map((item) => <div key={item._id} style={{ display: 'grid', gap: 6 }}><SecurePlayer label={`${item.title}${item.genre ? ` · ${item.genre}` : ''}`} loadUrl={async () => `${API_URL}/marketplace/engineers/${session.engineer.id}/samples/${item._id}/stream`} /><button className="gs-btn gs-btn--sm gs-btn--danger" style={{ justifySelf: 'start' }} onClick={() => remove(item._id)}>Quitar</button></div>)}</div>
        <div className="gs-grid gs-grid--2" style={{ gap: 10, marginTop: 14 }}><input className="gs-input" placeholder="Título" value={sample.title} onChange={(e) => setSample({ ...sample, title: e.target.value })} /><input className="gs-input" placeholder="Género" value={sample.genre} onChange={(e) => setSample({ ...sample, genre: e.target.value })} /></div>
        <div className="gs-row" style={{ marginTop: 10 }}><input type="file" accept="audio/*" onChange={(e) => setSample({ ...sample, file: e.target.files?.[0] || null })} /><button className="gs-btn gs-btn--sm gs-btn--primary" disabled={!sample.file || busy} onClick={upload}>{busy ? 'Subiendo…' : 'Agregar'}</button></div>
        <p className="gs-hint">WAV/FLAC se conservan sin pérdida. Las bandas escuchan sin poder descargar.</p>
      </div>
    </div>
  );
}

function Requests({ session }) {
  const list = useAsync(() => api('/marketplace/me/requests', { token: session.token }), [session.token]);
  const respond = async (id, accept) => { try { await api(`/marketplace/me/requests/${id}/respond`, { method: 'POST', token: session.token, body: { accept, response: '' } }); list.reload(); } catch (error) { toast(error.message, 'err'); } };
  if (list.loading) return <Skeleton rows={2} />;
  if (!list.data.length) return <Empty>No tienes solicitudes de bandas.</Empty>;
  return <div className="gs-list">{list.data.map((item) => <div className="gs-item" key={item._id}><div><b style={{ color: 'var(--color-text-title)' }}>{item.bandId?.name}</b><div className="gs-hint">{formatDate(item.date)} · {item.startTime} · {item.duration} h · {item.roomName}</div>{item.message && <div className="gs-hint">“{item.message}”</div>}</div>{item.status === 'pending' ? <div className="gs-row"><button className="gs-btn gs-btn--sm gs-btn--primary" onClick={() => respond(item._id, true)}>Aceptar</button><button className="gs-btn gs-btn--sm" onClick={() => respond(item._id, false)}>No puedo</button></div> : <span className="gs-badge">{item.status === 'accepted' ? 'Aceptada' : 'Rechazada'}</span>}</div>)}</div>;
}

export default function EngineerArea() {
  const session = useSessions().engineer;
  const [tab, setTab] = useState('agenda');
  if (!session) return <Login />;
  return (
    <div className="gs-page">
      <div className="gs-page-head"><div><p className="gs-eyebrow">Ingeniería · {session.engineer.specialty}</p><h1 className="gs-h1">{session.engineer.name}</h1></div><button className="gs-btn gs-btn--sm" onClick={() => clearSession('engineer')}>Cerrar sesión</button></div>
      <Tabs tabs={[['agenda', 'Agenda'], ['demos', 'Demos recibidos'], ['solicitudes', 'Solicitudes'], ['portafolio', 'Portafolio']]} value={tab} onChange={setTab} />
      {tab === 'agenda' && <Agenda session={session} />}
      {tab === 'demos' && <DemoInbox session={session} />}
      {tab === 'solicitudes' && <Requests session={session} />}
      {tab === 'portafolio' && <Portfolio session={session} />}
    </div>
  );
}
export { assetUrl };
