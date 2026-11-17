import { useCallback, useEffect, useRef, useState } from 'react';
import { IcCamera, IcCheckCircle, IcQr, IcXCircle } from '../ui/icons.jsx';
import { api, mxn } from '../lib/http';
import { toast } from '../ui/kit.jsx';
import './QrScanner.css';

const CODE = /^(GS|GE)-[A-F\d]{16}$/;
// Decodificador de respaldo (jsQR): igual que en DeskFlex, se usa cuando el navegador no trae BarcodeDetector
// (Chrome/Edge en Windows y Firefox no lo tienen). Se busca primero en /vendor y luego en varios CDN.
const JSQR_SOURCES = ['/vendor/jsQR.js', 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js', 'https://unpkg.com/jsqr@1.4.0/dist/jsQR.js', 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js'];
const loadScript = (src) => new Promise((resolve, reject) => { const tag = document.createElement('script'); tag.src = src; tag.onload = resolve; tag.onerror = () => { tag.remove(); reject(new Error(src)); }; document.head.appendChild(tag); });
const loadJsQr = async () => {
  if (window.jsQR) return window.jsQR;
  for (const src of JSQR_SOURCES) { try { await loadScript(src); if (window.jsQR) return window.jsQR; } catch { /* siguiente fuente */ } }
  return null;
};
// Devuelve una función que lee un cuadro del video y regresa el texto del QR (o null).
const makeDecoder = async (video) => {
  if ('BarcodeDetector' in window) {
    try {
      if ((await window.BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async () => (await detector.detect(video))[0]?.rawValue || null;
      }
    } catch { /* usa jsQR */ }
  }
  const jsQR = await loadJsQr();
  if (!jsQR) return null;
  const canvas = document.createElement('canvas'); const context = canvas.getContext('2d', { willReadFrequently: true });
  return async () => {
    const width = video.videoWidth; if (!width) return null;
    const k = Math.min(1, 720 / width); canvas.width = Math.round(width * k); canvas.height = Math.round(video.videoHeight * k);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data || null;
  };
};
const cameraError = (error) => {
  if (!window.isSecureContext || !navigator.mediaDevices) return 'El navegador sólo permite la cámara en https:// o en http://localhost. Abre el sistema con esa dirección.';
  switch (error?.name) {
    case 'NotAllowedError': case 'SecurityError': return 'El permiso de cámara está bloqueado. Pulsa el candado junto a la dirección, permite la cámara y vuelve a intentar.';
    case 'NotFoundError': case 'OverconstrainedError': return 'No se detectó ninguna cámara en este equipo.';
    case 'NotReadableError': case 'AbortError': return 'La cámara está en uso por otra aplicación (Zoom, Teams, otra pestaña). Ciérrala e inténtalo de nuevo.';
    default: return `No se pudo abrir la cámara (${error?.name || 'error'}). Escribe el código mientras tanto.`;
  }
};

const clean = (raw) => String(raw || '').trim().toUpperCase().replace(/^GROOVESPACE:/, '');

/** Lector de QR para recepción: cámara (BarcodeDetector o jsQR) o código escrito / lector USB. Soporta boletos de sesión (GS-) y de evento (GE-). */
export default function QrScanner({ token, onChange }) {
  const video = useRef(null);
  const stream = useRef(null);
  const busyRef = useRef(false);
  const lastCode = useRef('');
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [cameras, setCameras] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [starting, setStarting] = useState(false);
  const supported = true; // siempre se intenta abrir la cámara; si falla se explica el motivo

  const lookup = useCallback(async (raw) => {
    const code = clean(raw);
    if (!CODE.test(code)) { setResult({ verdict: 'bad', message: 'No es un boleto de GrooveSpace.' }); return; }
    busyRef.current = true; setError('');
    try {
      const data = await api(`/staff/checkin/${encodeURIComponent(code)}`, { token });
      setResult({ verdict: data.canEnter ? 'ok' : 'bad', ticket: data.ticket, message: data.canEnter ? (data.warning || 'Puede ingresar.') : data.reason });
      if (navigator.vibrate) navigator.vibrate(data.canEnter ? 60 : [80, 60, 80]);
    } catch (requestError) { setResult({ verdict: 'bad', message: requestError.message }); }
    finally { setTimeout(() => { busyRef.current = false; }, 1500); }
  }, [token]);

  const stop = useCallback(() => { stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; setActive(false); }, []);
  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!active) return undefined;
    let timer; let cancelled = false;
    (async () => {
      setStarting(true); setError('');
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('insecure'), { name: 'SecurityError' });
        const attempts = deviceId ? [{ video: { deviceId: { exact: deviceId } }, audio: false }]
          : [{ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false }, { video: true, audio: false }];
        let media = null; let lastError;
        for (const constraints of attempts) { try { media = await navigator.mediaDevices.getUserMedia(constraints); break; } catch (e) { lastError = e; if (e.name === 'NotAllowedError') break; } }
        if (!media) throw lastError;
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        stream.current = media; video.current.srcObject = media; await video.current.play();
        navigator.mediaDevices.enumerateDevices().then((list) => setCameras(list.filter((d) => d.kind === 'videoinput'))).catch(() => {});
        const decode = await makeDecoder(video.current);
        if (cancelled) return;
        if (!decode) { setError('La cámara funciona, pero no se pudo cargar el decodificador de QR (revisa tu internet). Escribe el código mientras tanto.'); return; }
        setStarting(false);
        const tick = async () => {
          if (cancelled) return;
          if (!busyRef.current && video.current?.readyState >= 2) {
            try { const text = await decode(); if (text && text !== lastCode.current) { lastCode.current = text; lookup(text); setTimeout(() => { lastCode.current = ''; }, 4000); } } catch { /* cuadro sin QR */ }
          }
          timer = setTimeout(tick, 150);
        };
        tick();
      } catch (e) { if (!cancelled) { setError(cameraError(e)); stop(); } }
      finally { setStarting(false); }
    })();
    return () => { cancelled = true; clearTimeout(timer); stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; };
  }, [active, deviceId, lookup, stop]);

  const confirm = async () => {
    try {
      const data = await api(`/staff/checkin/${encodeURIComponent(result.ticket.ticketCode)}`, { method: 'POST', token });
      toast(data.warning || 'Check-in registrado'); setResult({ verdict: 'ok', ticket: data.ticket, message: data.warning || 'Check-in registrado', done: true }); onChange?.();
    } catch (requestError) { setResult((current) => ({ ...current, verdict: 'bad', message: requestError.message })); }
  };

  const ticket = result?.ticket;
  return (
    <div className="qrs">
      <div>
        <div className={`qrs-view ${result?.verdict || ''}`}>
          <video ref={video} muted playsInline style={{ display: active ? 'block' : 'none' }} />
          {!active && <div className="qrs-idle"><IcQr size={54} color="var(--color-brand-primary)" /><b style={{ color: 'var(--color-text-title)' }}>Escáner de boletos</b><span>Activa la cámara y apunta al QR del boleto, o escribe el código / usa un lector USB.</span></div>}
          <div className="qrs-frame"><i /><i /><i /><i />{active && <span className="qrs-line" />}</div>
        </div>
        <div className="gs-row" style={{ justifyContent: 'center', marginTop: 16 }}>
          {supported && <button className="gs-btn gs-btn--primary" onClick={() => (active ? stop() : setActive(true))}><IcCamera /> {active ? 'Cerrar cámara' : starting ? 'Abriendo…' : 'Activar cámara'}</button>}
          {active && cameras.length > 1 && <select className="gs-input" style={{ maxWidth: 220 }} value={deviceId} onChange={(event) => setDeviceId(event.target.value)} aria-label="Cámara"><option value="">Cámara automática</option>{cameras.map((cam, index) => <option key={cam.deviceId} value={cam.deviceId}>{cam.label || `Cámara ${index + 1}`}</option>)}</select>}
        </div>
        <form className="gs-row" style={{ marginTop: 14, flexWrap: 'nowrap' }} onSubmit={(event) => { event.preventDefault(); lookup(manual); setManual(''); }}>
          <input className="gs-input" style={{ fontFamily: 'ui-monospace,monospace' }} value={manual} onChange={(event) => setManual(event.target.value)} placeholder="GS-0123456789ABCDEF o GE-…" aria-label="Código del boleto" autoComplete="off" />
          <button className="gs-btn" disabled={!manual.trim()}>Buscar</button>
        </form>
        {error && <p className="gs-error">{error}</p>}
      </div>

      <div>
        {!result ? <div className="gs-empty">El resultado aparece aquí. Los boletos de bandas (GS-) y de eventos (GE-) se validan por igual.</div> : (
          <div className={`qrs-verdict ${result.verdict}`} role="status">
            <div className="gs-row">{result.verdict === 'ok' ? <IcCheckCircle size={30} color="var(--color-booking-available)" /> : <IcXCircle size={30} color="var(--color-state-error)" />}<h3>{result.done ? 'Check-in hecho' : result.verdict === 'ok' ? 'Boleto válido' : 'No puede ingresar'}</h3></div>
            <p style={{ color: 'var(--color-text-body)' }}>{result.message}</p>
            {ticket && (
              <div className="gs-list" style={{ margin: '12px 0' }}>
                <div className="gs-item"><span className="gs-hint">{ticket.kind === 'event' ? 'Asistente' : 'Banda'}</span><b>{ticket.bandName}</b></div>
                <div className="gs-item"><span className="gs-hint">{ticket.kind === 'event' ? 'Evento' : 'Sala'}</span><b>{ticket.roomName}</b></div>
                <div className="gs-item"><span className="gs-hint">Horario</span><b>{ticket.date} · {ticket.startTime}{ticket.duration ? ` · ${ticket.duration} h` : ''}</b></div>
                <div className="gs-item"><span className="gs-hint">Integrantes / boletos</span><b>{ticket.attendees}</b></div>
                {ticket.balanceAmount > 0 && <div className="gs-item"><span className="gs-hint">Saldo por cobrar</span><b style={{ color: 'var(--color-booking-maintenance)' }}>{mxn(ticket.balanceAmount)}</b></div>}
              </div>)}
            {result.verdict === 'ok' && !result.done && <button className="gs-btn gs-btn--primary gs-btn--block" onClick={confirm}>Confirmar ingreso</button>}
            <button className="gs-btn gs-btn--block" style={{ marginTop: 10 }} onClick={() => setResult(null)}>Siguiente boleto</button>
          </div>)}
      </div>
    </div>
  );
}
