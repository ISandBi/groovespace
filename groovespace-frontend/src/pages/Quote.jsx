import { useEffect, useMemo, useState } from 'react';
import { IcChevronLeft } from '../ui/icons.jsx';
import { bandActor, useSessions } from '../lib/session';
import { Link, navigate } from '../lib/router.jsx';
import { computeQuote, loadCatalog, newDraft, readDraft, saveDraft } from '../lib/quote';
import { QuoteBuilder, QuotePanel } from '../components/QuoteBuilder.jsx';
import { ErrorNote, Skeleton, useAsync } from '../ui/kit.jsx';

/** Cotizador público: sin cuenta, la banda arma su sesión y ve el precio cambiar en el panel derecho. */
export default function Quote({ roomId }) {
  const sessions = useSessions();
  const catalog = useAsync(loadCatalog, []);
  const room = catalog.data?.rooms.find((item) => item.id === roomId);
  const [draft, setDraft] = useState(() => readDraft(roomId) || newDraft(roomId));
  useEffect(() => { saveDraft(draft); }, [draft]);
  const quote = useMemo(() => computeQuote(catalog.data, draft), [catalog.data, draft]);

  if (catalog.loading) return <div className="gs-page"><Skeleton rows={4} /></div>;
  if (catalog.error || !room) return <div className="gs-page"><ErrorNote error={catalog.error || 'No encontramos esa sala.'} /><Link to="/" className="gs-btn">Volver a las salas</Link></div>;

  const proceed = () => navigate(bandActor(sessions) ? `/reservar/${room.id}` : `/registro?next=${encodeURIComponent(`/reservar/${room.id}`)}`);
  return (
    <div className="gs-page">
      <Link to="/#catalogo" className="gs-crumb"><IcChevronLeft size={16} /> Volver a las salas</Link>
      <div className="gs-page-head">
        <div><p className="gs-eyebrow">Cotizador · sin crear cuenta</p><h1 className="gs-h1">{room.name}</h1><p className="gs-lead" style={{ marginTop: 16, marginBottom: 0 }}>{room.blurb}</p></div>
        <img src={room.imagePath} alt="" className="gs-photo" style={{ width: 'min(320px, 100%)', aspectRatio: '16 / 10', objectFit: 'cover' }} />
      </div>
      <div className="gs-steps"><span className="on">01 Arma tu sesión</span><span>02 Registra a tu banda</span><span>03 Elige fecha y paga</span></div>
      <div className="gs-split">
        <QuoteBuilder catalog={catalog.data} room={room} draft={draft} setDraft={setDraft} />
        <QuotePanel quote={quote} room={room}>
          <button className="gs-btn gs-btn--primary gs-btn--block" style={{ marginTop: 14 }} onClick={proceed}>{bandActor(sessions) ? 'Continuar a fecha y pago' : 'Registrar mi banda y elegir fecha'}</button>
          <p className="gs-hint" style={{ marginTop: 8 }}>Tu selección se conserva al registrarte. No se cobra nada hasta el paso de pago.</p>
        </QuotePanel>
      </div>
    </div>
  );
}
