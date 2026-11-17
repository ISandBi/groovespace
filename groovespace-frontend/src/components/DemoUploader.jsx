import { useState } from 'react';
import { IcUpload, IcAudioFile, IcVideo } from '../ui/icons.jsx';
import { api, formatBytes } from '../lib/http';
import { ErrorNote, toast } from '../ui/kit.jsx';
import { API_URL } from '../api';

const KIND_TEXT = { audio: 'pista de audio (recomendado WAV o FLAC, sin pérdida)', video: 'grabación en video de una presentación en vivo (MP4, MOV o WebM)' };

/** Subida de demo para el ingeniero elegido. El tipo aceptado depende del ingeniero (audio, video o ambos). */
export default function DemoUploader({ token, engineer, onUploaded }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [holder, setHolder] = useState('');
  const [rights, setRights] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  if (!engineer) return null;

  const accept = engineer.demoKinds.map((kind) => (kind === 'audio' ? 'audio/*' : 'video/*')).join(',');
  const submit = (event) => {
    event.preventDefault();
    setError('');
    const form = new FormData();
    form.append('engineerId', engineer.id); form.append('title', title); form.append('rightsHolder', holder); form.append('rightsAccepted', String(rights)); form.append('file', file);
    // XMLHttpRequest para mostrar el avance de archivos grandes.
    const request = new XMLHttpRequest();
    request.open('POST', `${API_URL}/demos`);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.upload.onprogress = (progressEvent) => { if (progressEvent.lengthComputable) setProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100)); };
    request.onload = () => {
      setProgress(null);
      let data = {};
      try { data = JSON.parse(request.responseText); } catch { /* respuesta vacía */ }
      if (request.status >= 200 && request.status < 300) { toast('Demo enviado. El ingeniero lo escuchará sin descargarlo.'); setFile(null); setTitle(''); setRights(false); onUploaded?.(data.demo); }
      else setError(data.error || 'No se pudo subir el demo.');
    };
    request.onerror = () => { setProgress(null); setError('No hubo conexión con el servidor.'); };
    setProgress(0);
    request.send(form);
  };

  return (
    <form className="gs-card" onSubmit={submit}>
      <h3 className="gs-h2" style={{ fontSize: 17 }}>{engineer.demoKinds.includes('video') && !engineer.demoKinds.includes('audio') ? <IcVideo /> : <IcAudioFile />} Demo para {engineer.name}</h3>
      <p className="gs-hint">{engineer.name} evalúa: {engineer.demoKinds.map((kind) => KIND_TEXT[kind]).join(' o ')}. Se guarda tal cual lo subes (sin recompresión) y el ingeniero lo escucha dentro de GrooveSpace, sin descargarlo, tras firmar un acuerdo de uso.</p>
      <label className="gs-drop" style={{ display: 'block', margin: '12px 0' }}>
        <IcUpload size={22} /><br />{file ? `${file.name} · ${formatBytes(file.size)}` : 'Elegir archivo'}
        <input type="file" accept={accept} hidden onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </label>
      <label className="gs-field"><span>Título</span><input required value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} /></label>
      <label className="gs-field"><span>Titular de los derechos</span><input required value={holder} onChange={(event) => setHolder(event.target.value)} maxLength={120} placeholder="Nombre de la banda o del autor" /></label>
      <label className="gs-choice" style={{ marginBottom: 12 }}>
        <input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} />
        <div><b>Declaro que soy titular de los derechos o tengo autorización</b><small>Respetamos los derechos de autor: sólo se comparte material propio o autorizado. GrooveSpace y el ingeniero firman un acuerdo de uso y confidencialidad.</small></div>
      </label>
      {progress !== null && <div style={{ height: 8, borderRadius: 0, background: 'rgba(255,255,255,.08)', overflow: 'hidden', marginBottom: 10 }}><div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-brand-primary)', transition: 'width .2s' }} /></div>}
      <ErrorNote error={error} />
      <button className="gs-btn gs-btn--primary" disabled={!file || !rights || progress !== null}>{progress !== null ? `Subiendo ${progress}%` : 'Enviar demo'}</button>
    </form>
  );
}

export const demoStatusBadge = (demo) => {
  const status = demo.review?.status;
  if (status === 'accepted') return ['gs-badge--ok', 'Aceptado'];
  if (status === 'needs_changes') return ['gs-badge--warn', 'Pide ajustes'];
  if (status === 'declined') return ['gs-badge--err', 'No disponible'];
  if (status === 'listened') return ['gs-badge--violet', 'Escuchado'];
  if (demo.agreement?.engineerSignedAt) return ['gs-badge--violet', 'Acuerdo firmado'];
  return ['', 'Esperando al ingeniero'];
};
