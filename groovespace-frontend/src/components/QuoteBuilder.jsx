import { mxn } from '../lib/http';

const toggle = (list, id) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

/** Selector de sesión compartido por el cotizador y la reserva: todo cambio actualiza el panel de precio al instante. */
export function QuoteBuilder({ catalog, room, draft, setDraft }) {
  const update = (patch) => setDraft((current) => ({ ...current, ...patch }));
  const { limits } = catalog;
  const hours = Array.from({ length: limits.maxHours - limits.minHours + 1 }, (_, index) => limits.minHours + index);
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section className="gs-card">
        <h2 className="gs-h2"><span className="gs-mono" style={{ color: 'var(--color-brand-accent)', marginRight: 12 }}>01</span>Tu sesión</h2>
        <div className="gs-grid gs-grid--2" style={{ gap: 14 }}>
          <label className="gs-field"><span>Duración</span>
            <select value={draft.duration} onChange={(event) => update({ duration: Number(event.target.value) })}>{hours.map((value) => <option key={value} value={value}>{value} {value === 1 ? 'hora' : 'horas'}</option>)}</select>
          </label>
          <label className="gs-field"><span>Integrantes: <b style={{ color: 'var(--color-brand-primary)' }}>{draft.attendees}</b> (máx. {room.capacity})</span>
            <input type="range" min="1" max={room.capacity} value={Math.min(draft.attendees, room.capacity)} onChange={(event) => update({ attendees: Number(event.target.value) })} style={{ accentColor: 'var(--color-brand-primary)' }} />
          </label>
        </div>
      </section>

      <section className="gs-card">
        <h2 className="gs-h2"><span className="gs-mono" style={{ color: 'var(--color-brand-accent)', marginRight: 12 }}>02</span>Equipo en renta <small className="gs-hint">precio por hora</small></h2>
        <div className="gs-grid gs-grid--2" style={{ gap: 10 }}>
          {catalog.rentalGear.map((item) => (
            <label key={item.id} className={`gs-choice ${draft.gearIds.includes(item.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={draft.gearIds.includes(item.id)} onChange={() => update({ gearIds: toggle(draft.gearIds, item.id) })} />
              <div><b>{item.name}</b><small>+{mxn(item.price)} / h</small></div>
            </label>))}
        </div>
      </section>

      <section className="gs-card">
        <h2 className="gs-h2"><span className="gs-mono" style={{ color: 'var(--color-brand-accent)', marginRight: 12 }}>03</span>Servicios adicionales</h2>
        <div className="gs-grid gs-grid--2" style={{ gap: 10 }}>
          {catalog.extras.map((item) => (
            <label key={item.id} className={`gs-choice ${draft.extraIds.includes(item.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={draft.extraIds.includes(item.id)} onChange={() => update({ extraIds: toggle(draft.extraIds, item.id) })} />
              <div><b>{item.name}</b><small>{item.description} · {mxn(item.price)} {item.unit === 'hour' ? '/ h' : 'único'}</small></div>
            </label>))}
        </div>
      </section>

      <section className="gs-card">
        <h2 className="gs-h2"><span className="gs-mono" style={{ color: 'var(--color-brand-accent)', marginRight: 12 }}>04</span>Ingeniero de audio <small className="gs-hint">opcional</small></h2>
        <div className="gs-grid gs-grid--2" style={{ gap: 10 }}>
          <label className={`gs-choice ${!draft.engineerId ? 'on' : ''}`}><input type="radio" name="eng" checked={!draft.engineerId} onChange={() => update({ engineerId: '' })} /><div><b>Sin ingeniero</b><small>Sesión autogestionada</small></div></label>
          {catalog.engineers.map((engineer) => (
            <label key={engineer.id} className={`gs-choice ${draft.engineerId === engineer.id ? 'on' : ''}`}>
              <input type="radio" name="eng" checked={draft.engineerId === engineer.id} onChange={() => update({ engineerId: engineer.id })} />
              <div><b>{engineer.name}</b><small>{engineer.specialty} · {engineer.genres.join(', ')} · {mxn(engineer.hourlyRate)} / h</small></div>
            </label>))}
        </div>
      </section>
    </div>
  );
}

/** Panel lateral: se redibuja con cada ajuste. */
export function QuotePanel({ quote, room, children }) {
  if (!quote) return null;
  return (
    <aside className="gs-card gs-live-quote gs-sticky" aria-live="polite">
      <p className="gs-eyebrow">Cotización en vivo</p>
      <h3 className="gs-h3" style={{ margin: '8px 0 var(--s-2)' }}>{room.name}</h3>
      {quote.lines.map((line) => <div className="gs-quote-line" key={`${line.kind}-${line.id}`}><span>{line.label}<small>{line.detail}</small></span><b style={{ color: 'var(--color-text-title)' }}>{mxn(line.amount)}</b></div>)}
      <div className="gs-quote-total"><span className="gs-hint">Total de la sesión</span><strong key={quote.total}>{mxn(quote.total)}</strong></div>
      <div className="gs-split-pair">
        <div><span>Anticipo 50 %</span><b>{mxn(quote.deposit)}</b></div>
        <div><span>Saldo</span><b>{mxn(quote.balance)}</b></div>
      </div>
      <p className="gs-hint" style={{ marginTop: 10 }}>Paga todo ahora o aparta con el 50 %. El saldo se liquida hasta 24 h antes de tu sesión.</p>
      {children}
    </aside>
  );
}
