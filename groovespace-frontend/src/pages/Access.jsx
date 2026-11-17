import { useEffect, useState } from 'react';
import { IcCheckCircle, IcX } from '../ui/icons.jsx';
import { API_URL, readApiResponse } from '../api';
import { api } from '../lib/http';
import { ErrorNote, Field } from '../ui/kit.jsx';
import SharePanel from '../components/SharePanel.jsx';

const DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com'];

/** Acceso y registro de banda. El logotipo es opcional: sin él se asigna uno provisional de GrooveSpace. */
export default function Access({ onSuccess, intro, startRegister = false }) {
  const [isLogin, setIsLogin] = useState(!startRegister);
  const [form, setForm] = useState({ name: '', leaderName: '', local: '', domain: DOMAINS[0], email: '', password: '' });
  const [domains, setDomains] = useState(DOMAINS);
  const [engineers, setEngineers] = useState([]);
  const [needsEngineer, setNeedsEngineer] = useState(false);
  const [engineerId, setEngineerId] = useState('');
  const [logo, setLogo] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    api('/bands/engineers').then(setEngineers).catch(() => {});
    api('/bands/email-domains').then((list) => { if (Array.isArray(list) && list.length) { setDomains(list); setForm((current) => ({ ...current, domain: list[0] })); } }).catch(() => {});
  }, []);

  const login = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await api('/bands/login', { method: 'POST', body: { email: form.email, password: form.password } });
      onSuccess({ ...data.band, accessToken: data.accessToken });
    } catch (requestError) { setError(requestError.message); setBusy(false); }
  };

  const register = async (event) => {
    event.preventDefault();
    if (instruments.some((item) => !item.name.trim() || !item.file)) { setError('Cada instrumento necesita nombre y fotografía (o quítalo).'); return; }
    if (needsEngineer && !engineerId) { setError('Selecciona el ingeniero que acompañará a tu banda.'); return; }
    setBusy(true); setError('');
    const body = new FormData();
    body.append('name', form.name); body.append('leaderName', form.leaderName); body.append('email', `${form.local.trim()}@${form.domain}`); body.append('password', form.password);
    if (logo) body.append('logo', logo);
    body.append('instruments', JSON.stringify(instruments.map(({ name }) => ({ name }))));
    body.append('requiresEngineer', String(needsEngineer));
    if (needsEngineer) body.append('engineerId', engineerId);
    instruments.forEach(({ file }) => body.append('instrumentPhotos', file));
    try {
      const response = await fetch(`${API_URL}/bands/register`, { method: 'POST', body });
      const data = await readApiResponse(response, 'No se pudo registrar la banda.');
      setCreated({ _id: data.band._id, bandName: data.band.name, leaderName: data.band.leaderName, logoPath: data.band.logoPath, logoProvisional: data.band.logoProvisional, instruments: data.band.instruments, members: data.band.members, requiresEngineer: data.band.requiresEngineer, engineerId: data.band.engineerId, inviteToken: data.inviteToken, accessToken: data.accessToken });
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  if (created) {
    return (
      <div className="gs-page" style={{ maxWidth: 640 }}>
        <div className="gs-card">
          <IcCheckCircle size={32} color="var(--color-brand-primary)" />
          <h1 className="gs-h1">{created.bandName} ya está registrada</h1>
          {created.logoProvisional && <p className="gs-hint">Te asignamos un logo provisional de GrooveSpace; lo cambias cuando quieras desde tu perfil.</p>}
          <p style={{ color: 'var(--color-text-body)' }}>Invita a tu banda ahora, o hazlo más tarde desde “Equipo”.</p>
          <div style={{ margin: 'var(--s-3) 0' }}><SharePanel token={created.accessToken} /></div>
          <button className="gs-btn gs-btn--primary gs-btn--block" onClick={() => onSuccess(created)}>Continuar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="gs-page" style={{ maxWidth: 680 }}>
      <p className="gs-eyebrow">{isLogin ? 'Acceso' : 'Registro'}</p>
      <h1 className="gs-h1">{isLogin ? 'Entra a tu banda' : 'Registra a tu banda'}</h1>
      {intro && <p className="gs-lead" style={{ marginTop: 16 }}>{intro}</p>}
      <form className="gs-card" style={{ marginTop: 'var(--s-4)' }} onSubmit={isLogin ? login : register}>
        {!isLogin && <Field label="Nombre de la banda"><input required value={form.name} onChange={set('name')} placeholder="Ej. Los Pixies CDMX" disabled={busy} /></Field>}
        {isLogin ? (
          <Field label="Correo"><input type="email" autoComplete="email" required value={form.email} onChange={set('email')} disabled={busy} /></Field>
        ) : (
          <Field label="Correo de acceso">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
              <input required value={form.local} onChange={set('local')} placeholder="nombre" aria-label="Antes de la arroba" disabled={busy} />
              <span>@</span>
              <select value={form.domain} onChange={set('domain')} aria-label="Dominio">{domains.map((domain) => <option key={domain}>{domain}</option>)}</select>
            </div>
          </Field>
        )}
        <Field label={isLogin ? 'Contraseña' : 'Contraseña (mínimo 10 caracteres)'}><input type="password" required minLength={isLogin ? undefined : 10} autoComplete={isLogin ? 'current-password' : 'new-password'} value={form.password} onChange={set('password')} disabled={busy} /></Field>
        {!isLogin && (
          <>
            <Field label="Líder o representante"><input required value={form.leaderName} onChange={set('leaderName')} placeholder="Tu nombre completo" disabled={busy} /></Field>
            <Field label="Logotipo (opcional)" hint="Si no subes uno, GrooveSpace te asigna un logo provisional con las iniciales de tu banda."><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogo(event.target.files?.[0] || null)} /></Field>
            <div className="gs-field"><span>Instrumentos (opcional) — se convierten en modelos 3D para tu sala</span>
              {instruments.map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                  <input value={item.name} placeholder="Ej. Batería, Bajo Jazz" onChange={(event) => setInstruments((list) => list.map((entry, i) => (i === index ? { ...entry, name: event.target.value } : entry)))} />
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setInstruments((list) => list.map((entry, i) => (i === index ? { ...entry, file: event.target.files?.[0] || null } : entry)))} />
                  <button type="button" className="gs-btn gs-btn--sm" aria-label="Quitar" onClick={() => setInstruments((list) => list.filter((_, i) => i !== index))}><IcX size={16} /></button>
                </div>
              ))}
              <button type="button" className="gs-btn gs-btn--sm" onClick={() => setInstruments((list) => [...list, { name: '', file: null }])} disabled={instruments.length >= 12}>+ Agregar instrumento</button>
            </div>
            <label className={`gs-choice ${needsEngineer ? 'on' : ''}`} style={{ marginBottom: 14 }}>
              <input type="checkbox" checked={needsEngineer} onChange={(event) => setNeedsEngineer(event.target.checked)} />
              <div><b>Quiero ingeniero de GrooveSpace</b><small>Podrás cambiarlo por sesión y enviarle una demo.</small></div>
            </label>
            {needsEngineer && <Field label="Ingeniero"><select value={engineerId} onChange={(event) => setEngineerId(event.target.value)} required><option value="">Selecciona…</option>{engineers.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.name} · {engineer.specialty}</option>)}</select></Field>}
          </>
        )}
        <ErrorNote error={error} />
        <button className="gs-btn gs-btn--primary gs-btn--block" disabled={busy}>{busy ? 'Procesando…' : isLogin ? 'Entrar' : 'Crear cuenta de la banda'}</button>
        <button type="button" className="gs-btn gs-btn--block gs-btn--text" style={{ marginTop: 10 }} onClick={() => { setIsLogin(!isLogin); setError(''); }}>{isLogin ? 'No tengo cuenta: registrar mi banda' : 'Ya tengo cuenta: entrar'}</button>
      </form>
    </div>
  );
}
