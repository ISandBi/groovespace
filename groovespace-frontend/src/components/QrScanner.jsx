import { useCallback, useEffect, useRef, useState } from 'react';
import { FaCamera, FaCheckCircle, FaQrcode, FaTimesCircle } from 'react-icons/fa';
import { api, mxn } from '../lib/http';
import { toast } from '../ui/kit.jsx';
import './QrScanner.css';

const CODE = /^(GS|GE)-[A-F\d]{16}$/;
const clean = (raw) => String(raw || '').trim().toUpperCase().replace(/^GROOVESPACE:/, '');

/** Lector de QR para recepción: cámara (BarcodeDetector) o código escrito / lector USB. Soporta boletos de sesión (GS-) y de evento (GE-). */
export default function QrScanner({ token, onChange }) {
  const video = useRef(null);
  const stream = useRef(null);
  const busyRef = useRef(false);
  const lastCode = useRef('');
  const [active, setActive] = useState(false);
  const [manual, setManual] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window && Boolean(navigator.mediaDevices?.getUserMedia);

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
      try {
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        stream.current = media; video.current.srcObject = media; await video.current.play();
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (cancelled) return;
          if (!busyRef.current && video.current?.readyState >= 2) {
            try { const found = await detector.detect(video.current); const text = found[0]?.rawValue; if (text && text !== lastCode.current) { lastCode.current = text; lookup(text); setTimeout(() => { lastCode.current = ''; }, 4000); } } catch { /* cuadro sin QR */ }
          }
          timer = setTimeout(tick, 220);
        };
        tick();
      } catch { setError('No se pudo abrir la cámara. Revisa el permiso o usa el código manual.'); setActive(false); }
    })();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [active, lookup]);

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
          {!active && <div className="qrs-idle"><FaQrcode size={54} color="var(--color-brand-primary)" /><b style={{ color: 'var(--color-text-title)' }}>Escáner de boletos</b><span>{supported ? 'Apunta la cámara al QR del boleto.' : 'Este navegador no lee QR con la cámara: escribe el código o usa un lector USB.'}</span></div>}
          <div className="qrs-frame"><i /><i /><i /><i />{active && <span className="qrs-line" />}</div>
        </div>
        <div className="gs-row" style={{ justifyContent: 'center', marginTop: 16 }}>
          {supported && <button className="gs-btn gs-btn--primary" onClick={() => (active ? stop() : setActive(true))}><FaCamera /> {active ? 'Cerrar cámara' : 'Activar cámara'}</button>}
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
            <div className="gs-row">{result.verdict === 'ok' ? <FaCheckCircle size={30} color="var(--color-booking-available)" /> : <FaTimesCircle size={30} color="var(--color-state-error)" />}<h3>{result.done ? 'Check-in hecho' : result.verdict === 'ok' ? 'Boleto válido' : 'No puede ingresar'}</h3></div>
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
