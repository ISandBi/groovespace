import { IcArrowRight, IcAudio } from '../ui/icons.jsx';
import './IntroScreen.css';

/** Pantalla de entrada: una sola acción, texto alineado a la izquierda y una barra de ecualizador discreta. */
export default function IntroScreen({ onEnter }) {
  return (
    <main className="music-intro" aria-label="Bienvenida a GrooveSpace">
      <div className="intro-content">
        <span className="intro-mark"><IcAudio size={22} /></span>
        <p className="intro-eyebrow">Salas de ensayo y grabación · CDMX</p>
        <h1>GrooveSpace</h1>
        <p className="intro-copy">Reserva tu sala, paga el anticipo y entra con un código QR.</p>
        <button className="intro-enter-button" type="button" onClick={onEnter} autoFocus>
          Entrar al estudio <IcArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="music-equalizer" aria-hidden="true">
        {Array.from({ length: 48 }, (_, index) => (
          <span key={index} style={{ height: `${14 + ((index * 37) % 70)}%`, animationDelay: `${index * -0.11}s`, animationDuration: `${1.1 + (index % 5) * 0.23}s` }} />
        ))}
      </div>
    </main>
  );
}
