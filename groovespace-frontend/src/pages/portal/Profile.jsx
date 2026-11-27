import { useEffect, useState } from 'react';
import { api, assetUrl } from '../../lib/http';
import { Link } from '../../lib/router.jsx';
import { ErrorNote, Field, Skeleton, toast, useAsync } from '../../ui/kit.jsx';

export default function Profile({ actor }) {
  const me = useAsync(() => api('/band/me', { token: actor.token }), [actor.token]);
  const profile = useAsync(() => (actor.role === 'lider' ? api(`/bands/${actor.bandId}/profile`, { token: actor.token }) : null), [actor.token]);
  const [epk, setEpk] = useState(null);
  const [songs, setSongs] = useState([]);
  const [rider, setRider] = useState({ stageNeeds: '', backline: '', monitors: '', notes: '' });
  const [newInstrument, setNewInstrument] = useState({ name: '', file: null });
  const [error, setError] = useState('');
  const manager = ['lider', 'tesorero'].includes(actor.role);

  useEffect(() => {
    if (profile.data) setEpk({ bio: profile.data.bio || '', genre: profile.data.genre || '', district: profile.data.district || '', isPublic: Boolean(profile.data.isPublic), pressLinks: profile.data.pressLinks || [], slug: profile.data.slug });
  }, [profile.data]);
  useEffect(() => {
    api('/band/setlist', { token: actor.token }).then((data) => setSongs(data.songs || data || [])).catch(() => {});
    api('/band/rider', { token: actor.token }).then((data) => setRider((current) => ({ ...current, ...(data.rider || data || {}) }))).catch(() => {});
  }, [actor.token]);

  const save = async (path, method, body, ok) => { setError(''); try { return await api(path, { method, token: actor.token, body }); } catch (requestError) { setError(requestError.message); return null; } finally { if (ok) toast(ok); } };
  const saveEpk = async () => { const data = await save('/band/epk', 'PATCH', epk, 'Perfil público guardado'); if (data) setEpk((current) => ({ ...current, slug: data.slug })); };
  const addInstrument = async () => {
    const form = new FormData(); form.append('instruments', JSON.stringify([{ name: newInstrument.name }])); form.append('instrumentPhotos', newInstrument.file);
    try { await api(`/bands/${actor.bandId}/instruments`, { method: 'POST', token: actor.token, form }); toast('Instrumento agregado: ya puedes verlo en 3D en tu sala'); setNewInstrument({ name: '', file: null }); profile.reload(); } catch (requestError) { setError(requestError.message); }
  };

  const changeLogo = async (file) => {
    if (!file) return;
    const form = new FormData(); form.append('logo', file);
    setError('');
    try { await api(`/bands/${actor.bandId}/logo`, { method: 'PATCH', token: actor.token, form }); toast('Logo actualizado'); profile.reload(); } catch (requestError) { setError(requestError.message); }
  };

  if (me.loading || profile.loading) return <Skeleton />;
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <ErrorNote error={error} />
      {actor.role === 'lider' && profile.data && (
        <div className="gs-card"><h2 className="gs-h2">Logo de la banda</h2>
          <p className="gs-hint">Se muestra en tu perfil, en el directorio público y en la app móvil. Formatos: .jpg, .png o .webp (máximo 10 MB).</p>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '12px 0' }}><img src={assetUrl(profile.data.logoPath)} alt="Logo de la banda" width="96" height="96" style={{ objectFit: 'cover' }} /></div>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { changeLogo(event.target.files?.[0]); event.target.value = ''; }} />
        </div>
      )}
      {epk ? (
        <div className="gs-card">
          <div className="gs-row" style={{ justifyContent: 'space-between' }}><h2 className="gs-h2" style={{ margin: 0 }}>Perfil público (EPK)</h2>{epk.isPublic && epk.slug && <Link to={`/b/${epk.slug}`} className="gs-btn gs-btn--sm">Ver mi página pública</Link>}</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '14px 0' }}><img src={assetUrl(profile.data.logoPath)} alt="" width="64" height="64" style={{ borderRadius: 0, objectFit: 'cover' }} />{profile.data.logoProvisional && <span className="gs-badge gs-badge--warn">Logo provisional de GrooveSpace</span>}</div>
          <div className="gs-grid gs-grid--2" style={{ gap: 12 }}>
            <Field label="Género"><input value={epk.genre} onChange={(e) => setEpk({ ...epk, genre: e.target.value })} /></Field>
            <Field label="Alcaldía / colonia"><input value={epk.district} onChange={(e) => setEpk({ ...epk, district: e.target.value })} /></Field>
          </div>
          <Field label="Biografía"><textarea value={epk.bio} maxLength={1200} onChange={(e) => setEpk({ ...epk, bio: e.target.value })} /></Field>
          <div className="gs-field"><span>Enlaces (Spotify, Instagram, YouTube…)</span>
            {epk.pressLinks.map((link, index) => <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8 }}><input value={link.label} placeholder="Etiqueta" onChange={(e) => setEpk({ ...epk, pressLinks: epk.pressLinks.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)) })} /><input value={link.url} placeholder="https://…" onChange={(e) => setEpk({ ...epk, pressLinks: epk.pressLinks.map((item, i) => (i === index ? { ...item, url: e.target.value } : item)) })} /><button className="gs-btn gs-btn--sm" onClick={() => setEpk({ ...epk, pressLinks: epk.pressLinks.filter((_, i) => i !== index) })}>Quitar</button></div>)}
            {epk.pressLinks.length < 8 && <button type="button" className="gs-btn gs-btn--sm" onClick={() => setEpk({ ...epk, pressLinks: [...epk.pressLinks, { label: '', url: '' }] })}>+ Enlace</button>}
          </div>
          <label className={`gs-choice ${epk.isPublic ? 'on' : ''}`} style={{ margin: '8px 0 14px' }}><input type="checkbox" checked={epk.isPublic} onChange={(e) => setEpk({ ...epk, isPublic: e.target.checked })} /><div><b>Mostrar mi banda en el directorio público</b><small>Sólo se publican nombre, logo, bio, género, integrantes e instrumentos.</small></div></label>
          <button className="gs-btn gs-btn--primary" onClick={saveEpk}>Guardar perfil</button>
        </div>
      ) : <div className="gs-card"><h2 className="gs-h2">Perfil público</h2><p className="gs-hint">Pide al líder que complete el perfil público de la banda.</p></div>}

      {actor.role === 'lider' && (
        <div className="gs-card"><h2 className="gs-h2">Instrumentos para tu sala 3D</h2>
          <div className="gs-row">{(profile.data?.instruments || []).map((item) => <span key={item._id || item.name} className="gs-badge">{item.name}</span>)}</div>
          <div className="gs-grid gs-grid--2" style={{ gap: 10, marginTop: 12 }}><input className="gs-input" placeholder="Nombre (ej. Saxofón alto)" value={newInstrument.name} onChange={(e) => setNewInstrument({ ...newInstrument, name: e.target.value })} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setNewInstrument({ ...newInstrument, file: e.target.files?.[0] || null })} /></div>
          <button className="gs-btn gs-btn--sm" style={{ marginTop: 10 }} disabled={!newInstrument.name.trim() || !newInstrument.file} onClick={addInstrument}>Agregar instrumento</button>
        </div>
      )}

      <div className="gs-grid gs-grid--2" style={{ alignItems: 'start' }}>
        <div className="gs-card"><h2 className="gs-h2">Setlist</h2>
          {songs.map((song, index) => <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 70px auto', gap: 8, marginBottom: 8 }}><input className="gs-input" value={song.title} disabled={!manager} onChange={(e) => setSongs(songs.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)))} placeholder="Canción" /><input className="gs-input" type="number" min="1" max="60" value={song.durationMin} disabled={!manager} onChange={(e) => setSongs(songs.map((item, i) => (i === index ? { ...item, durationMin: e.target.value } : item)))} aria-label="Minutos" />{manager && <button className="gs-btn gs-btn--sm" onClick={() => setSongs(songs.filter((_, i) => i !== index))}>Quitar</button>}</div>)}
          <p className="gs-hint">Total: {songs.reduce((sum, song) => sum + (Number(song.durationMin) || 0), 0)} min</p>
          {manager && <div className="gs-row"><button className="gs-btn gs-btn--sm" onClick={() => setSongs([...songs, { title: '', durationMin: 4, notes: '' }])}>+ Canción</button><button className="gs-btn gs-btn--sm gs-btn--primary" onClick={async () => { const data = await save('/band/setlist', 'PUT', { songs }, 'Setlist guardado'); if (data) setSongs(data); }}>Guardar</button></div>}
        </div>
        <div className="gs-card"><h2 className="gs-h2">Rider técnico</h2>
          {[['stageNeeds', 'Necesidades de escenario'], ['backline', 'Backline requerido'], ['monitors', 'Monitores'], ['notes', 'Notas']].map(([key, label]) => <Field key={key} label={label}><textarea value={rider[key] || ''} disabled={!manager} onChange={(e) => setRider({ ...rider, [key]: e.target.value })} style={{ minHeight: 64 }} /></Field>)}
          {manager && <button className="gs-btn gs-btn--sm gs-btn--primary" onClick={() => save('/band/rider', 'PUT', rider, 'Rider guardado')}>Guardar rider</button>}
          <p className="gs-hint" style={{ marginTop: 8 }}>Tu ingeniero y el staff lo consultan antes de la sesión.</p>
        </div>
      </div>
    </div>
  );
}
