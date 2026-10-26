import { useEffect, useState } from 'react';
import { FaChevronLeft, FaUsers, FaGuitar, FaHeadphones, FaWhatsapp, FaSave, FaTrash } from 'react-icons/fa';
import './StaffDashboard.css';
import { API_ORIGIN, API_URL } from '../api';

const BACKEND_URL = API_ORIGIN;

export default function BandProfile({ bandInfo, onClose }) {
  const [profile, setProfile] = useState(bandInfo);
  const [engineer, setEngineer] = useState(null);
  const [engineers, setEngineers] = useState([]);
  const [requiresEngineer, setRequiresEngineer] = useState(Boolean(bandInfo.requiresEngineer));
  const [engineerId, setEngineerId] = useState(bandInfo.engineerId || '');
  const [reservations, setReservations] = useState([]);
  const [name, setName] = useState(bandInfo.bandName || bandInfo.name || '');
  const [leaderName, setLeaderName] = useState(bandInfo.leaderName || '');
  const [inviteToken, setInviteToken] = useState(bandInfo.inviteToken || '');
  const [newInstruments, setNewInstruments] = useState([{ name: '', file: null }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inviteLink = inviteToken ? `${window.location.origin}/invite/${inviteToken}` : '';

  useEffect(() => {
    const authHeaders = { Authorization: `Bearer ${bandInfo.accessToken}` };
    Promise.all([
      fetch(`${API_URL}/bands/${encodeURIComponent(bandInfo._id)}/profile`, { headers: { Authorization: `Bearer ${bandInfo.accessToken}` } }),
      fetch(`${API_URL}/bands/engineers`),
      fetch(`${API_URL}/reservations/band/${encodeURIComponent(bandInfo._id)}`, { headers: authHeaders })
    ]).then(async ([profileResponse, engineerResponse, reservationResponse]) => {
      const data = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(data.error || 'No se pudo cargar el perfil.');
      setProfile(data);
      setName(data.name);
      setLeaderName(data.leaderName);
      if (reservationResponse.ok) setReservations(await reservationResponse.json());
      if (engineerResponse.ok) {
        const engineers = await engineerResponse.json();
        setEngineers(engineers);
        setEngineer(engineers.find((item) => item.id === data.engineerId) || null);
      }
      setRequiresEngineer(Boolean(data.requiresEngineer));
      setEngineerId(data.engineerId || '');
    }).catch((requestError) => setError(requestError.message));
  }, [bandInfo._id, bandInfo.accessToken]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/bands/${bandInfo._id}/profile`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${bandInfo.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, leaderName, requiresEngineer, engineerId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar el perfil.');
      setProfile((current) => ({ ...current, ...data }));
      setEngineer(requiresEngineer ? engineers.find((item) => item.id === engineerId) || null : null);
    } catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };

  const createInvite = async () => {
    setError('');
    try {
      const response = await fetch(`${API_URL}/bands/invite`, { method: 'POST', headers: { Authorization: `Bearer ${bandInfo.accessToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo crear la invitación.');
      setInviteToken(data.inviteToken);
    } catch (requestError) { setError(requestError.message); }
  };

  const removeMember = async (memberId) => {
    try {
      const response = await fetch(`${API_URL}/bands/${bandInfo._id}/members/${memberId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${bandInfo.accessToken}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo quitar al integrante.');
      setProfile((current) => ({ ...current, members: data.members }));
    } catch (requestError) { setError(requestError.message); }
  };

  const addInstruments = async (event) => {
    event.preventDefault();
    if (newInstruments.some((instrument) => !instrument.name.trim() || !instrument.file)) {
      setError('Cada instrumento nuevo necesita nombre y fotografía.');
      return;
    }
    const formData = new FormData();
    formData.append('instruments', JSON.stringify(newInstruments.map(({ name: instrumentName }) => ({ name: instrumentName }))));
    newInstruments.forEach(({ file }) => formData.append('instrumentPhotos', file));
    const response = await fetch(`${API_URL}/bands/${bandInfo._id}/instruments`, { method: 'POST', headers: { Authorization: `Bearer ${bandInfo.accessToken}` }, body: formData });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'No se pudieron agregar los instrumentos.');
    else {
      setProfile((current) => ({ ...current, instruments: data.instruments }));
      setNewInstruments([{ name: '', file: null }]);
    }
  };

  return (
    <main className="page-slide-transition" style={{ overflowY: 'auto', padding: '20px' }}>
      <div className="staff-layout" style={{ padding: '0 0 40px' }}>
        <button onClick={onClose} className="btn-back-console"><FaChevronLeft size={12} /><span>Catálogo</span></button>
        <header style={{ display: 'flex', alignItems: 'center', gap: '18px', margin: '28px 0' }}>
          <img src={`${BACKEND_URL}${profile.logoPath}`} alt="" className="band-mini-logo" style={{ width: '64px', height: '64px' }} />
          <div>
            <h1 style={{ margin: 0, color: 'var(--color-text-title)' }}>{profile.bandName || profile.name}</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)' }}>Líder: {profile.leaderName}</p>
          </div>
        </header>

        {error && <p role="alert" style={{ color: 'var(--color-state-error)' }}>{error}</p>}

        <form className="console-section-card" onSubmit={saveProfile}>
          <h2 className="console-section-title">Datos de la banda</h2>
          <label className="form-label-lux" htmlFor="band-profile-name">Nombre</label>
          <input id="band-profile-name" className="input-corporate" value={name} onChange={(event) => setName(event.target.value)} required />
          <label className="form-label-lux" htmlFor="band-profile-leader" style={{ marginTop: '12px' }}>Líder</label>
          <input id="band-profile-leader" className="input-corporate" value={leaderName} onChange={(event) => setLeaderName(event.target.value)} required />
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', fontWeight: '700' }}>
            <input type="checkbox" checked={requiresEngineer} onChange={(event) => setRequiresEngineer(event.target.checked)} />
            Requerimos ingeniero
          </label>
          {requiresEngineer && <select className="input-corporate" style={{ marginTop: '12px' }} value={engineerId} onChange={(event) => setEngineerId(event.target.value)} required>
            <option value="">Seleccionar ingeniero</option>
            {engineers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.specialty}</option>)}
          </select>}
          <button type="submit" className="btn-grid-action" style={{ marginTop: '14px' }} disabled={saving}><FaSave /> {saving ? 'Guardando...' : 'Guardar perfil'}</button>
        </form>

        <section className="console-section-card">
          <h2 className="console-section-title"><FaUsers /> Integrantes ({profile.members?.length || 0}/100)</h2>
          {profile.members?.length ? profile.members.map((member) => (
            <div key={member._id || `${member.name}-${member.instrument}`} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-default)', padding: '12px 0' }}>
              <strong>{member.name}</strong><span>{member.instrument}</span>
              {member._id && <button type="button" aria-label={`Quitar a ${member.name}`} title="Quitar integrante" onClick={() => removeMember(member._id)} style={{ border: 0, background: 'transparent', color: 'var(--color-state-error)', cursor: 'pointer' }}><FaTrash /></button>}
            </div>
          )) : <p style={{ color: 'var(--color-text-muted)' }}>Comparte la invitación para agregar integrantes.</p>}
          {profile.members?.length >= 100
            ? <p role="status" style={{ color: 'var(--color-text-muted)' }}>La banda alcanzó el máximo de 100 integrantes.</p>
            : inviteLink
            ? <a href={`https://wa.me/?text=${encodeURIComponent(`Únete a ${profile.bandName || profile.name}: ${inviteLink}`)}`} target="_blank" rel="noreferrer" className="btn-grid-action" style={{ display: 'inline-flex', gap: '8px', marginTop: '16px', textDecoration: 'none' }}><FaWhatsapp /> Invitar integrante</a>
            : <button type="button" className="btn-grid-action" style={{ marginTop: '16px' }} onClick={createInvite}>Crear invitación</button>}
        </section>

        <section className="console-section-card">
          <h2 className="console-section-title"><FaGuitar /> Instrumentos registrados</h2>
          <div className="gear-premium-matrix">
            {(profile.instruments || []).map((instrument) => (
              <figure key={instrument._id || instrument.name} style={{ margin: 0, border: '1px solid var(--color-border-default)', borderRadius: '8px', overflow: 'hidden' }}>
                <img src={`${BACKEND_URL}${instrument.photoPath}`} alt={instrument.name} style={{ width: '100%', height: '150px', objectFit: 'contain', background: '#e9ece8' }} />
                <figcaption style={{ padding: '10px', fontWeight: '700' }}>{instrument.name}</figcaption>
              </figure>
            ))}
          </div>
          <form onSubmit={addInstruments} style={{ marginTop: '20px' }}>
            {newInstruments.map((instrument, index) => <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input className="input-corporate" placeholder="Nombre del instrumento" value={instrument.name} onChange={(event) => setNewInstruments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} required />
              <input className="input-corporate" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setNewInstruments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, file: event.target.files?.[0] || null } : item))} required />
            </div>)}
            <button type="button" className="btn-grid-action" onClick={() => setNewInstruments((current) => [...current, { name: '', file: null }])} disabled={newInstruments.length >= 12}>Agregar otro instrumento</button>
            <button type="submit" className="btn-grid-action" style={{ marginLeft: '10px' }}>Guardar instrumentos</button>
          </form>
        </section>

        <section className="console-section-card">
          <h2 className="console-section-title">Backline rentado</h2>
          {reservations.filter((reservation) => reservation.rentedGear?.length).map((reservation) => (
            <div key={reservation._id} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border-default)' }}>
              <strong>{reservation.date} · {reservation.roomName}</strong>
              <p style={{ margin: '6px 0 0', color: 'var(--color-text-muted)' }}>{reservation.rentedGear.map((item) => item.name).join(', ')}</p>
            </div>
          ))}
          {!reservations.some((reservation) => reservation.rentedGear?.length) && <p style={{ color: 'var(--color-text-muted)' }}>Aún no hay backline rentado.</p>}
        </section>

        <section className="console-section-card">
          <h2 className="console-section-title"><FaHeadphones /> Ingeniería</h2>
          {profile.requiresEngineer ? engineer ? <><strong>{engineer.name}</strong><p style={{ color: 'var(--color-text-muted)' }}>{engineer.specialty}</p></> : <p>Perfil de ingeniería asignado.</p> : <p>La banda no solicitó ingeniero.</p>}
        </section>
      </div>
    </main>
  );
}