import { useEffect } from 'react';
import { IcArrowRight, IcCalendar, IcContract, IcMail, IcMic, IcMusic, IcPhone, IcPin, IcTicket, IcUsers, IcWallet, IcClock } from '../ui/icons.jsx';
import { Link, navigate } from '../lib/router.jsx';
import { mxn } from '../lib/http';
import { loadCatalog } from '../lib/quote';
import { SITE } from '../lib/site.js';
import { bandActor, useSessions } from '../lib/session';
import { ErrorNote, Photo, Placeholder, Reveal, SectionHead, Skeleton, useAsync } from '../ui/kit.jsx';

const STEPS = [
  ['Cotiza sin cuenta', 'Elige sala, duración, equipo en renta y ingeniero. El precio se actualiza con cada cambio.'],
  ['Registra a tu banda', 'Nombre, líder y correo. Tu cotización se conserva al crear la cuenta.'],
  ['Aparta fecha y paga', 'Anticipo del 50 % o pago completo. La sala queda bloqueada 12 horas mientras decides.'],
  ['Entra con tu QR', 'Recibes un boleto con código QR. El personal lo escanea en la puerta; no imprimes nada.']
];

const FEATURES = [
  [IcUsers, 'Tu banda, organizada', 'Roles, calendario compartido, setlist, rider y archivos en un solo lugar.', '/registro', 'Crear mi banda'],
  [IcWallet, 'Pagos divididos', 'Reparte el costo entre integrantes, usa tu cartera interna y revisa el historial.', '/registro', 'Ver cómo funciona'],
  [IcMic, 'Ingenieros de audio', 'Compara perfiles, escucha portafolios sin descargar y envía tu demo antes de reservar.', '/ingenieros', 'Ver ingenieros'],
  [IcTicket, 'Eventos y boletos', 'Postula a carteles, vende boletos y valida la entrada con el QR.', '/eventos', 'Ver eventos'],
  [IcMusic, 'Entregables de grabación', 'Escucha versiones, comenta por minuto y aprueba tu master.', '/registro', 'Crear mi banda'],
  [IcContract, 'Contratos claros', 'Términos y coproducciones con reparto de regalías firmado por cada integrante.', '/registro', 'Crear mi banda']
];

function RoomRow({ room, index, onReserve }) {
  return (
    <Reveal as="article" className="room-row" delay={index * 40}>
      <Link to={`/cotizar/${room.id}`} className="gs-photo room-media" aria-label={`Cotizar ${room.name}`} style={{ display: 'block' }}><img src={room.imagePath} alt={`Fotografía de ${room.name}`} loading="lazy" /></Link>
      <div className="room-main">
        <span className="room-num">{String(index + 1).padStart(2, '0')}</span>
        <h3>{room.name}</h3>
        <p className="gs-hint">{room.blurb}</p>
        <div className="gs-row"><span className="gs-badge">Hasta {room.capacity} integrantes</span>{room.customizable && <span className="gs-badge gs-badge--violet">Sala 3D</span>}</div>
      </div>
      <div className="room-side">
        <div className="gs-price">{mxn(room.price)}<small> / hora</small></div>
        <div className="gs-row">
          <button className="gs-btn gs-btn--primary gs-btn--sm" onClick={() => onReserve(room)}>Reservar <IcArrowRight size={16} className="gs-arrow" /></button>
          <Link to={`/cotizar/${room.id}`} className="gs-btn gs-btn--sm">Cotizar</Link>
        </div>
      </div>
    </Reveal>
  );
}

export default function Home() {
  const catalog = useAsync(loadCatalog, []);
  const band = bandActor(useSessions());
  const rooms = catalog.data?.rooms || [];
  const minPrice = rooms.length ? Math.min(...rooms.map((room) => room.price)) : null;
  const reserve = (room) => navigate(band ? `/reservar/${room.id}` : `/registro?next=${encodeURIComponent(`/reservar/${room.id}`)}`);
  useEffect(() => { document.title = 'GrooveSpace · Salas de ensayo y grabación en CDMX'; }, []);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="gs-eyebrow">Salas de ensayo y grabación · CDMX</p>
          <h1 id="hero-title" className="gs-display">Reserva tu sala <em>en minutos.</em></h1>
          <p className="gs-lead">Elige sala, arma tu sesión con el precio a la vista, aparta con el 50 % y entra con un código QR. Sin llamadas ni mensajes de ida y vuelta.</p>
          <div className="hero-actions">
            <Link to="/#catalogo" className="gs-btn gs-btn--primary">Ver salas y precios <IcArrowRight size={18} className="gs-arrow" /></Link>
            <Link to="/eventos" className="gs-btn"><IcCalendar size={18} /> Próximos eventos</Link>
          </div>
          <dl className="hero-facts">
            <div><dt>Salas</dt><dd>{rooms.length ? `${rooms.length} disponibles` : '—'}</dd></div>
            <div><dt>Desde</dt><dd>{minPrice ? `${mxn(minPrice)} / hora` : '—'}</dd></div>
            <div><dt>Anticipo</dt><dd>50 %</dd></div>
            <div><dt>Acceso</dt><dd>Código QR</dd></div>
          </dl>
        </div>
        <Photo className="hero-media" src="/header-image.webp" alt="Sala de ensayo de GrooveSpace con instrumentos y consola" style={{ position: 'relative' }} />
      </section>

      <div className="gs-wrap">
        <section id="catalogo" className="gs-section" aria-labelledby="t-salas" style={{ borderTop: 0 }}>
          <SectionHead n={1} label="Salas" title={<span id="t-salas">Elige dónde van a sonar</span>} aside="“Reservar” va directo a fecha y pago. “Cotizar” arma tu sesión sin crear cuenta y te muestra el total en vivo." />
          {catalog.loading ? <Skeleton rows={3} /> : catalog.error ? <ErrorNote error={catalog.error} /> : <div className="room-list">{rooms.map((room, index) => <RoomRow key={room.id} room={room} index={index} onReserve={reserve} />)}</div>}
        </section>

        <section className="gs-section" aria-labelledby="t-pasos">
          <SectionHead n={2} label="Cómo funciona" title={<span id="t-pasos">De la cotización a la puerta, en cuatro pasos</span>} />
          <div className="gs-cols">
            <ol className="step-list c-7">{STEPS.map(([title, text]) => <li key={title}><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol>
            <Placeholder className="c-4 s-9" ratio="4 / 5" label="Banda ensayando en sala · vertical 4:5" />
          </div>
          <div style={{ marginTop: 'var(--s-4)' }}><Link to="/#catalogo" className="gs-btn gs-btn--primary">Empezar mi cotización <IcArrowRight size={18} className="gs-arrow" /></Link></div>
        </section>

        <section className="gs-section" aria-labelledby="t-plataforma">
          <SectionHead n={3} label="Plataforma" title={<span id="t-plataforma">Todo lo que tu banda necesita después de reservar</span>} />
          <ul className="feature-list">
            {FEATURES.map(([Icon, title, text, to, cta]) => (
              <li key={title}><Link to={to} className="feature-row"><span className="f-title"><Icon size={22} />{title}</span><p className="f-text">{text}</p><span className="f-go">{cta} <IcArrowRight size={16} className="gs-arrow" /></span></Link></li>
            ))}
          </ul>
        </section>

        <section className="gs-section" aria-labelledby="t-datos">
          <SectionHead n={4} label="En cifras" title={<span id="t-datos">Reglas claras, sin cargos ocultos</span>} />
          <div className="data-strip">
            <div><strong>{rooms.length || '—'}</strong><span>salas para ensayo y grabación</span></div>
            <div><strong>50 %</strong><span>de anticipo; el saldo hasta 24 h antes</span></div>
            <div><strong>12 h</strong><span>de bloqueo mientras completas tu pago</span></div>
            <div><strong>QR</strong><span>para entrar, sin imprimir nada</span></div>
          </div>
          <div className="gs-cols" style={{ marginTop: 'var(--s-5)' }}>
            <Placeholder className="c-7" ratio="21 / 9" label="Testimonio de una banda · sustituir por contenido real" />
          </div>
        </section>
      </div>

      <section className="cta-band" aria-labelledby="t-cierre">
        <div className="gs-wrap gs-cols">
          <div className="c-6">
            <p className="gs-eyebrow">Reserva</p>
            <h2 id="t-cierre" className="gs-section-title" style={{ margin: '16px 0 var(--s-3)' }}>¿Ya tienes fecha de ensayo?</h2>
            <p style={{ fontSize: '1.125rem', maxWidth: '40ch' }}>Aparta tu sala hoy y recibe tu boleto con QR en cuanto pagues el anticipo.</p>
            <div className="hero-actions" style={{ marginTop: 'var(--s-3)' }}>
              <Link to="/#catalogo" className="gs-btn gs-btn--ink">Reservar sala <IcArrowRight size={18} className="gs-arrow" /></Link>
              <Link to="/registro" className="gs-btn">Registrar mi banda</Link>
            </div>
          </div>
          <dl className="contact-list c-5" style={{ gridColumnStart: 8 }}>
            <div><dt><IcMail size={14} /> Correo</dt><dd>{SITE.email}</dd></div>
            <div><dt><IcPhone size={14} /> Teléfono</dt><dd>{SITE.phone}</dd></div>
            <div><dt><IcPin size={14} /> Dirección</dt><dd>{SITE.address}</dd></div>
            <div><dt><IcClock size={14} /> Horario</dt><dd>{SITE.hours}{SITE.placeholder && <small>Datos de ejemplo: reemplazar en src/lib/site.js</small>}</dd></div>
          </dl>
        </div>
      </section>
    </>
  );
}
