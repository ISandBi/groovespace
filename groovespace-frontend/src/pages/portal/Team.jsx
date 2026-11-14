import { api, assetUrl } from '../../lib/http';
import { Empty, ErrorNote, Skeleton, toast, useAsync } from '../../ui/kit.jsx';
import SharePanel from '../../components/SharePanel.jsx';

const ROLE = { lider: 'Líder', tesorero: 'Tesorero', integrante: 'Integrante' };

export default function Team({ actor }) {
  const team = useAsync(() => api('/band/team', { token: actor.token }), [actor.token]);
  const leader = actor.role === 'lider';
  const setRole = async (id, role) => { try { await api(`/band/members/${id}/role`, { method: 'PATCH', token: actor.token, body: { role } }); team.reload(); } catch (error) { toast(error.message, 'err'); } };
  const accessLink = async (id) => {
    try { const data = await api(`/band/members/${id}/access-link`, { method: 'POST', token: actor.token }); await navigator.clipboard.writeText(data.url).catch(() => {}); toast('Enlace personal copiado. Envíalo sólo a esa persona.'); } catch (error) { toast(error.message, 'err'); }
  };
  if (team.loading) return <Skeleton />;
  if (team.error) return <ErrorNote error={team.error} />;
  return (
    <div className="gs-grid gs-grid--2" style={{ alignItems: 'start' }}>
      <div className="gs-card"><h2 className="gs-h2">Integrantes</h2>
        <div className="gs-list">
          <div className="gs-item"><b>{team.data.leader.name}</b><span className="gs-badge gs-badge--ok">Líder</span></div>
          {team.data.members.map((member) => (
            <div className="gs-item" key={member.id}>
              <div><b>{member.name}</b><div className="gs-hint">{member.instrument}</div></div>
              <div className="gs-row">
                {leader ? <select className="gs-input" style={{ width: 'auto', minHeight: 34 }} value={member.role} onChange={(event) => setRole(member.id, event.target.value)} aria-label={`Cargo de ${member.name}`}><option value="integrante">Integrante</option><option value="tesorero">Tesorero</option></select> : <span className="gs-badge">{ROLE[member.role]}</span>}
                {leader && <button className="gs-btn gs-btn--sm" onClick={() => accessLink(member.id)}>Enlace personal</button>}
              </div>
            </div>))}
          {team.data.members.length === 0 && <Empty>Invita a tu banda con el enlace.</Empty>}
        </div>
        <p className="gs-hint" style={{ marginTop: 12 }}>El tesorero puede pagar y aprobar entregables; los integrantes confirman asistencia, pagan su parte y ven archivos.</p>
      </div>
      {['lider', 'tesorero'].includes(actor.role) && <div className="gs-card"><h2 className="gs-h2">Invitar</h2><SharePanel token={actor.token} /></div>}
    </div>
  );
}
export { assetUrl };
