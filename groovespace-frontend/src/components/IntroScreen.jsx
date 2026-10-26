import { FaArrowRight, FaGuitar } from 'react-icons/fa';
import './IntroScreen.css';

export default function IntroScreen({ onEnter }) {
  return (
    <main className="music-intro" aria-label="Bienvenida a GrooveSpace">
      <div className="intro-light intro-light-one" />
      <div className="intro-light intro-light-two" />
      <div className="music-equalizer" aria-hidden="true">
        {Array.from({ length: 28 }, (_, index) => (
          <span
            key={index}
            style={{
              height: `${14 + (index % 5) * 5}%`,
              animationDelay: `${index * -0.09}s`,
              animationDuration: `${0.7 + (index % 6) * 0.13}s`
            }}
          />
        ))}
      </div>
      <div className="intro-content">
        <div className="intro-mark"><FaGuitar aria-hidden="true" /></div>
        <p className="intro-eyebrow">El escenario es tuyo</p>
        <h1>GrooveSpace</h1>
        <p className="intro-copy">Encuentra tu sonido. Haz espacio para crear.</p>
        <button className="intro-enter-button" type="button" onClick={onEnter}>
          Entrar al estudio <FaArrowRight aria-hidden="true" />
        </button>
        <span className="intro-caption">Estudios profesionales · Ciudad de México</span>
      </div>
      <div className="intro-notes" aria-hidden="true">
        <span>♪</span><span>♫</span><span>♬</span><span>♪</span>
      </div>
    </main>
  );
}
