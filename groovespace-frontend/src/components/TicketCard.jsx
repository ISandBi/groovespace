import { useMemo, useRef } from 'react';
import { FaDownload, FaImage } from 'react-icons/fa';
import { makeQr, qrToSvgPath } from '../qr';
import { formatDate } from '../lib/http';
import './Ticket3D.css';

export const ticketPayload = (code) => `GROOVESPACE:${code}`;

export function TicketQR({ code, size = 200 }) {
  const { path, viewSize } = useMemo(() => qrToSvgPath(makeQr(ticketPayload(code))), [code]);
  return (
    <svg className="ticket-qr" width={size} height={size} viewBox={`0 0 ${viewSize} ${viewSize}`} role="img" aria-label={`Código QR del boleto ${code}`} shapeRendering="crispEdges">
      <rect width={viewSize} height={viewSize} fill="#fff" />
      <path d={path} fill="#111" />
    </svg>
  );
}

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** Boleto autónomo en SVG con el diseño GrooveSpace (se descarga como SVG o PNG). */
export const buildTicketSvg = ({ code, title, subtitle, details }) => {
  const { path, viewSize } = qrToSvgPath(makeQr(ticketPayload(code)));
  const scale = 150 / viewSize;
  const bars = Array.from({ length: 28 }, (_, index) => `<rect x="${30 + index * 17}" y="${300 - (14 + ((index * 7) % 5) * 9)}" width="10" height="${14 + ((index * 7) % 5) * 9}" rx="2" fill="#c2ff3c" opacity=".2"/>`).join('');
  const cells = details.slice(0, 6).map(([label, value], index) => `<text x="${34 + (index % 3) * 150}" y="${206 + Math.floor(index / 3) * 50}" font-size="10" font-weight="800" letter-spacing="2" fill="#b1a4bd">${esc(label).toUpperCase()}</text><text x="${34 + (index % 3) * 150}" y="${226 + Math.floor(index / 3) * 50}" font-size="17" font-weight="800" fill="#fff8ff">${esc(value)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="450" viewBox="0 0 720 300" font-family="Inter,Segoe UI,Arial,sans-serif"><defs><radialGradient id="g" cx="0" cy="0" r="1.3"><stop offset="0" stop-color="#2c2140"/><stop offset=".45" stop-color="#1d1725"/><stop offset="1" stop-color="#100d17"/></radialGradient></defs><rect width="720" height="300" rx="22" fill="url(#g)"/>${bars}<rect x="34" y="30" width="20" height="20" rx="6" fill="#c2ff3c"/><text x="44" y="45" font-size="13" font-weight="900" text-anchor="middle" fill="#100d17">♪</text><text x="64" y="45" font-size="12" font-weight="900" letter-spacing="3" fill="#c2ff3c">GROOVESPACE</text><text x="34" y="100" font-size="30" font-weight="800" fill="#fff8ff">${esc(title).slice(0, 34)}</text><text x="34" y="128" font-size="15" font-weight="800" fill="#ff5d8f">${esc(subtitle)}</text>${cells}<text x="34" y="285" font-size="12" letter-spacing="2" fill="#b1a4bd" font-family="monospace">${esc(code)}</text><line x1="510" y1="14" x2="510" y2="286" stroke="#fff" stroke-opacity=".18" stroke-dasharray="6 6" stroke-width="2"/><circle cx="510" cy="0" r="11" fill="#100d17"/><circle cx="510" cy="300" r="11" fill="#100d17"/><rect x="535" y="60" width="166" height="166" rx="12" fill="#fff"/><g transform="translate(543 68) scale(${scale})" shape-rendering="crispEdges"><path d="${path}" fill="#111"/></g><text x="618" y="252" font-size="10" text-anchor="middle" fill="#b1a4bd" letter-spacing="1">MUESTRA ESTE CÓDIGO EN RECEPCIÓN</text></svg>`;
};

const saveBlob = (blob, name) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };

/** Tarjeta 3D horizontal: se inclina con el puntero y un brillo recorre su superficie. */
export function Ticket3D({ code, title, subtitle, details, status, statusTone = 'ok' }) {
  const card = useRef(null);
  const frame = useRef(0);
  const { path, viewSize } = useMemo(() => qrToSvgPath(makeQr(ticketPayload(code))), [code]);
  const svgText = () => buildTicketSvg({ code, title, subtitle, details });

  const move = (event) => {
    const node = card.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      node.classList.add('is-active');
      node.style.setProperty('--ry', `${(x - 0.5) * 22}deg`);
      node.style.setProperty('--rx', `${(0.5 - y) * 16}deg`);
      node.style.setProperty('--mx', `${x * 100}%`);
      node.style.setProperty('--my', `${y * 100}%`);
      node.style.setProperty('--shine', '1');
    });
  };
  const leave = () => {
    const node = card.current;
    if (!node) return;
    cancelAnimationFrame(frame.current);
    node.classList.remove('is-active');
    ['--rx', '--ry'].forEach((key) => node.style.setProperty(key, '0deg'));
    node.style.setProperty('--shine', '0');
  };

  const downloadSvg = () => saveBlob(new Blob([svgText()], { type: 'image/svg+xml' }), `boleto-${code}.svg`);
  const downloadPng = () => {
    const url = URL.createObjectURL(new Blob([svgText()], { type: 'image/svg+xml' }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080; canvas.height = 450;
      canvas.getContext('2d').drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => blob && saveBlob(blob, `boleto-${code}.png`), 'image/png');
    };
    image.src = url;
  };

  return (
    <div>
      <div className="t3d-scene">
        <article ref={card} className="t3d" aria-label={`Boleto de acceso ${code}`} onPointerMove={move} onPointerLeave={leave} onPointerCancel={leave}>
          <div className="t3d-bars" aria-hidden="true">{Array.from({ length: 26 }, (_, index) => <i key={index} style={{ height: `${30 + ((index * 37) % 70)}%`, animationDelay: `${(index % 9) * 0.13}s` }} />)}</div>
          <div className="t3d-main">
            <div className="t3d-brand"><i>♪</i>GrooveSpace · Acceso</div>
            <h2 className="t3d-title">{title}</h2>
            {subtitle && <p className="t3d-sub">{subtitle}</p>}
            <dl className="t3d-details">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <div className="t3d-foot"><span className="t3d-code">{code}</span>{status && <span className={`gs-badge gs-badge--${statusTone}`}>{status}</span>}</div>
          </div>
          <div className="t3d-stub">
            <div className="t3d-qr"><svg viewBox={`0 0 ${viewSize} ${viewSize}`} role="img" aria-label={`Código QR ${code}`} shapeRendering="crispEdges"><rect width={viewSize} height={viewSize} fill="#fff" /><path d={path} fill="#111" /></svg></div>
            <small>Muestra este código en recepción</small>
          </div>
          <div className="t3d-holo" /><div className="t3d-shine" />
        </article>
      </div>
      <div className="t3d-actions">
        <button type="button" className="gs-btn gs-btn--sm" onClick={downloadPng}><FaImage /> Descargar PNG</button>
        <button type="button" className="gs-btn gs-btn--sm" onClick={downloadSvg}><FaDownload /> Descargar SVG</button>
      </div>
    </div>
  );
}

/** Boleto de una sesión de sala. */
export default function TicketCard({ reservation, bandName }) {
  if (!reservation?.ticketCode) return null;
  const checkedIn = Boolean(reservation.checkedInAt);
  const status = checkedIn ? 'Check-in realizado' : reservation.paymentStatus === 'paid' ? 'Pagado completo' : 'Anticipo pagado';
  const details = [['Fecha', formatDate(reservation.date)], ['Hora', reservation.startTime], ['Duración', `${reservation.duration} h`], ['Integrantes', String(reservation.attendees)]];
  return <Ticket3D code={reservation.ticketCode} title={reservation.roomName} subtitle={bandName} details={details} status={status} statusTone={checkedIn ? 'violet' : 'ok'} />;
}
