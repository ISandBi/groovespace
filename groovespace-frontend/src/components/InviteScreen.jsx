import { useState } from 'react';
import { IcUsers } from '../ui/icons.jsx';
import { api } from '../lib/http';
import { navigate } from '../lib/router.jsx';
import { saveSession } from '../lib/session';
import { ErrorNote, Field, useAsync } from '../ui/kit.jsx';

/** Pantalla que abre el enlace de invitación (WhatsApp, Telegram o correo). Al unirse, el integrante queda con sesión propia. */
export default function InviteScreen({ token }) {
  const invite = useAsync(() => api(`/bands/invite/${encodeURIComponent(token)}`), [token]);
  const [name, setName] = useState('');
  const [instrument, setInstrument] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await api(`/bands/invite/${encodeURIComponent(token)}/members`, { method: 'POST', body: { name, instrument } });
      if (data.memberSession) saveSession('member', { ...data.memberSession, bandName: invite.data.bandName });
      navigate('/banda', { replace: true });
    } catch (requestError) { setError(requestError.message); setBusy(false); }
  };

  return (
    <div className="gs-page" style={{ maxWidth: 480 }}>
      <form className="gs-card" onSubmit={join}>
        <IcUsers size={28} color="var(--color-brand-primary)" />
        <p className="gs-eyebrow" style={{ marginTop: 10 }}>Invitación</p>
        <h1 className="gs-h1" style={{ fontSize: 28, marginBottom: 14 }}>{invite.loading ? 'Verificando…' : invite.data?.bandName || 'Invitación GrooveSpace'}</h1>
        <ErrorNote error={invite.error} />
        {invite.data && <>
          <p className="gs-hint">Únete para ver ensayos, confirmar asistencia, dividir pagos y acceder al material de tu banda.</p>
          <Field label="Tu nombre"><input value={name} onChange={(event) => setName(event.target.value)} required disabled={busy} /></Field>
          <Field label="Instrumento o rol"><input value={instrument} onChange={(event) => setInstrument(event.target.value)} required disabled={busy} /></Field>
          <ErrorNote error={error} />
          <button className="gs-btn gs-btn--primary gs-btn--block" disabled={busy}>{busy ? 'Uniéndote…' : 'Unirme a la banda'}</button>
        </>}
      </form>
    </div>
  );
}
