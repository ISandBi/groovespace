// InstrumentSounds.js
// Motor de sonido del "Modo tocar": SÓLO síntesis WebAudio (sin muestras ni archivos).
//
// Cómo se declara una zona sonora en un modelo 3D:
//   mesh.userData.sound = { voice: 'snare', note?: 60 | [60, 64, 67], index?: 0, label?: 'Caja', neck?: {...} }
//   - voice : nombre de la voz (ver VOICES al final del archivo).
//   - note  : nota MIDI (o arreglo = acorde/rasgueo). Las voces percusivas la usan como afinación.
//   - index : variante de la voz (hi-hat cerrado/abierto, conga abierta/slap, pad 0-7...).
//   - neck  : mapa de mástil. El punto tocado (en coordenadas locales del mesh) decide cuerda y traste.
//             { strings:[midi...], nut, scale, dir?, frets?, axis?, cross?, center?, width?, flip? }
//
// El AudioContext se crea de forma perezosa en el primer gesto del usuario (unlock/play).

const ENV = 0.0001; // "silencio" para rampas exponenciales (no admiten 0)

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

const NOTE_NAMES = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
export const noteName = (midi) => `${NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12]}${Math.floor(Math.round(midi) / 12) - 1}`;

// Convierte un punto local sobre el mástil en { midi, string, fret }.
export const resolveNeckNote = (neck, point) => {
  const pick = (axis) => (axis === 'x' ? point.x : axis === 'z' ? point.z : point.y);
  const along = pick(neck.axis || 'y');
  const across = pick(neck.cross || 'x');
  const distance = Math.max(0, (along - neck.nut) * (neck.dir ?? 1));
  const ratio = clamp(distance / neck.scale, 0, 0.985);
  // Posición de trastes en temperamento igual: d = L * (1 - 2^(-n/12))
  const fret = clamp(Math.ceil(-12 * Math.log2(1 - ratio) - 1e-6), 0, neck.frets ?? 20);
  const count = neck.strings.length;
  const t = clamp((across - ((neck.center ?? 0) - neck.width / 2)) / neck.width, 0, 1);
  let string = clamp(Math.round(t * (count - 1)), 0, count - 1);
  if (neck.flip) string = count - 1 - string;
  return { midi: neck.strings[string] + fret, string, fret };
};

// Notas por omisión cuando la zona no declara `note`.
const DEFAULT_NOTE = {
  tom: 45, timpani: 43, conga: 52, bongo: 62, speaker: 36,
  'gtr-electric': 52, 'gtr-acoustic': 52, 'gtr-nylon': 52, bass: 40, banjo: 62, ukulele: 69, mandolin: 67, harp: 60,
  violin: 69, viola: 62, cello: 50, contrabass: 40,
  piano: 60, organ: 60, synth: 60, accordion: 57,
  trumpet: 70, trombone: 58, tuba: 41, horn: 60, sax: 62, clarinet: 65, flute: 74, oboe: 70, bassoon: 46, harmonica: 72,
  xylophone: 72, marimba: 60, vibraphone: 65
};

// Karplus-Strong: parámetros por timbre (b = amortiguación de agudos, t60 = sustain, pick = posición de la púa).
const PLUCK = {
  steel: { b: 0.36, t60: 3.2, pick: 0.18, soft: 0.1, dur: 3.0, gain: 0.8, send: 0.18, eq: [['peaking', 110, 1, 5], ['peaking', 2400, 1, 3]] },
  nylon: { b: 0.46, t60: 2.6, pick: 0.22, soft: 0.55, dur: 2.6, gain: 0.9, send: 0.2, eq: [['lowpass', 3400, 0.7]] },
  electric: { b: 0.34, t60: 3.4, pick: 0.15, soft: 0.2, dur: 3.2, gain: 0.8, send: 0.12, eq: [['highpass', 80, 0.7], ['lowpass', 5200, 0.7]] },
  bass: { b: 0.48, t60: 3.6, pick: 0.3, soft: 0.7, dur: 3.2, gain: 1.1, send: 0.05, eq: [['lowpass', 2200, 0.7], ['peaking', 90, 1, 4]] },
  banjo: { b: 0.22, t60: 1.1, pick: 0.12, soft: 0, dur: 1.4, gain: 0.7, send: 0.12, eq: [['highpass', 200, 0.7], ['peaking', 1800, 1.5, 7]] },
  ukulele: { b: 0.44, t60: 1.5, pick: 0.2, soft: 0.45, dur: 1.6, gain: 0.95, send: 0.15, eq: [['highpass', 180, 0.7], ['peaking', 900, 1, 3]] },
  mandolin: { b: 0.3, t60: 1.3, pick: 0.14, soft: 0.1, dur: 1.5, gain: 0.75, send: 0.15, eq: [['highpass', 200, 0.7], ['peaking', 2500, 1.2, 4]] },
  harp: { b: 0.4, t60: 3.6, pick: 0.3, soft: 0.65, dur: 3.4, gain: 0.95, send: 0.3, eq: [['lowpass', 6000, 0.7]] }
};
const PLUCK_VOICE = {
  'gtr-electric': 'electric', 'gtr-acoustic': 'steel', 'gtr-nylon': 'nylon', bass: 'bass',
  banjo: 'banjo', ukulele: 'ukulele', mandolin: 'mandolin', harp: 'harp'
};

// Instrumentos de arco: cuerdas de referencia, resonancias del cuerpo y vibrato.
const BOWED = {
  violin: { body: [[300, 5], [2800, 6]], lp: 7000, vib: 14, rate: 5.8, a: 0.09, sub: 0 },
  viola: { body: [[250, 5], [2200, 5]], lp: 5500, vib: 14, rate: 5.4, a: 0.11, sub: 0 },
  cello: { body: [[110, 6], [1400, 5]], lp: 3600, vib: 16, rate: 5.0, a: 0.14, sub: 0.25 },
  contrabass: { body: [[70, 6], [800, 4]], lp: 1800, vib: 12, rate: 4.6, a: 0.18, sub: 0.4 }
};

// Vientos: ondas de la lengüeta/labios, barrido del filtro, formante y soplo.
const WIND = {
  trumpet: { waves: [['sawtooth', 1, 0.7, 0], ['square', 1, 0.25, 4]], cutoff: [700, 4200], q: 1.5, a: 0.03, r: 0.18, gain: 0.5, breath: 0.05, breathF: 5000, formant: 1200, vib: 6 },
  trombone: { waves: [['sawtooth', 1, 0.8, 0], ['square', 1, 0.2, -4]], cutoff: [350, 2200], q: 1.2, a: 0.06, r: 0.2, gain: 0.55, breath: 0.05, breathF: 3500, formant: 600, vib: 5 },
  tuba: { waves: [['sawtooth', 1, 0.5, 0], ['sine', 1, 0.7, 0]], cutoff: [200, 900], q: 1, a: 0.08, r: 0.25, gain: 0.75, breath: 0.04, breathF: 1200, formant: 250, vib: 3 },
  horn: { waves: [['sawtooth', 1, 0.55, 0], ['sine', 1, 0.5, 3]], cutoff: [350, 1500], q: 0.9, a: 0.07, r: 0.25, gain: 0.6, breath: 0.04, breathF: 2000, formant: 500, vib: 4 },
  sax: { waves: [['sawtooth', 1, 0.6, 0], ['square', 1, 0.3, 5], ['sine', 2, 0.1, 0]], cutoff: [900, 3000], q: 2, a: 0.05, r: 0.2, gain: 0.5, breath: 0.1, breathF: 3000, formant: 1100, vib: 7 },
  clarinet: { waves: [['square', 1, 0.7, 0], ['sine', 3, 0.15, 0]], cutoff: [1500, 2600], q: 1, a: 0.04, r: 0.15, gain: 0.5, breath: 0.07, breathF: 3500, formant: 1500, vib: 4 },
  flute: { waves: [['sine', 1, 0.9, 0], ['sine', 2, 0.12, 0]], cutoff: [4000, 6000], q: 0.7, a: 0.06, r: 0.15, gain: 0.55, breath: 0.2, breathF: 3200, formant: 2500, vib: 5 },
  oboe: { waves: [['sawtooth', 1, 0.7, 0], ['sine', 2, 0.2, 0]], cutoff: [1600, 3500], q: 3, a: 0.05, r: 0.15, gain: 0.45, breath: 0.06, breathF: 3000, formant: 1400, vib: 5 },
  bassoon: { waves: [['sawtooth', 1, 0.8, 0], ['square', 1, 0.15, 3]], cutoff: [500, 1400], q: 2, a: 0.06, r: 0.18, gain: 0.6, breath: 0.05, breathF: 1500, formant: 500, vib: 4 },
  harmonica: { waves: [['sawtooth', 1, 0.5, -6], ['sawtooth', 1, 0.5, 6]], cutoff: [1800, 3200], q: 1.5, a: 0.04, r: 0.12, gain: 0.45, breath: 0.1, breathF: 4000, formant: 2000, vib: 5 }
};

// Barras de percusión melódica: [razón parcial, amplitud, caída en segundos].
const MALLET = {
  xylophone: { partials: [[1, 1, 0.5], [3, 0.4, 0.18], [6, 0.2, 0.1]], tremolo: 0 },
  marimba: { partials: [[1, 1, 1.3], [4, 0.45, 0.45], [9.9, 0.12, 0.15]], tremolo: 0 },
  vibraphone: { partials: [[1, 1, 3.5], [4, 0.25, 1.6], [10, 0.1, 0.6]], tremolo: 0.25 }
};

const METAL = [263, 400, 421, 474, 587, 845]; // razones inarmónicas estilo caja de ritmos / platillo

export const createSoundEngine = () => {
  let ctx = null;
  let bus = null;
  let verbIn = null;
  let master = null;
  let noiseBuffer = null;
  let volume = 0.8;
  let muted = false;
  let active = 0;
  let ampStep = 0;
  const state = { pan: 0 };
  const bufferCache = new Map();
  const curveCache = new Map();

  // ---------- Construcción del contexto y la cadena maestra ----------
  const ensure = () => {
    if (ctx) {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
      return ctx;
    }
    const Ctor = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
    if (!Ctor) return null;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      ctx = null;
      return null;
    }
    // bus (dry) y reverberación -> compresor -> limitador -> volumen -> salida
    bus = ctx.createGain();
    bus.gain.value = 0.8;
    verbIn = ctx.createGain();
    const convolver = ctx.createConvolver();
    const length = Math.floor(ctx.sampleRate * 1.8);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.5;
    }
    convolver.buffer = impulse;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 18;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.2;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.06;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume ** 1.5;
    bus.connect(compressor);
    verbIn.connect(convolver);
    convolver.connect(wet);
    wet.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(master);
    master.connect(ctx.destination);
    // Ruido blanco compartido (1 s) para percusión y soplo.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i += 1) noise[i] = Math.random() * 2 - 1;
    return ctx;
  };

  const applyVolume = () => {
    if (!ctx || !master) return;
    master.gain.setTargetAtTime(muted ? 0 : volume ** 1.5, ctx.currentTime, 0.02);
  };

  // ---------- Utilidades de nodos ----------
  const gainNode = (value = 0) => {
    const node = ctx.createGain();
    node.gain.value = value;
    return node;
  };
  const filt = (type, frequency, q = 0.7, gain) => {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    if (gain !== undefined) node.gain.value = gain;
    return node;
  };
  const osc = (type, frequency, t0, t1, detune = 0) => {
    const node = ctx.createOscillator();
    node.type = type;
    node.frequency.setValueAtTime(frequency, t0);
    if (detune) node.detune.value = detune;
    node.start(t0);
    node.stop(t1);
    return node;
  };
  const noiseSource = (t0, t1) => {
    const node = ctx.createBufferSource();
    node.buffer = noiseBuffer;
    node.loop = true;
    node.start(t0, Math.random() * 0.5);
    node.stop(t1);
    return node;
  };
  // Envolvente percusiva: ataque lineal corto y caída exponencial de `length` segundos.
  const perc = (param, t0, peak, length, attack = 0.002) => {
    param.setValueAtTime(ENV, t0);
    param.linearRampToValueAtTime(Math.max(peak, ENV * 2), t0 + attack);
    param.exponentialRampToValueAtTime(ENV, t0 + attack + length);
  };
  // Envolvente sostenida con duración fija.
  const adsr = (param, t0, peak, attack, decay, sustain, hold, release) => {
    const safeHold = Math.max(hold, attack + decay + 0.03);
    const level = Math.max(peak * sustain, ENV * 2);
    param.setValueAtTime(ENV, t0);
    param.linearRampToValueAtTime(Math.max(peak, ENV * 2), t0 + attack);
    param.linearRampToValueAtTime(level, t0 + attack + decay);
    param.setValueAtTime(level, t0 + safeHold);
    param.exponentialRampToValueAtTime(ENV, t0 + safeHold + release);
    return safeHold + release;
  };
  const driveCurve = (k) => {
    if (curveCache.has(k)) return curveCache.get(k);
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i += 1) curve[i] = Math.tanh(((i * 2) / (curve.length - 1) - 1) * k);
    curveCache.set(k, curve);
    return curve;
  };
  // Salida: paneo opcional + envío a la reverberación.
  const route = (node, send = 0.12) => {
    let tail = node;
    if (state.pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = clamp(state.pan, -0.8, 0.8);
      node.connect(panner);
      tail = panner;
    }
    tail.connect(bus);
    if (send > 0) {
      const sendGain = gainNode(send);
      tail.connect(sendGain);
      sendGain.connect(verbIn);
    }
  };
  const hitNoise = (t0, type, frequency, q, peak, length, send = 0.1) => {
    const source = noiseSource(t0, t0 + length + 0.08);
    const filter = filt(type, frequency, q);
    const gain = gainNode(0);
    perc(gain.gain, t0, peak, length);
    source.connect(filter);
    filter.connect(gain);
    route(gain, send);
  };
  const sine = (t0, f0, f1, sweep, peak, length, type = 'sine', send = 0.08) => {
    const node = osc(type, f0, t0, t0 + length + 0.1);
    if (f1 !== f0) node.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t0 + sweep);
    const gain = gainNode(0);
    perc(gain.gain, t0, peak, length);
    node.connect(gain);
    route(gain, send);
  };
  // Suma de cuadradas inarmónicas filtradas: base de platillos, hi-hat, cencerro.
  const metal = (t0, mult, type, frequency, q, peak, length, send = 0.15) => {
    const filter = filt(type, frequency, q);
    const gain = gainNode(0);
    perc(gain.gain, t0, peak, length);
    METAL.forEach((f) => {
      const node = osc('square', f * mult, t0, t0 + length + 0.1);
      const level = gainNode(0.16);
      node.connect(level);
      level.connect(filter);
    });
    filter.connect(gain);
    route(gain, send);
  };
  const partial = (t0, freq, peak, length, type = 'sine', send = 0.1) => {
    const node = osc(type, freq, t0, t0 + length + 0.1);
    const gain = gainNode(0);
    perc(gain.gain, t0, peak, length);
    node.connect(gain);
    route(gain, send);
  };

  // ---------- Karplus-Strong (cuerda pulsada) ----------
  const ksBuffer = (freq, cfg, key) => {
    const sr = ctx.sampleRate;
    const id = `${key}|${Math.round(freq * 10)}|${sr}`;
    const cached = bufferCache.get(id);
    if (cached) {
      bufferCache.delete(id);
      bufferCache.set(id, cached); // LRU
      return cached;
    }
    const b = cfg.b;
    const D = sr / freq - b; // retardo del lazo (el filtro de promedio aporta ~b muestras)
    const length = Math.floor(sr * cfg.dur);
    const buffer = ctx.createBuffer(1, length, sr);
    const out = buffer.getChannelData(0);
    const L = Math.ceil(D) + 2;
    let previous = 0;
    let mean = 0;
    for (let n = 0; n < L; n += 1) {
      let x = Math.random() * 2 - 1;
      x = previous + (x - previous) * (1 - cfg.soft); // púa suave = excitación filtrada
      previous = x;
      out[n] = x;
      mean += x;
    }
    mean /= L;
    for (let n = 0; n < L; n += 1) out[n] -= mean;
    const k = Math.max(1, Math.round(cfg.pick * D)); // posición de la púa: peine
    for (let n = L - 1; n >= k; n -= 1) out[n] -= out[n - k];
    const t60 = cfg.t60 * clamp((220 / freq) ** 0.35, 0.5, 1.8);
    const loss = 10 ** ((-3 * D) / (sr * t60));
    for (let n = L; n < length; n += 1) {
      const p = n - D;
      const i = Math.floor(p);
      const fr = p - i;
      const x1 = out[i] * (1 - fr) + out[i + 1] * fr;
      const x2 = out[i - 1] * (1 - fr) + out[i] * fr;
      out[n] = loss * ((1 - b) * x1 + b * x2);
    }
    let peak = 0;
    for (let n = 0; n < Math.min(length, 6000); n += 1) peak = Math.max(peak, Math.abs(out[n]));
    const scale = peak > 0 ? 0.9 / peak : 1;
    const fade = Math.min(1500, length);
    for (let n = 0; n < length; n += 1) {
      out[n] *= scale;
      if (n > length - fade) out[n] *= (length - n) / fade;
    }
    bufferCache.set(id, buffer);
    if (bufferCache.size > 60) bufferCache.delete(bufferCache.keys().next().value);
    return buffer;
  };

  const playPluck = (key, note, t0, vel, post) => {
    const cfg = PLUCK[key];
    const freq = clamp(midiToHz(note), 38, 2400);
    const source = ctx.createBufferSource();
    source.buffer = ksBuffer(freq, cfg, key);
    const gain = gainNode(clamp(vel, 0.05, 1) * cfg.gain);
    let tail = source;
    cfg.eq.forEach(([type, frequency, q, g]) => {
      const filter = filt(type, frequency, q, g);
      tail.connect(filter);
      tail = filter;
    });
    if (post) tail = post(tail) || tail;
    tail.connect(gain);
    route(gain, cfg.send);
    source.start(t0);
    source.stop(t0 + cfg.dur + 0.05);
    return cfg.dur;
  };
  // Saturación tipo amplificador: preamplificador -> tanh -> medios -> bocina.
  const ampChain = (drive, cutoff, level) => (node) => {
    const pre = gainNode(drive);
    const shaper = ctx.createWaveShaper();
    shaper.curve = driveCurve(8);
    shaper.oversample = '4x';
    const mid = filt('peaking', 900, 1, 5);
    const speaker = filt('lowpass', cutoff, 0.8);
    const post = gainNode(level);
    node.connect(pre);
    pre.connect(shaper);
    shaper.connect(mid);
    mid.connect(speaker);
    speaker.connect(post);
    return post;
  };

  // ---------- Voces sostenidas ----------
  const bow = (cfg, note, t0, vel) => {
    const f = midiToHz(note);
    const hold = 1.5;
    const end = t0 + hold + 0.4;
    const gain = gainNode(0);
    const total = adsr(gain.gain, t0, vel * 0.5, cfg.a, 0.1, 0.85, hold, 0.3);
    const lowpass = filt('lowpass', Math.min(cfg.lp, f * 9), 0.7);
    let tail = lowpass;
    cfg.body.forEach(([frequency, g]) => {
      const peak = filt('peaking', frequency, 1.2, g);
      tail.connect(peak);
      tail = peak;
    });
    const vibrato = osc('sine', cfg.rate, t0, end);
    const depth = gainNode(0);
    depth.gain.setValueAtTime(0, t0);
    depth.gain.linearRampToValueAtTime(cfg.vib, t0 + 0.45); // el vibrato entra después del ataque
    vibrato.connect(depth);
    [-5, 5].forEach((detune) => {
      const voice = osc('sawtooth', f, t0, end, detune);
      const level = gainNode(0.5);
      depth.connect(voice.detune);
      voice.connect(level);
      level.connect(lowpass);
    });
    if (cfg.sub) {
      const sub = osc('triangle', f / 2, t0, end);
      const level = gainNode(cfg.sub);
      sub.connect(level);
      level.connect(lowpass);
    }
    const scrape = noiseSource(t0, end);
    const scrapeFilter = filt('bandpass', Math.min(f * 3, 6000), 1.5);
    const scrapeGain = gainNode(0.035);
    scrape.connect(scrapeFilter);
    scrapeFilter.connect(scrapeGain);
    scrapeGain.connect(lowpass);
    tail.connect(gain);
    route(gain, 0.22);
    return total;
  };

  const blow = (cfg, note, t0, vel) => {
    const f = midiToHz(note);
    const hold = 1.1;
    const end = t0 + hold + cfg.r + 0.1;
    const gain = gainNode(0);
    const total = adsr(gain.gain, t0, vel * cfg.gain, cfg.a, 0.08, 0.8, hold, cfg.r);
    const lowpass = filt('lowpass', cfg.cutoff[0], cfg.q);
    lowpass.frequency.setValueAtTime(cfg.cutoff[0], t0);
    lowpass.frequency.exponentialRampToValueAtTime(cfg.cutoff[1], t0 + cfg.a + 0.06); // "abrirse" al soplar
    const formant = filt('peaking', cfg.formant, 2, 6);
    lowpass.connect(formant);
    const vibrato = osc('sine', 5.2, t0, end);
    const depth = gainNode(0);
    depth.gain.setValueAtTime(0, t0);
    depth.gain.linearRampToValueAtTime(cfg.vib, t0 + 0.5);
    vibrato.connect(depth);
    cfg.waves.forEach(([type, mult, level, detune]) => {
      const voice = osc(type, f * mult, t0, end, detune);
      const mix = gainNode(level);
      depth.connect(voice.detune);
      voice.connect(mix);
      mix.connect(lowpass);
    });
    const breath = noiseSource(t0, end);
    const breathFilter = filt('bandpass', cfg.breathF, 0.9);
    const breathGain = gainNode(0);
    perc(breathGain.gain, t0, cfg.breath, 0.25, cfg.a);
    breath.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(gain);
    formant.connect(gain);
    route(gain, 0.2);
    return total;
  };

  const piano = (note, t0, vel) => {
    const f = midiToHz(note);
    const out = gainNode(vel * 0.3);
    const tone = filt('lowpass', clamp(f * 14, 1500, 9000), 0.6);
    const lengthScale = clamp(1.7 - (note - 48) / 60, 0.6, 1.8);
    let longest = 0.5;
    for (let k = 1; k <= 8; k += 1) {
      const fk = f * k * Math.sqrt(1 + 0.00035 * k * k); // inarmonicidad de cuerda rígida
      if (fk > 9000) break;
      const tau = (2.4 * lengthScale) / (1 + 0.7 * (k - 1));
      const amp = (1 / k ** 1.15) * (k === 2 ? 1.2 : 1);
      longest = Math.max(longest, tau);
      // k <= 3: segunda cuerda del coro, apenas desafinada, para dar cuerpo.
      for (let string = 0; string < (k <= 3 ? 2 : 1); string += 1) {
        const node = osc('sine', fk, t0, t0 + tau + 0.1, string ? 3 : 0);
        const gain = gainNode(0);
        perc(gain.gain, t0, string ? amp * 0.6 : amp, tau);
        node.connect(gain);
        gain.connect(tone);
      }
    }
    hitNoise(t0, 'bandpass', 3000, 1, 0.1 * vel, 0.02, 0); // golpe del martillo
    tone.connect(out);
    route(out, 0.2);
    return longest + 0.2;
  };

  const organ = (note, t0, vel) => {
    const f = midiToHz(note);
    const hold = 1.3;
    const end = t0 + hold + 0.2;
    const gain = gainNode(0);
    const total = adsr(gain.gain, t0, vel * 0.3, 0.012, 0.05, 0.9, hold, 0.12);
    const tremolo = osc('sine', 6.5, t0, end);
    const depth = gainNode(0.05);
    tremolo.connect(depth);
    depth.connect(gain.gain);
    [[0.5, 0.4], [1, 0.8], [1.5, 0.5], [2, 0.5], [3, 0.25], [4, 0.15]].forEach(([ratio, level]) => {
      const node = osc('sine', f * ratio, t0, end);
      const mix = gainNode(level);
      node.connect(mix);
      mix.connect(gain);
    });
    hitNoise(t0, 'bandpass', 2500, 1, 0.05 * vel, 0.015, 0);
    route(gain, 0.25);
    return total;
  };

  const synth = (note, t0, vel) => {
    const f = midiToHz(note);
    const hold = 0.9;
    const end = t0 + hold + 0.4;
    const gain = gainNode(0);
    const total = adsr(gain.gain, t0, vel * 0.35, 0.01, 0.3, 0.5, hold, 0.3);
    const lowpass = filt('lowpass', 2600, 6);
    lowpass.frequency.setValueAtTime(2600, t0);
    lowpass.frequency.exponentialRampToValueAtTime(700, t0 + 0.5);
    [-7, 7].forEach((detune) => {
      const node = osc('sawtooth', f, t0, end, detune);
      const mix = gainNode(0.5);
      node.connect(mix);
      mix.connect(lowpass);
    });
    const sub = osc('square', f / 2, t0, end);
    const subLevel = gainNode(0.25);
    sub.connect(subLevel);
    subLevel.connect(lowpass);
    lowpass.connect(gain);
    route(gain, 0.2);
    return total;
  };

  const accordion = (note, t0, vel) => {
    const f = midiToHz(note);
    const hold = 1.2;
    const end = t0 + hold + 0.2;
    const gain = gainNode(0);
    const total = adsr(gain.gain, t0, vel * 0.3, 0.05, 0.1, 0.85, hold, 0.15);
    const body = filt('peaking', 1500, 1.2, 6);
    [[-9, 1], [0, 1], [9, 1], [0, 2]].forEach(([detune, ratio]) => {
      const node = osc('sawtooth', f * ratio, t0, end, detune);
      const mix = gainNode(ratio === 2 ? 0.18 : 0.32);
      node.connect(mix);
      mix.connect(body);
    });
    const air = noiseSource(t0, end);
    const airFilter = filt('bandpass', 2500, 0.8);
    const airGain = gainNode(0.03);
    air.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(gain);
    body.connect(gain);
    route(gain, 0.2);
    return total;
  };

  const mallet = (cfg, note, t0, vel) => {
    const f = midiToHz(note);
    let longest = 0.3;
    const master2 = gainNode(vel * 0.5);
    cfg.partials.forEach(([ratio, amp, length]) => {
      if (f * ratio > 9000) return;
      longest = Math.max(longest, length);
      const node = osc('sine', f * ratio, t0, t0 + length + 0.1);
      const gain = gainNode(0);
      perc(gain.gain, t0, amp, length, 0.001);
      node.connect(gain);
      gain.connect(master2);
    });
    if (cfg.tremolo) {
      const lfo = osc('sine', 5, t0, t0 + longest + 0.2);
      const depth = gainNode(cfg.tremolo * vel * 0.5);
      lfo.connect(depth);
      depth.connect(master2.gain);
    }
    hitNoise(t0, 'bandpass', 2200, 1.5, 0.12 * vel, 0.015, 0);
    route(master2, 0.2);
    return longest + 0.2;
  };

  // ---------- Tabla de voces: cada una devuelve su duración en segundos ----------
  const VOICES = {
    kick: ({ t0, vel }) => {
      sine(t0, 150, 46, 0.12, vel, 0.5, 'sine', 0.04);
      sine(t0, 62, 50, 0.1, vel * 0.5, 0.3, 'triangle', 0);
      hitNoise(t0, 'highpass', 2500, 0.7, 0.3 * vel, 0.012, 0);
      return 0.6;
    },
    snare: ({ t0, vel, index }) => {
      hitNoise(t0, 'bandpass', 3500, 0.6, 0.8 * vel, index === 1 ? 0.12 : 0.22, 0.14);
      sine(t0, 230, 180, 0.05, 0.6 * vel, 0.12, 'triangle', 0.05);
      sine(t0, 330, 300, 0.05, 0.3 * vel, 0.08, 'triangle', 0);
      if (index === 1) sine(t0, 480, 470, 0.02, 0.5 * vel, 0.05, 'square', 0);
      return 0.35;
    },
    hihat: ({ t0, vel, index }) => {
      const length = index === 1 ? 0.4 : 0.06;
      metal(t0, 1, 'highpass', 7000, 0.7, 0.6 * vel, length, 0.05);
      hitNoise(t0, 'highpass', 8000, 0.7, 0.25 * vel, length, 0.05);
      return length + 0.15;
    },
    tom: ({ t0, vel, note }) => {
      const f = midiToHz(note);
      sine(t0, f * 1.5, f, 0.08, vel * 0.9, 0.5, 'sine', 0.1);
      sine(t0, f * 1.8, f * 1.7, 0.08, vel * 0.25, 0.2, 'triangle', 0);
      hitNoise(t0, 'bandpass', 1500, 1, 0.25 * vel, 0.02, 0);
      return 0.65;
    },
    crash: ({ t0, vel, index }) => {
      const mult = index === 1 ? 1.2 : 1;
      hitNoise(t0, 'highpass', 2800, 0.7, 0.5 * vel, 1.8, 0.3);
      metal(t0, 2.5 * mult, 'bandpass', 6000, 0.8, 0.5 * vel, 1.5, 0.3);
      return 2;
    },
    ride: ({ t0, vel, index }) => {
      if (index === 1) {
        [1245, 1850, 2630].forEach((f, i) => partial(t0, f, 0.3 * vel / (i + 1), 1.2, 'sine', 0.2));
        metal(t0, 1.5, 'bandpass', 5000, 1.2, 0.25 * vel, 0.5, 0.2);
        return 1.4;
      }
      metal(t0, 2, 'bandpass', 4500, 1.2, 0.5 * vel, 1.4, 0.25);
      hitNoise(t0, 'highpass', 6000, 0.7, 0.15 * vel, 0.4, 0.2);
      return 1.6;
    },
    cowbell: ({ t0, vel }) => {
      const filter = filt('bandpass', 2640, 1.5);
      const gain = gainNode(0);
      perc(gain.gain, t0, 0.7 * vel, 0.35);
      [587, 845].forEach((f) => {
        const node = osc('square', f, t0, t0 + 0.5);
        node.connect(filter);
      });
      filter.connect(gain);
      route(gain, 0.1);
      return 0.5;
    },
    clap: ({ t0, vel }) => {
      [0, 0.012, 0.026].forEach((delay) => hitNoise(t0 + delay, 'bandpass', 1200, 1.2, 0.6 * vel, 0.02, 0.1));
      hitNoise(t0 + 0.03, 'bandpass', 1200, 1.2, 0.5 * vel, 0.18, 0.25);
      return 0.35;
    },
    conga: ({ t0, vel, index, note }) => {
      const f = midiToHz(note);
      if (index === 1) {
        hitNoise(t0, 'bandpass', 1800, 1, 0.8 * vel, 0.08, 0.1);
        sine(t0, f * 1.2, f, 0.03, 0.5 * vel, 0.1, 'sine', 0);
        return 0.25;
      }
      const base = index === 2 ? f / 1.5 : f;
      sine(t0, base * 1.15, base, 0.04, 0.9 * vel, index === 2 ? 0.45 : 0.28, 'sine', 0.12);
      sine(t0, base * 1.6, base * 1.55, 0.04, 0.25 * vel, 0.1, 'triangle', 0);
      hitNoise(t0, 'bandpass', 2000, 1, 0.3 * vel, 0.02, 0);
      return 0.6;
    },
    bongo: ({ t0, vel, index, note }) => {
      const f = midiToHz(index === 1 ? note - 5 : note);
      sine(t0, f * 1.2, f, 0.03, 0.85 * vel, 0.18, 'sine', 0.1);
      sine(t0, f * 1.7, f * 1.65, 0.03, 0.25 * vel, 0.07, 'triangle', 0);
      hitNoise(t0, 'bandpass', 2600, 1, 0.35 * vel, 0.02, 0);
      return 0.4;
    },
    timpani: ({ t0, vel, note }) => {
      const f = midiToHz(note);
      sine(t0, f * 1.25, f, 0.06, vel * 0.9, 1.6, 'sine', 0.3);
      [[1.5, 0.35, 0.9], [2, 0.3, 0.6], [2.44, 0.2, 0.4]].forEach(([ratio, amp, length]) => partial(t0, f * ratio, amp * vel, length, 'sine', 0.2));
      hitNoise(t0, 'lowpass', 600, 0.7, 0.4 * vel, 0.04, 0);
      return 1.9;
    },
    cajon: ({ t0, vel, index }) => {
      if (index === 1) {
        hitNoise(t0, 'bandpass', 2200, 0.8, 0.8 * vel, 0.1, 0.08);
        hitNoise(t0, 'highpass', 5000, 0.7, 0.3 * vel, 0.04, 0);
        sine(t0, 180, 150, 0.04, 0.4 * vel, 0.1, 'sine', 0);
        return 0.3;
      }
      sine(t0, 100, 70, 0.1, 0.95 * vel, 0.35, 'sine', 0.08);
      hitNoise(t0, 'lowpass', 900, 0.7, 0.5 * vel, 0.15, 0.05);
      return 0.5;
    },
    tambourine: ({ t0, vel }) => {
      hitNoise(t0, 'highpass', 6000, 0.7, 0.45 * vel, 0.22, 0.15);
      hitNoise(t0 + 0.045, 'highpass', 6500, 0.7, 0.3 * vel, 0.18, 0.15);
      metal(t0, 5, 'bandpass', 7500, 1, 0.25 * vel, 0.3, 0.15);
      return 0.45;
    },
    triangle: ({ t0, vel, index }) => {
      const length = index === 1 ? 0.35 : 2.2;
      [4186, 5800, 8300].forEach((f, i) => partial(t0, f, 0.3 * vel / (i + 1), length, 'sine', 0.3));
      hitNoise(t0, 'highpass', 8000, 0.7, 0.08 * vel, 0.01, 0);
      return length + 0.1;
    },
    maracas: ({ t0, vel }) => {
      hitNoise(t0, 'bandpass', 5500, 1.2, 0.5 * vel, 0.07, 0.08);
      hitNoise(t0 + 0.06, 'highpass', 5000, 0.8, 0.3 * vel, 0.08, 0.08);
      return 0.25;
    },
    guiro: ({ t0, vel, index }) => {
      for (let i = 0; i < 8; i += 1) {
        const step = index === 1 ? 7 - i : i;
        hitNoise(t0 + i * 0.03, 'bandpass', 3000 + step * 120, 4, 0.4 * vel, 0.02, 0.05);
      }
      return 0.4;
    },
    speaker: ({ t0, vel, note }) => {
      const f = midiToHz(note);
      sine(t0, f * 1.5, f, 0.1, vel, 0.6, 'sine', 0.05);
      sine(t0, f * 2, f * 2, 0.1, vel * 0.4, 0.3, 'sine', 0);
      hitNoise(t0, 'lowpass', 300, 0.7, 0.4 * vel, 0.25, 0.1);
      return 0.8;
    },
    laser: ({ t0, vel }) => {
      sine(t0, 2400, 200, 0.25, 0.45 * vel, 0.3, 'sawtooth', 0.15);
      return 0.45;
    },
    turntable: ({ t0, vel, index }) => {
      const end = t0 + 0.55;
      const source = osc('sawtooth', 220, t0, end);
      const filter = filt('bandpass', 1500, 1);
      const gain = gainNode(0);
      if (index === 1) {
        source.frequency.setValueAtTime(1600, t0);
        source.frequency.exponentialRampToValueAtTime(100, t0 + 0.5); // rebobinado
      } else {
        [180, 700, 260, 1000, 320, 520].forEach((f, i) => source.frequency.linearRampToValueAtTime(f, t0 + (i + 1) * 0.055));
      }
      adsr(gain.gain, t0, 0.35 * vel, 0.01, 0.05, 0.8, 0.38, 0.1);
      source.connect(filter);
      filter.connect(gain);
      route(gain, 0.1);
      hitNoise(t0, 'lowpass', 1800, 0.7, 0.18 * vel, 0.45, 0);
      return 0.65;
    },
    mic: ({ t0, vel }) => {
      // "pru-e-ba": plosiva + formantes u -> e -> a (prueba de sonido)
      const end = t0 + 0.7;
      const source = osc('sawtooth', 132, t0, end);
      source.frequency.linearRampToValueAtTime(118, t0 + 0.6);
      const vibrato = osc('sine', 6, t0, end);
      const depth = gainNode(6);
      vibrato.connect(depth);
      depth.connect(source.detune);
      const gain = gainNode(0);
      adsr(gain.gain, t0 + 0.04, 0.5 * vel, 0.04, 0.05, 0.85, 0.5, 0.1);
      const vowels = [[0.04, 320, 800, 2500], [0.22, 450, 2000, 2800], [0.45, 800, 1300, 2600]];
      [0, 1, 2].forEach((band) => {
        const filter = filt('bandpass', vowels[0][band + 1], [8, 10, 12][band]);
        vowels.forEach(([time, ...formants]) => filter.frequency.setTargetAtTime(formants[band], t0 + time, 0.025));
        const mix = gainNode([1, 0.6, 0.3][band]);
        source.connect(filter);
        filter.connect(mix);
        mix.connect(gain);
      });
      route(gain, 0.15);
      hitNoise(t0, 'highpass', 1200, 0.7, 0.4 * vel, 0.03, 0);
      hitNoise(t0 + 0.38, 'highpass', 800, 0.7, 0.15 * vel, 0.03, 0);
      return 0.8;
    },
    amp: ({ t0, vel, note }) => {
      const roots = [40, 43, 45, 38]; // Mi, Sol, La, Re: riff de acordes de potencia
      const root = note ?? roots[ampStep % roots.length];
      ampStep += 1;
      const chain = ampChain(5, 3600, 0.5);
      [0, 7, 12].forEach((interval, i) => playPluck('electric', root + interval, t0 + i * 0.012, vel, chain));
      return 3.2;
    },
    pedal: ({ t0, vel, index, note }) => {
      const base = note ?? 52;
      if (index === 1) { // retardo
        [1, 0.55, 0.3, 0.15].forEach((level, i) => playPluck('electric', base + 5, t0 + i * 0.28, vel * level));
        return 3.8;
      }
      if (index === 2) { // wah
        const sweep = (node) => {
          const filter = filt('bandpass', 400, 6);
          filter.frequency.setValueAtTime(400, t0);
          filter.frequency.exponentialRampToValueAtTime(2200, t0 + 0.5);
          filter.frequency.exponentialRampToValueAtTime(500, t0 + 1.2);
          node.connect(filter);
          const boost = gainNode(2.5);
          filter.connect(boost);
          return boost;
        };
        playPluck('electric', base - 7, t0, vel, sweep);
        return 3.2;
      }
      if (index === 3) { // coro: línea de retardo modulada por un LFO lento
        const chorus = (node) => {
          const delay = ctx.createDelay(0.05);
          delay.delayTime.value = 0.015;
          const lfo = osc('sine', 0.8, t0, t0 + 3.4);
          const depth = gainNode(0.004);
          lfo.connect(depth);
          depth.connect(delay.delayTime);
          const mix = gainNode(1);
          node.connect(mix);
          node.connect(delay);
          delay.connect(mix);
          return mix;
        };
        playPluck('electric', base, t0, vel * 0.8, chorus);
        return 3.4;
      }
      playPluck('electric', base - 12, t0, vel, ampChain(9, 4200, 0.4)); // fuzz
      return 3.2;
    },
    pad: ({ t0, vel, index, sound }) => {
      const map = [['kick', 0], ['snare', 0], ['hihat', 0], ['clap', 0], ['synth', 36], ['synth', [60, 64, 67]], ['laser', 0], ['hihat', 1]];
      const [voice, extra] = map[((index % 8) + 8) % 8];
      const note = Array.isArray(extra) ? extra : typeof extra === 'number' && voice === 'synth' ? extra : undefined;
      return trigger({ voice, note, index: Array.isArray(extra) || voice === 'synth' ? 0 : extra, pan: sound.pan }, { velocity: vel, scheduled: t0, pan: state.pan })?.duration ?? 0.5;
    }
  };

  // Voces melódicas generadas desde las tablas.
  Object.keys(PLUCK_VOICE).forEach((voice) => {
    VOICES[voice] = ({ t0, vel, note }) => playPluck(PLUCK_VOICE[voice], note, t0, vel);
  });
  Object.keys(BOWED).forEach((voice) => { VOICES[voice] = ({ t0, vel, note }) => bow(BOWED[voice], note, t0, vel); });
  Object.keys(WIND).forEach((voice) => { VOICES[voice] = ({ t0, vel, note }) => blow(WIND[voice], note, t0, vel); });
  Object.keys(MALLET).forEach((voice) => { VOICES[voice] = ({ t0, vel, note }) => mallet(MALLET[voice], note, t0, vel); });
  VOICES.piano = ({ t0, vel, note }) => piano(note, t0, vel);
  VOICES.organ = ({ t0, vel, note }) => organ(note, t0, vel);
  VOICES.synth = ({ t0, vel, note }) => synth(note, t0, vel);
  VOICES.accordion = ({ t0, vel, note }) => accordion(note, t0, vel);

  // ---------- API pública ----------
  // Dispara una zona sonora. Devuelve { voice, note, duration } o null si no suena.
  function trigger(sound, options = {}) {
    if (!sound || !VOICES[sound.voice]) return null;
    const c = ensure();
    if (!c || muted || active > 40) return null;
    const velocity = clamp(options.velocity ?? 0.85, 0.1, 1);
    const t0 = options.scheduled ?? c.currentTime + 0.01;
    state.pan = clamp(options.pan ?? sound.pan ?? 0, -0.8, 0.8);
    let note = sound.note;
    let neckInfo = null;
    if (sound.neck && options.point) {
      neckInfo = resolveNeckNote(sound.neck, options.point);
      note = neckInfo.midi;
    }
    if (note === undefined || note === null) note = DEFAULT_NOTE[sound.voice];
    const notes = Array.isArray(note) ? note : [note];
    const stagger = notes.length > 1 ? sound.strum ?? 0.024 : 0;
    let duration = 0.3;
    try {
      notes.forEach((value, i) => {
        const result = VOICES[sound.voice]({
          t0: t0 + i * stagger,
          vel: velocity * (1 - i * 0.04),
          note: value,
          index: sound.index ?? 0,
          sound
        });
        duration = Math.max(duration, (result || 0.3) + i * stagger);
      });
    } catch {
      return null; // un fallo de audio nunca debe romper la escena
    }
    active += 1;
    setTimeout(() => { active = Math.max(0, active - 1); }, Math.min(duration, 4) * 1000);
    return { voice: sound.voice, note: notes[0] ?? null, duration, string: neckInfo?.string, fret: neckInfo?.fret };
  }

  return {
    // Debe llamarse dentro de un gesto del usuario (clic/tap) para crear o reanudar el AudioContext.
    unlock: () => { ensure(); },
    play: trigger,
    setVolume: (value) => { volume = clamp(Number(value) || 0, 0, 1); applyVolume(); },
    getVolume: () => volume,
    setMuted: (value) => { muted = Boolean(value); applyVolume(); },
    isMuted: () => muted,
    dispose: () => {
      bufferCache.clear();
      curveCache.clear();
      if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
      ctx = null;
      bus = null;
      verbIn = null;
      master = null;
      noiseBuffer = null;
    }
  };
};

export const SOUND_VOICES = [
  'kick', 'snare', 'hihat', 'tom', 'crash', 'ride', 'cowbell', 'clap', 'conga', 'bongo', 'timpani', 'cajon', 'tambourine',
  'triangle', 'maracas', 'guiro', 'speaker', 'laser', 'turntable', 'mic', 'amp', 'pedal', 'pad',
  ...Object.keys(PLUCK_VOICE), ...Object.keys(BOWED), ...Object.keys(WIND), ...Object.keys(MALLET),
  'piano', 'organ', 'synth', 'accordion'
];
