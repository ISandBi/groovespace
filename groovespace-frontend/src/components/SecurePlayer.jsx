import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { IcPause, IcPlay } from '../ui/icons.jsx';
import { formatClock } from '../lib/http';

/**
 * Reproductor sin botón de descarga. El enlace de streaming se pide al reproducir (caduca en minutos).
 * No puede impedir una grabación de pantalla: se apoya en acuerdo firmado, enlaces efímeros y bitácora.
 */
export default function SecurePlayer({ loadUrl, kind = 'audio', label, apiRef, onTimeUpdate, autoLoad = false }) {
  const media = useRef(null);
  const [src, setSrc] = useState('');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const ensure = async () => {
    if (src) return src;
    setBusy(true); setError('');
    try { const url = await loadUrl(); setSrc(url); return url; }
    catch (requestError) { setError(requestError.message); return ''; }
    finally { setBusy(false); }
  };
  const toggle = async () => {
    const url = await ensure();
    if (!url) return;
    requestAnimationFrame(() => { const node = media.current; if (!node) return; if (node.paused) node.play().catch(() => setError('No se pudo reproducir.')); else node.pause(); });
  };
  useImperativeHandle(apiRef, () => ({
    seek: async (seconds) => { await ensure(); requestAnimationFrame(() => { if (media.current) { media.current.currentTime = seconds; media.current.play().catch(() => {}); } }); },
    now: () => media.current?.currentTime || 0
  }));
  useEffect(() => { if (autoLoad) ensure(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const common = {
    ref: media, src: src || undefined, preload: 'metadata', controlsList: 'nodownload noremoteplayback', onContextMenu: (event) => event.preventDefault(),
    onPlay: () => setPlaying(true), onPause: () => setPlaying(false), onEnded: () => setPlaying(false),
    onLoadedMetadata: (event) => setDuration(event.currentTarget.duration || 0),
    onTimeUpdate: (event) => { setTime(event.currentTarget.currentTime); onTimeUpdate?.(event.currentTarget.currentTime); },
    onError: () => { if (src) { setSrc(''); setError('El enlace de reproducción expiró; vuelve a pulsar play.'); } }
  };

  return (
    <div className="gs-item" style={{ display: 'grid', gap: 10, width: '100%' }}>
      {kind === 'video' && <video {...common} disablePictureInPicture playsInline style={{ width: '100%', maxHeight: 360, borderRadius: 0, background: '#000' }} />}
      {kind !== 'video' && <audio {...common} />}
      <div className="gs-row" style={{ flexWrap: 'nowrap' }}>
        <button type="button" className="gs-btn gs-btn--sm gs-btn--primary" style={{ minWidth: 44 }} onClick={toggle} aria-label={playing ? 'Pausar' : 'Reproducir'} disabled={busy}>{playing ? <IcPause /> : <IcPlay />}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {label && <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--color-text-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>}
          <input type="range" min="0" max={duration || 0} step="0.1" value={time} aria-label="Posición" style={{ width: '100%', accentColor: 'var(--color-brand-primary)' }} onChange={(event) => { if (media.current) media.current.currentTime = Number(event.target.value); }} disabled={!src} />
        </div>
        <span className="gs-hint" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatClock(time)} / {formatClock(duration)}</span>
      </div>
      {error && <span className="gs-error" role="alert">{error}</span>}
    </div>
  );
}
