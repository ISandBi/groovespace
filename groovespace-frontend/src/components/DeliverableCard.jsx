import { useRef, useState } from 'react';
import { IcCheck, IcDownload } from '../ui/icons.jsx';
import { api, absoluteApi, formatBytes, formatClock, formatDateTime } from '../lib/http';
import { ErrorNote, toast } from '../ui/kit.jsx';
import SecurePlayer from './SecurePlayer.jsx';

export const STAGES = [['recorded', 'Grabado'], ['editing', 'Edición'], ['mixing', 'Mezcla'], ['mastering', 'Master'], ['delivered', 'Entregado']];

/** Entregable de grabación: flujo de etapas, versiones, comentarios por minuto y aprobación (banda) / gestión (ingeniero). */
export default function DeliverableCard({ deliverable, token, role, canApprove, reload }) {
  const [versionN, setVersionN] = useState(deliverable.versions.at(-1)?.n || null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [upload, setUpload] = useState({ label: '', notes: '', file: null, busy: false });
  const player = useRef(null);
  const version = deliverable.versions.find((item) => item.n === versionN);
  const stageIndex = STAGES.findIndex(([id]) => id === deliverable.stage);
  const comments = deliverable.comments.filter((item) => item.versionN === versionN).sort((a, b) => a.atSec - b.atSec);
  const base = `/deliverables/${deliverable._id}`;

  const run = async (action, success) => { setError(''); try { await action(); if (success) toast(success); reload(); } catch (requestError) { setError(requestError.message); } };
  const addComment = () => run(async () => { await api(`${base}/comments`, { method: 'POST', token, body: { versionN, atSec: Math.floor(player.current?.now() || 0), text } }); setText(''); }, 'Comentario agregado');
  const approve = () => run(() => api(`${base}/versions/${versionN}/approve`, { method: 'POST', token }), 'Versión aprobada');
  const stage = (value) => run(() => api(`${base}/stage`, { method: 'PATCH', token, body: { stage: value } }));
  const download = () => run(async () => { const data = await api(`${base}/versions/${versionN}/stream-token`, { method: 'POST', token, body: { download: true } }); window.location.assign(absoluteApi(data.url)); });
  const sendVersion = () => {
    const form = new FormData();
    form.append('file', upload.file); form.append('label', upload.label); form.append('notes', upload.notes);
    setUpload((current) => ({ ...current, busy: true }));
    run(() => api(`${base}/versions`, { method: 'POST', token, form }), 'Versión subida').finally(() => setUpload({ label: '', notes: '', file: null, busy: false }));
  };

  return (
    <div className="gs-card">
      <div className="gs-row" style={{ justifyContent: 'space-between' }}><h3 className="gs-h2" style={{ margin: 0 }}>{deliverable.title}</h3><span className="gs-badge gs-badge--violet">{STAGES[stageIndex]?.[1]}</span></div>
      <div className="gs-steps" style={{ margin: '14px 0' }}>
        {STAGES.map(([id, label], index) => (role === 'engineer'
          ? <button key={id} className={`gs-btn gs-btn--sm ${index === stageIndex ? 'gs-btn--primary' : ''}`} onClick={() => stage(id)}>{label}</button>
          : <span key={id} className={index === stageIndex ? 'on' : index < stageIndex ? 'done' : ''}>{index < stageIndex ? '✓ ' : ''}{label}</span>))}
      </div>
      {deliverable.versions.length === 0 ? <p className="gs-hint">Aún no hay versiones{role === 'band' ? '. Te avisaremos cuando tu ingeniero suba la primera.' : '. Sube la primera abajo.'}</p> : (
        <>
          <div className="gs-row" style={{ marginBottom: 10 }}>{deliverable.versions.map((item) => <button key={item.n} className={`gs-btn gs-btn--sm ${item.n === versionN ? 'gs-btn--primary' : ''}`} onClick={() => setVersionN(item.n)}>v{item.n}{item.approvedAt ? ' ✓' : ''}</button>)}</div>
          {version && (
            <>
              <p className="gs-hint">{version.label} · {formatBytes(version.size)} · {version.lossless ? 'Sin pérdida' : 'Comprimido'} · {formatDateTime(version.uploadedAt)}{version.notes ? ` · ${version.notes}` : ''}</p>
              <SecurePlayer key={`${deliverable._id}-${version.n}`} kind={version.kind === 'video' ? 'video' : 'audio'} label={`${deliverable.title} · ${version.label}`} apiRef={player} loadUrl={async () => absoluteApi((await api(`${base}/versions/${version.n}/stream-token`, { method: 'POST', token, body: {} })).url)} />
              <div className="gs-row" style={{ margin: '10px 0' }}>
                {role === 'band' && canApprove && !version.approvedAt && <button className="gs-btn gs-btn--sm gs-btn--primary" onClick={approve}><IcCheck /> Aprobar esta versión</button>}
                {version.approvedAt && <span className="gs-badge gs-badge--ok">Aprobada {formatDateTime(version.approvedAt)}</span>}
                {version.approvedAt && <button className="gs-btn gs-btn--sm" onClick={download}><IcDownload /> Descargar master</button>}
                {!version.approvedAt && <span className="gs-hint">La descarga se habilita al aprobar.</span>}
              </div>
              <h4 style={{ color: 'var(--color-text-title)', margin: '14px 0 8px' }}>Comentarios por minuto</h4>
              <div className="gs-list">{comments.map((comment, index) => <div className="gs-item" key={index}><div><button className="gs-btn gs-btn--sm" onClick={() => player.current?.seek(comment.atSec)}>{formatClock(comment.atSec)}</button> <b style={{ marginLeft: 8 }}>{comment.authorName}</b><div className="gs-hint">{comment.text}</div></div></div>)}{comments.length === 0 && <span className="gs-hint">Pausa el audio en el momento exacto y escribe tu comentario.</span>}</div>
              <div className="gs-row" style={{ marginTop: 10, flexWrap: 'nowrap' }}><input className="gs-input" value={text} onChange={(event) => setText(event.target.value)} maxLength={500} placeholder="Comentario en el minuto actual…" /><button className="gs-btn gs-btn--sm" disabled={!text.trim()} onClick={addComment}>Comentar</button></div>
            </>
          )}
        </>
      )}
      {role === 'engineer' && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--gs-line)', paddingTop: 14 }}>
          <b style={{ color: 'var(--color-text-title)' }}>Subir nueva versión</b>
          <div className="gs-grid gs-grid--2" style={{ gap: 10, marginTop: 8 }}>
            <input className="gs-input" placeholder="Nombre (ej. Mezcla v2)" value={upload.label} onChange={(event) => setUpload({ ...upload, label: event.target.value })} />
            <input className="gs-input" placeholder="Notas" value={upload.notes} onChange={(event) => setUpload({ ...upload, notes: event.target.value })} />
          </div>
          <div className="gs-row" style={{ marginTop: 10 }}><input type="file" accept="audio/*,video/*" onChange={(event) => setUpload({ ...upload, file: event.target.files?.[0] || null })} /><button className="gs-btn gs-btn--sm gs-btn--primary" disabled={!upload.file || upload.busy} onClick={sendVersion}>{upload.busy ? 'Subiendo…' : 'Subir'}</button></div>
          <p className="gs-hint">WAV o FLAC se guardan sin pérdida; el archivo se conserva tal cual lo subes.</p>
        </div>
      )}
      <ErrorNote error={error} />
    </div>
  );
}
