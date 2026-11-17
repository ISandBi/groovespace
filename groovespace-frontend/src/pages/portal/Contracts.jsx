import { useState } from 'react';
import { IcCheckCircle } from '../../ui/icons.jsx';
import { api, formatDateTime } from '../../lib/http';
import { Empty, ErrorNote, Field, Modal, Skeleton, toast, useAsync } from '../../ui/kit.jsx';
import { loadCatalog } from '../../lib/quote';

const KIND = { rental_terms: 'Términos de renta', co_production: 'Coproducción' };

export function CreateContract({ actor, onDone, onClose }) {
  const team = useAsync(() => api('/band/team', { token: actor.token }), [actor.token]);
  const catalog = useAsync(loadCatalog, []);
  const [form, setForm] = useState({ title: '', body: '' });
  const [parts, setParts] = useState({});
  const [error, setError] = useState('');
  const options = [...(team.data ? [[`leader`, `${team.data.leader.name} (líder)`], ...team.data.members.map((member) => [`m:${member.id}`, member.name])] : []), ...(catalog.data?.engineers || []).map((engineer) => [`e:${engineer.id}`, `${engineer.name} (ingeniero)`])];
  const total = Object.values(parts).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const submit = async () => {
    setError('');
    try { await api('/contracts/co-production', { method: 'POST', token: actor.token, body: { ...form, splits: Object.entries(parts).filter(([, value]) => Number(value) > 0).map(([key, value]) => ({ key, percent: Number(value) })) } }); toast('Contrato creado: cada parte debe firmarlo'); onDone(); }
    catch (requestError) { setError(requestError.message); }
  };
  return (
    <Modal title="Contrato de coproducción" wide onClose={onClose}>
      <Field label="Título"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Coproducción del EP “Noches de ensayo”" /></Field>
      <Field label="Cláusulas" hint="Objeto, obra, aportaciones, derechos y vigencia (mínimo 40 caracteres)."><textarea style={{ minHeight: 140 }} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></Field>
      <div className="gs-field"><span>Reparto de regalías (debe sumar 100%) · Llevas {total}%</span>
        {options.map(([key, label]) => <div key={key} className="gs-row" style={{ justifyContent: 'space-between' }}><span>{label}</span><input className="gs-input" style={{ width: 90 }} type="number" min="0" max="100" value={parts[key] ?? ''} onChange={(e) => setParts({ ...parts, [key]: e.target.value })} placeholder="%" /></div>)}
      </div>
      <p className="gs-hint">Firma electrónica simple con nombre escrito y sello SHA-256. La integración con una constancia NOM-151 queda preparada para el siguiente alcance.</p>
      <ErrorNote error={error} />
      <button className="gs-btn gs-btn--primary" onClick={submit} disabled={total !== 100}>Crear y pedir firmas</button>
    </Modal>
  );
}

export default function Contracts({ actor }) {
  const list = useAsync(() => api('/contracts', { token: actor.token }), [actor.token]);
  const [creating, setCreating] = useState(false);
  const [signing, setSigning] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const myKey = actor.raw?.memberId ? `m:${actor.raw.memberId}` : 'leader';
  const sign = async () => { setError(''); try { await api(`/contracts/${signing._id}/sign`, { method: 'POST', token: actor.token, body: { typedName: name } }); toast('Firmado'); setSigning(null); setName(''); list.reload(); } catch (requestError) { setError(requestError.message); } };
  return (
    <div>
      <div className="gs-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}><p className="gs-hint" style={{ margin: 0 }}>Términos aceptados y contratos de coproducción con reparto firmado por cada integrante.</p>{['lider', 'tesorero'].includes(actor.role) && <button className="gs-btn gs-btn--primary gs-btn--sm" onClick={() => setCreating(true)}>Nuevo contrato de coproducción</button>}</div>
      {list.loading ? <Skeleton rows={2} /> : list.error ? <ErrorNote error={list.error} /> : list.data.length === 0 ? <Empty>No hay contratos todavía.</Empty> : (
        <div className="gs-grid gs-grid--2">{list.data.map((contract) => {
          const mySignature = contract.signatures.some((item) => item.key === myKey);
          return (
            <div className="gs-card" key={contract._id}>
              <div className="gs-row" style={{ justifyContent: 'space-between' }}><span className="gs-badge gs-badge--violet">{KIND[contract.kind]}</span><span className={`gs-badge ${contract.status === 'fully_signed' ? 'gs-badge--ok' : 'gs-badge--warn'}`}>{contract.status === 'fully_signed' ? 'Firmado por todos' : `Firmas ${contract.signatures.length}/${contract.parties.length}`}</span></div>
              <h3 style={{ color: 'var(--color-text-title)', margin: '12px 0 6px' }}>{contract.title}</h3>
              {contract.splits.length > 0 && <div className="gs-list" style={{ marginBottom: 10 }}>{contract.splits.map((split) => <div className="gs-item" key={split.key}><span>{split.label}</span><b>{split.percent}%</b></div>)}</div>}
              <div className="gs-list">{contract.parties.map((party) => { const signature = contract.signatures.find((item) => item.key === party.key); return <div key={party.key} className="gs-hint">{signature ? <><IcCheckCircle color="var(--color-brand-primary)" /> {party.name} · {formatDateTime(signature.signedAt)}</> : `⏳ Falta ${party.name}`}</div>; })}</div>
              <p className="gs-hint" style={{ fontFamily: 'ui-monospace,monospace', wordBreak: 'break-all' }}>Huella {contract.bodyHash.slice(0, 20)}… · NOM-151: {contract.provider.nom151.status === 'not_connected' ? 'sin conectar' : contract.provider.nom151.status}</p>
              {!mySignature && contract.status === 'pending_signatures' && contract.parties.some((party) => party.key === myKey) && <button className="gs-btn gs-btn--sm gs-btn--primary" onClick={() => setSigning(contract)}>Revisar y firmar</button>}
            </div>);
        })}</div>)}
      {creating && <CreateContract actor={actor} onClose={() => setCreating(false)} onDone={() => { setCreating(false); list.reload(); }} />}
      {signing && <Modal title={signing.title} onClose={() => setSigning(null)}><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--color-text-body)', fontSize: 13, lineHeight: 1.6 }}>{signing.body}</pre><Field label="Firma: escribe tu nombre completo"><input value={name} onChange={(e) => setName(e.target.value)} /></Field><ErrorNote error={error} /><button className="gs-btn gs-btn--primary" onClick={sign} disabled={!name.trim()}>Firmar</button></Modal>}
    </div>
  );
}
