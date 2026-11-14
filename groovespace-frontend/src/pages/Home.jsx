import { FaCalendarCheck, FaFileSignature, FaMicrophoneAlt, FaMusic, FaTicketAlt, FaUsers, FaWallet } from 'react-icons/fa';
import { Link, navigate } from '../lib/router.jsx';
import { mxn } from '../lib/http';
import { loadCatalog } from '../lib/quote';
import { bandActor, useSessions } from '../lib/session';
import { Reveal, Skeleton, useAsync, ErrorNote } from '../ui/kit.jsx';

const FEATURES = [
  [FaUsers, 'Tu banda, organizada', 'Roles, calendario compartido, setlist, rider y archivos en un solo lugar.'],
  [FaWallet, 'Pagos sin fricción', 'Divide el pago entre integrantes, usa tu cartera interna y consulta el historial.'],
  [FaMicrophoneAlt, 'Ingenieros a la medida', 'Compara perfiles, escucha portafolios, envía tu demo y reserva en un clic.'],
  [FaTicketAlt, 'Eventos y boletos', 'Postula a carteles, vende boletos y entra con tu QR en la puerta.'],
  [FaMusic, 'Entregables de grabación', 'Escucha versiones, comenta por minuto y aprueba tu master.'],
  [FaFileSignature, 'Contratos claros', 'Términos y coproducciones con reparto de regalías firmado por cada integrante.']
];

function RoomCard({ room, delay }) {
  const { band } = { band: bandActor(useSessions()) };
  return (
    <Reveal delay={delay} className="gs-card gs-card--hover gs-room">
      <div className="gs-room-media">
        <img src={room.imagePath} alt={room.name} loading="lazy" />
        <span className="gs-badge">Hasta {room.capacity} integrantes</span>
      </div>
      <div className="gs-room-body">
        <h3>{room.name}</h3>
        <p className="gs-hint" style={{ margin: 0 }}>{room.blurb}</p>
        {room.customizable && <span className="gs-badge gs-badge--violet" style={{ justifySelf: 'start' }}>Sala 3D personalizable</span>}
        <div className="gs-row" style={{ justifyContent: 'space-between', marginTop: 'auto' }}>
          <div className="gs-price">{mxn(room.price)}<small> /hora</small></div>
        </div>
        <div className="gs-row">
          <button className="gs-btn gs-btn--sm" onClick={() => navigate(band ? `/reservar/${room.id}` : `/registro?next=${encodeURIComponent(`/reservar/${room.id}`)}`)}>Ver</button>
          <Link to={`/cotizar/${room.id}`} className="gs-btn gs-btn--sm gs-btn--primary">Cotizar</Link>
        </div>
      </div>
    </Reveal>
  );
}

export default function Home() {
  const catalog = useAsync(loadCatalog, []);
  return (
    <>
      <section className="gs-hero">
        <img src="/header-image.webp" alt="" />
        <div className="gs-hero-inner">
          <p className="gs-eyebrow">Estudios de alta escala · CDMX</p>
          <h1>Tu ritmo,<br /><em>tu espacio.</em></h1>
          <p>Reserva salas de ensayo y grabación, suma a tu banda, paga en equipo y entra con un QR. Todo lo que una banda necesita, en una sola plataforma.</p>
          <div className="gs-row" style={{ marginTop: 22 }}>
            <a className="gs-btn gs-btn--primary" href="#catalogo">Explorar salas</a>
            <Link className="gs-btn" to="/eventos"><FaCalendarCheck /> Próximos eventos</Link>
          </div>
          <div className="gs-trust"><span>PCI DSS</span><span>NIST CSF</span><span>Hora CDMX</span><span>Sin cargos ocultos</span></div>
        </div>
        <div className="gs-eq" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} style={{ animationDelay: `${index * 0.09}s`, height: `${40 + ((index * 29) % 60)}%` }} />)}</div>
      </section>

      <section id="catalogo" className="gs-page">
        <div className="gs-page-head"><div><p className="gs-eyebrow">Catálogo</p><h2 className="gs-h1" style={{ fontSize: 34 }}>Elige tu sala</h2></div><p className="gs-hint" style={{ maxWidth: 420 }}>“Cotizar” arma tu sesión sin cuenta y te muestra el precio en vivo; “Ver” te lleva directo a reservar.</p></div>
        {catalog.loading ? <Skeleton rows={3} /> : catalog.error ? <ErrorNote error={catalog.error} /> : <div className="gs-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))' }}>{catalog.data.rooms.map((room, index) => <RoomCard key={room.id} room={room} delay={index * 70} />)}</div>}
      </section>

      <section className="gs-page" style={{ paddingTop: 0 }}>
        <div className="gs-page-head"><div><p className="gs-eyebrow">Más que salas</p><h2 className="gs-h1" style={{ fontSize: 34 }}>La plataforma de tu banda</h2></div></div>
        <div className="gs-grid">
          {FEATURES.map(([Icon, title, text], index) => (
            <Reveal key={title} delay={index * 60} className="gs-card gs-card--hover"><Icon size={22} color="var(--color-brand-primary)" /><h3 style={{ margin: '12px 0 6px', color: 'var(--color-text-title)', fontSize: 16 }}>{title}</h3><p className="gs-hint" style={{ margin: 0 }}>{text}</p></Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
