import { useEffect, useRef, useState } from 'react';
import { api, formatDateTime } from '../lib/http';
import { ErrorNote } from '../ui/kit.jsx';

/** Chat por sesión (banda ↔ ingeniero ↔ staff). Consulta nuevos mensajes cada 8 s mientras está abierto. */
export default function ChatBox({ reservationId, token, selfType }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const bottom = useRef(null);
  const last = useRef('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const fresh = await api(`/chat/${reservationId}${last.current ? `?after=${encodeURIComponent(last.current)}` : ''}`, { token });
        if (!alive || fresh.length === 0) return;
        last.current = fresh.at(-1).createdAt;
        setMessages((current) => [...current, ...fresh.filter((item) => !current.some((entry) => entry.id === item.id))]);
      } catch (requestError) { if (alive) setError(requestError.message); }
    };
    load();
    const timer = setInterval(load, 8000);
    return () => { alive = false; clearInterval(timer); };
  }, [reservationId, token]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const send = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    try { const message = await api(`/chat/${reservationId}`, { method: 'POST', token, body: { text } }); setText(''); last.current = message.createdAt; setMessages((current) => [...current, message]); }
    catch (requestError) { setError(requestError.message); }
  };

  return (
    <div>
      <div style={{ maxHeight: 340, overflow: 'auto', display: 'grid', gap: 8, padding: 4 }}>
        {messages.length === 0 && <p className="gs-hint">Aún no hay mensajes. Coordina aquí detalles de la sesión.</p>}
        {messages.map((message) => {
          const mine = message.senderType === selfType;
          return <div key={message.id} style={{ justifySelf: mine ? 'end' : 'start', maxWidth: '82%', padding: '9px 13px', borderRadius: 14, background: mine ? 'rgba(194,255,60,.16)' : 'rgba(255,255,255,.07)' }}><div className="gs-hint" style={{ fontSize: 11 }}>{message.senderName} · {formatDateTime(message.createdAt)}</div><div style={{ color: 'var(--color-text-title)', overflowWrap: 'anywhere' }}>{message.text}</div></div>;
        })}
        <div ref={bottom} />
      </div>
      <form className="gs-row" style={{ flexWrap: 'nowrap', marginTop: 10 }} onSubmit={send}><input className="gs-input" value={text} onChange={(event) => setText(event.target.value)} maxLength={1000} placeholder="Escribe un mensaje…" /><button className="gs-btn gs-btn--primary gs-btn--sm">Enviar</button></form>
      <ErrorNote error={error} />
    </div>
  );
}
