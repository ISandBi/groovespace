import { useEffect, useState } from 'react';
import './AuthScreen.css';
import { FaUpload, FaLink, FaWhatsapp, FaArrowRight, FaChevronLeft, FaCheckCircle } from 'react-icons/fa';
import { API_URL, readApiResponse } from '../api';

const DEFAULT_EMAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com'];

export default function AuthScreen({ onLoginSuccess, onCancel }) {
  const [bandName, setBandName] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeBandData, setActiveBandData] = useState(null);
  const [instruments, setInstruments] = useState([{ name: '', file: null }]);
  const [requiresEngineer, setRequiresEngineer] = useState(false);
  const [engineers, setEngineers] = useState([]);
  const [engineerId, setEngineerId] = useState('');
  const [emailLocalPart, setEmailLocalPart] = useState('');
  const [emailDomain, setEmailDomain] = useState(DEFAULT_EMAIL_DOMAINS[0]);
  const [loginEmail, setLoginEmail] = useState('');
  const [emailDomains, setEmailDomains] = useState(DEFAULT_EMAIL_DOMAINS);
  const [emailDomainsError, setEmailDomainsError] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/bands/engineers`)
      .then((response) => readApiResponse(response, 'No se pudieron cargar los perfiles de ingeniería.'))
      .then(setEngineers)
      .catch(() => setEngineers([]));
    fetch(`${API_URL}/bands/email-domains`)
      .then(async (response) => {
        const data = await readApiResponse(response, 'No se pudieron cargar los dominios de correo.');
        if (!Array.isArray(data) || data.length === 0) throw new Error('No hay dominios de correo disponibles.');
        setEmailDomains(data);
        setEmailDomain(data[0]);
      })
      .catch(() => {
        setEmailDomains(DEFAULT_EMAIL_DOMAINS);
        setEmailDomain((current) => current || DEFAULT_EMAIL_DOMAINS[0]);
        setEmailDomainsError('Mostrando los dominios habituales mientras se restablece la conexión.');
      });
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFile(e.target.files[0]);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!logoFile || instruments.some((instrument) => !instrument.name.trim() || !instrument.file)) {
      setErrorMsg('Agrega nombre y fotografía para cada instrumento, además del logotipo.');
      return;
    }
    if (requiresEngineer && !engineerId) {
      setErrorMsg('Selecciona el ingeniero que acompañará a tu banda.');
      return;
    }
    if (!emailLocalPart.trim() || !emailDomain || !emailDomains.includes(emailDomain)) {
      setErrorMsg('Escribe el correo y selecciona uno de los dominios disponibles.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('name', bandName);
    formData.append('leaderName', leaderName);
    formData.append('email', `${emailLocalPart.trim()}@${emailDomain}`);
    formData.append('password', password);
    formData.append('logo', logoFile);
    formData.append('instruments', JSON.stringify(instruments.map(({ name }) => ({ name }))));
    formData.append('requiresEngineer', String(requiresEngineer));
    if (requiresEngineer) formData.append('engineerId', engineerId);
    instruments.forEach(({ file }) => formData.append('instrumentPhotos', file));

    try {
      const response = await fetch(`${API_URL}/bands/register`, {
        method: 'POST',
        body: formData
      });

      const data = await readApiResponse(response, 'Error al procesar el registro de banda.');

      setActiveBandData({
        _id: data.band._id,
        bandName: data.band.name,
        leaderName: data.band.leaderName,
        logoPath: data.band.logoPath,
        instruments: data.band.instruments,
        members: data.band.members,
        requiresEngineer: data.band.requiresEngineer,
        engineerId: data.band.engineerId,
        inviteToken: data.inviteToken,
        accessToken: data.accessToken
      });

      setGeneratedLink(`${window.location.origin}/invite/${data.inviteToken}`);
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await fetch(`${API_URL}/bands/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password })
      });
      const data = await readApiResponse(response, 'No se pudo iniciar sesión.');
      onLoginSuccess({ ...data.band, accessToken: data.accessToken });
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = () => {
    if (activeBandData) {
      onLoginSuccess(activeBandData);
    } else {
      onLoginSuccess({
        _id: "66f2b2f9b1d8b22a45d11111",
        bandName,
        leaderName,
        logoPath: '/logo-banda-placeholder.png'
      });
    }
  };

  return (
    <div className="page-slide-transition" style={{ padding: '32px 24px', boxSizing: 'border-box', overflowY: 'auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', marginBottom: '32px' }}>
        <button onClick={onCancel} className="btn-back-console" style={{ color: 'var(--color-text-title)' }}>
          <FaChevronLeft />
          <span>Volver al catálogo</span>
        </button>
      </header>

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '26px', fontWeight: '800', margin: '0 0 6px 0', color: 'var(--color-text-title)' }}>{isLogin ? 'Acceso de banda' : 'Registro de banda'}</h2>
        <p style={{ color: 'var(--color-text-muted)', margin: 0, fontSize: '14px' }}>{isLogin ? 'Entra para gestionar tu perfil y tus reservas.' : 'Crea el perfil de tu agrupación para reservar salas.'}</p>
      </div>

      {!generatedLink ? (
        <form onSubmit={isLogin ? handleLogin : handleRegister}>
          {!isLogin && <>
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label-lux">Nombre oficial de la Banda</label>
            <input type="text" className="input-corporate" required value={bandName} onChange={(e) => setBandName(e.target.value)} placeholder="Ej. Los Pixies CDMX" disabled={loading} />
          </div>
          </>}

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label-lux" htmlFor="band-email">Correo de acceso</label>
            {isLogin ? (
              <input id="band-email" type="email" autoComplete="email" className="input-corporate" required value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} disabled={loading} />
            ) : (
              <>
                <div className="band-email-composer">
                  <input
                    id="band-email"
                    type="text"
                    autoComplete="email"
                    className="input-corporate"
                    required
                    value={emailLocalPart}
                    onChange={(event) => setEmailLocalPart(event.target.value)}
                    disabled={loading}
                    placeholder="nombre"
                    aria-label="Nombre de correo antes de arroba"
                  />
                  <span className="band-email-at" aria-hidden="true">@</span>
                  <select
                    className="input-corporate band-email-domain"
                    aria-label="Dominio del correo"
                    value={emailDomain}
                    onChange={(event) => setEmailDomain(event.target.value)}
                    disabled={loading}
                    required
                  >
                    {emailDomains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
                  </select>
                </div>
                {emailDomainsError && <p role="status" style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{emailDomainsError}</p>}
              </>
            )}
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label className="form-label-lux" htmlFor="band-password">{isLogin ? 'Contraseña' : 'Contraseña (mínimo 10 caracteres)'}</label>
            <input id="band-password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={isLogin ? undefined : 10} className="input-corporate" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
          </div>

          {!isLogin && <>

          <div className="console-section-card" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700', color: 'var(--color-text-title)' }}>
              <input type="checkbox" checked={requiresEngineer} onChange={(event) => setRequiresEngineer(event.target.checked)} />
              Requerimos ingeniero de GrooveSpace
            </label>
            {requiresEngineer && (
              <select className="input-corporate" style={{ marginTop: '14px' }} value={engineerId} onChange={(event) => setEngineerId(event.target.value)} required>
                <option value="">Selecciona un perfil de ingeniería</option>
                {engineers.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.name} · {engineer.specialty}</option>)}
              </select>
            )}
          </div>
          </>}

          {!isLogin && <>
          <div className="console-section-card" style={{ marginBottom: '20px' }}>
            <h3 className="console-section-title">Instrumentos de la banda</h3>
            {instruments.map((instrument, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <input className="input-corporate" value={instrument.name} placeholder="Nombre del instrumento" onChange={(event) => setInstruments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} required />
                <input className="input-corporate" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setInstruments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, file: event.target.files?.[0] || null } : item))} required />
              </div>
            ))}
            <button type="button" className="btn-grid-action" onClick={() => setInstruments((current) => [...current, { name: '', file: null }])} disabled={instruments.length >= 12}>Agregar instrumento</button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="form-label-lux">Nombre del Líder / Representante</label>
            <input type="text" className="input-corporate" required value={leaderName} onChange={(e) => setLeaderName(e.target.value)} placeholder="Tu nombre completo" disabled={loading} />
          </div>

          <div style={{ marginBottom: '36px' }}>
            <label className="form-label-lux">Identidad de Agrupación (Logo)</label>
            <input 
              type="file" 
              id="band-logo-upload" 
              accept="image/*" 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
              disabled={loading}
            />
            <label 
              htmlFor="band-logo-upload" 
              style={{ display: 'block', border: '2px dashed var(--color-border-default)', padding: '32px 20px', borderRadius: '16px', textAlign: 'center', backgroundColor: '#ffffff', cursor: loading ? 'not-allowed' : 'pointer', transition: 'border-color 0.2s ease' }}
            >
              {logoFile ? (
                <div>
                  <FaCheckCircle size={28} style={{ color: 'var(--color-booking-available)', marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: 'var(--color-text-title)' }}>{logoFile.name}</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>Haga clic para cambiar de archivo</p>
                </div>
              ) : (
                <div>
                  <FaUpload size={24} style={{ color: 'var(--color-text-muted)', marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--color-text-title)' }}>Seleccionar archivo de imagen</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>Soporta formatos .png, .jpg y .webp</p>
                </div>
              )}
            </label>
          </div>
          </>}

          {errorMsg && (
            <div style={{ backgroundColor: 'rgba(220, 53, 69, 0.08)', border: '1px solid var(--color-state-error)', color: 'var(--color-state-error)', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '20px', textAlign: 'center' }}>
              {errorMsg}
            </div>
          )}

          <button type="submit" className="btn-action-submit-grand" disabled={loading}>
            <span>{loading ? 'Procesando...' : isLogin ? 'Iniciar sesión' : 'Registrar agrupación'}</span>
          </button>
          <button type="button" onClick={() => { setIsLogin((current) => !current); setErrorMsg(''); }} style={{ width: '100%', marginTop: '14px', border: 0, background: 'transparent', color: 'var(--color-brand-primary)', cursor: 'pointer', fontWeight: '700' }}>
            {isLogin ? 'Crear perfil de banda' : 'Ya tengo una cuenta'}
          </button>
        </form>
      ) : (
        <div style={{ animation: 'viewSlideLeft 0.3s ease' }}>
          <div className="console-section-card" style={{ textAlign: 'center' }}>
            <FaLink size={32} style={{ color: 'var(--color-brand-primary)', marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--color-text-title)' }}>Ecosistema Sincronizado</h4>
            <p style={{ color: 'var(--color-text-body)', fontSize: '14px', margin: '0 0 20px 0' }}>
              Comparte esta invitación con hasta 100 integrantes. Cada persona podrá agregar su nombre e instrumento desde su propio móvil.
            </p>
            
            <div style={{ backgroundColor: 'var(--color-surface-background)', padding: '14px', borderRadius: '12px', border: '1px solid var(--color-border-default)', fontSize: '14px', color: 'var(--color-brand-primary)', fontWeight: '700', marginBottom: '20px', wordBreak: 'break-all' }}>
              {generatedLink}
            </div>

            <a href={`https://wa.me/?text=${encodeURIComponent(`Únete a ${activeBandData?.bandName}: ${generatedLink}`)}`} target="_blank" rel="noreferrer" className="btn-grid-action" style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderColor: '#198754', color: '#198754', textDecoration: 'none', boxSizing: 'border-box' }}>
              <FaWhatsapp size={16} /> <span>Distribuir por WhatsApp</span>
            </a>
          </div>

          <button onClick={handleFinalize} className="btn-action-submit-grand" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <span>Avanzar a Consola de Renta</span>
            <FaArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
