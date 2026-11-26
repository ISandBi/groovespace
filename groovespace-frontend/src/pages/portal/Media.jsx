import { useState } from 'react';
import { IcDownload, IcTrash } from '../../ui/icons.jsx';
import { API_URL, api, absoluteApi, formatBytes, formatDateTime } from '../../lib/http';
import { Empty, ErrorNote, Skeleton, toast, useAsync } from '../../ui/kit.jsx';
import DemoUploader, { demoStatusBadge } from '../../components/DemoUploader.jsx';
import DeliverableCard from '../../components/DeliverableCard.jsx';
import SecurePlayer from '../../components/SecurePlayer.jsx';
import { loadCatalog } from '../../lib/quote';

export function Files({ actor }) {
  const files = useAsync(() => api('/band/files', { token: actor.token }), [actor.token]);
  const [visibility, setVisibility] = useState('band');
  const [busy, setBusy] = useState(false);
  const manager = ['lider', 'tesorero'].includes(actor.role);
  const upload = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    const form = new FormData(); form.append('file', file); form.append('visibility', visibility);
    setBusy(true);
    try { await api('/band/files', { method: 'POST', token: actor.token, form }); files.reload(); toast('Archivo guardado'); } catch (error) { toast(error.message, 'err'); } finally { setBusy(false); event.target.value = ''; }
  };
  const download = async (file) => {
    try {
      const response = await fetch(`${API_URL}/band-files/${file.id}`, { headers: { Authorization: `Bearer ${actor.token}` } });
      if (!response.ok) throw new Error('No se pudo descargar el archivo.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast(error.message, 'err'); }
  };
  const remove = async (file) => { try { await api(`/band/files/${file.id}`, { method: 'DELETE', token: actor.token }); files.reload(); } catch (error) { toast(error.message, 'err'); } };
  return (
    <div className="gs-card">
      <div className="gs-row" style={{ justifyContent: 'space-between' }}><h2 className="gs-h2" style={{ margin: 0 }}>Archivos de la banda</h2>
        {manager && <div className="gs-row"><select className="gs-input" style={{ width: 'auto', minHeight: 36 }} value={visibility} onChange={(e) => setVisibility(e.target.value)} aria-label="Visibilidad"><option value="band">Sólo la banda</option><option value="engineer">Banda e ingeniero</option></select><label className="gs-btn gs-btn--sm gs-btn--primary" style={{ cursor: 'pointer' }}>{busy ? 'Subiendo…' : 'Subir archivo'}<input hidden type="file" onChange={upload} disabled={busy} /></label></div>}
      </div>
      <p className="gs-hint">PDF, imágenes, audio y video: partituras, letras, riders, referencias. Se guardan en almacenamiento privado (S3 en producción).</p>
      {files.loading ? <Skeleton rows={2} /> : files.error ? <ErrorNote error={files.error} /> : files.data.length === 0 ? <Empty>Aún no hay archivos.</Empty> : <div className="gs-list">{files.data.map((file) => <div className="gs-item" key={file.id}><div><b style={{ color: 'var(--color-text-title)' }}>{file.name}</b><div className="gs-hint">{formatBytes(file.size)} · {file.visibility === 'engineer' ? 'Visible al ingeniero' : 'Sólo la banda'} · {formatDateTime(file.createdAt)}</div></div><div className="gs-row"><button className="gs-btn gs-btn--sm" onClick={() => download(file)}><IcDownload /></button>{manager && <button className="gs-btn gs-btn--sm gs-btn--danger" aria-label="Eliminar" onClick={() => remove(file)}><IcTrash /></button>}</div></div>)}</div>}
    </div>
  );
}

/** Publica el demo en la app móvil GrooveSpace Music y guarda su letra. */
function AppPublish({ demo, token, manager, onSaved }) {
  const [lyrics, setLyrics] = useState(demo.lyrics || '');
  const [busy, setBusy] = useState(false);
  const save = async (published) => {
    setBusy(true);
    try {
      await api(`/demos/${demo._id}/publish`, { method: 'PATCH', token, body: { published, lyrics } });
      toast(published ? 'Publicado en la app móvil.' : published === false ? 'Retirado de la app móvil.' : 'Letra guardada.');
      onSaved();
    } catch (error) { toast(error.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
      <div className="gs-row" style={{ justifyContent: 'space-between' }}>
        <span className={`gs-badge ${demo.published ? 'gs-badge--ok' : ''}`}>{demo.published ? 'Visible en la app móvil' : 'No publicado en la app'}</span>
        {manager && <button className="gs-btn gs-btn--sm" disabled={busy} onClick={() => save(!demo.published)}>{demo.published ? 'Retirar de la app' : 'Publicar en la app'}</button>}
      </div>
      {manager && <label className="gs-field"><span>Letra (se muestra sincronizada en la app)</span><textarea rows={5} maxLength={8000} value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="Escribe la letra, una línea por renglón." /></label>}
      {manager && lyrics !== (demo.lyrics || '') && <button className="gs-btn gs-btn--sm" style={{ justifySelf: 'start' }} disabled={busy} onClick={() => save(undefined)}>Guardar letra</button>}
    </div>
  );
}

export function Demos({ actor }) {
  const catalog = useAsync(loadCatalog, []);
  const demos = useAsync(() => api('/demos/mine', { token: actor.token }), [actor.token]);
  const [engineerId, setEngineerId] = useState('');
  const engineer = catalog.data?.engineers.find((item) => item.id === engineerId);
  const manager = ['lider', 'tesorero'].includes(actor.role);
  const remove = async (demo) => { try { await api(`/demos/${demo._id}`, { method: 'DELETE', token: actor.token }); demos.reload(); } catch (error) { toast(error.message, 'err'); } };
  return (
    <div className="gs-grid gs-grid--2" style={{ alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 14 }}>
        {manager && <div className="gs-card"><h2 className="gs-h2">Enviar demo a un ingeniero</h2>
          <label className="gs-field"><span>Ingeniero</span><select value={engineerId} onChange={(e) => setEngineerId(e.target.value)}><option value="">Selecciona…</option>{catalog.data?.engineers.map((item) => <option key={item.id} value={item.id}>{item.name} — demo de {item.demoKinds.map((kind) => (kind === 'video' ? 'video en vivo' : 'audio')).join(' / ')}</option>)}</select></label>
        </div>}
        {engineer && <DemoUploader token={actor.token} engineer={engineer} onUploaded={demos.reload} />}
      </div>
      <div className="gs-card"><h2 className="gs-h2">Mis demos</h2>
        {demos.loading ? <Skeleton rows={2} /> : demos.error ? <ErrorNote error={demos.error} /> : demos.data.length === 0 ? <Empty>Todavía no has enviado demos.</Empty> : <div className="gs-list">{demos.data.map((demo) => {
          const [tone, label] = demoStatusBadge(demo);
          return (
            <div key={demo._id} className="gs-item" style={{ display: 'grid' }}>
              <div className="gs-row" style={{ justifyContent: 'space-between' }}><div><b style={{ color: 'var(--color-text-title)' }}>{demo.title}</b><div className="gs-hint">{demo.kind === 'video' ? 'Video' : 'Audio'} · {formatBytes(demo.size)} · {demo.lossless ? 'Sin pérdida' : 'Comprimido'} · SHA-256 {demo.sha256?.slice(0, 10)}…</div></div><span className={`gs-badge ${tone}`}>{label}</span></div>
              {demo.review?.feedback && <p className="gs-hint">Comentarios del ingeniero: {demo.review.feedback}</p>}
              {demo.agreement?.engineerSignedAt && <p className="gs-hint">Acuerdo firmado por {demo.agreement.engineerName} y {demo.agreement.grooveSpaceSignatory} · escuchado {demo.listens?.length || 0} veces</p>}
              <SecurePlayer kind={demo.kind} label="Escuchar mi demo" loadUrl={async () => absoluteApi((await api(`/demos/${demo._id}/stream-token`, { method: 'POST', token: actor.token })).url)} />
              <AppPublish demo={demo} token={actor.token} manager={manager} onSaved={demos.reload} />
              {manager && <button className="gs-btn gs-btn--sm gs-btn--danger" style={{ justifySelf: 'start', marginTop: 8 }} onClick={() => remove(demo)}>Eliminar</button>}
            </div>);
        })}</div>}
      </div>
    </div>
  );
}

export function Deliverables({ actor }) {
  const calendar = useAsync(() => api('/band/calendar', { token: actor.token }), [actor.token]);
  const list = useAsync(async () => {
    const sessions = (calendar.data || []).filter((item) => item.engineerId && ['deposit_paid', 'paid'].includes(item.paymentStatus)).slice(-12);
    const groups = await Promise.all(sessions.map((session) => api(`/deliverables/reservation/${session.id}`, { token: actor.token }).then((items) => items.map((item) => ({ item, session }))).catch(() => [])));
    return groups.flat();
  }, [calendar.data, actor.token]);
  if (calendar.loading || list.loading) return <Skeleton rows={2} />;
  if (list.data?.length === 0) return <Empty>Cuando tu ingeniero comience a trabajar en tu grabación, verás aquí cada versión, podrás comentar por minuto y aprobar el master.</Empty>;
  return <div className="gs-grid gs-grid--2" style={{ alignItems: 'start' }}>{list.data.map(({ item }) => <DeliverableCard key={item._id} deliverable={item} token={actor.token} role="band" canApprove={['lider', 'tesorero'].includes(actor.role)} reload={list.reload} />)}</div>;
}
