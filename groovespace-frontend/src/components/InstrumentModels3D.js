import { Group } from 'three';
import { releaseSharedAssets } from './models3d/kit';
import { buildDrums, buildCymbals, buildConga, buildTimpani, buildMallet, buildPercussionSmall, buildTurntable, buildPedalboard, buildMic, buildAmp, buildCase } from './models3d/percussion';
import { buildGuitar, buildAcoustic, buildBowed, buildHarp } from './models3d/strings';
import { buildKeyboard, buildOrgan, buildAccordion, buildPiano, buildBrass, buildSax, buildWoodwind } from './models3d/keysWinds';

// Cada instrumento: de pie sobre y=0, centrado en x/z, frente +z. Las piezas tocables llevan userData.sound.
// La primera regla que coincida con el nombre (sin acentos, minúsculas) gana.
const RULES = [
  [/contrabajo|double ?bass|upright/, (g) => buildBowed(g, 1.4)],
  [/violonchelo|chelo|cello/, (g) => buildBowed(g, 1.15)],
  [/violin|viola|fiddle/, (g) => buildBowed(g, 0.85)],
  [/arpa|harp/, buildHarp],
  [/timbal|timpani|tambora/, buildTimpani],
  [/vibraf/, (g) => buildMallet(g, 'vibraphone')],
  [/marimba/, (g) => buildMallet(g, 'marimba')],
  [/xilofon|glockenspiel|metalofon|lira/, (g) => buildMallet(g, 'xylophone')],
  [/conga|bongo|djembe|tumbadora/, buildConga],
  [/cajon/, (g) => buildPercussionSmall(g, 'cajon')],
  [/pad|sampler|mpc|octapad|pandero|percusion electr/, (g) => buildPercussionSmall(g, 'pad')],
  [/platillo|cymbal|zildjian|hi-?hat|hihat|crash|ride/, buildCymbals],
  [/bater|drum|percusi|tom|redoblante|snare/, buildDrums],
  [/dj|tornamesa|turntable|giradiscos|cdj|mezcladora/, buildTurntable],
  [/pedal|pedalera|efecto|multiefecto|boss|looper/, buildPedalboard],
  [/banjo/, (g) => buildAcoustic(g, { type: 'banjo' })],
  [/ukelele|ukulele/, (g) => buildAcoustic(g, { type: 'ukulele' })],
  [/mandolina|mandolin|bandurria/, (g) => buildAcoustic(g, { type: 'mandolin' })],
  [/clasica|nylon|requinto|flamenc|espanola/, (g) => buildAcoustic(g, { type: 'nylon' })],
  [/acustica|acoustic|folk|jumbo|dreadnought|martin|taylor/, (g) => buildAcoustic(g, { type: 'steel' })],
  [/bajo|bass/, (g) => buildGuitar(g, { bass: true, color: '#1f5fa8' })],
  [/guitar|les paul|stratocaster|telecaster|strat|tele|gibson|fender|ibanez|epiphone|prs/, (g) => buildGuitar(g)],
  [/organo|organ|hammond/, buildOrgan],
  [/acordeon|bandoneon|melodica/, buildAccordion],
  [/piano/, buildPiano],
  [/teclado|keyboard|sintetiz|synth|digital|midi|controlador|workstation|rhodes/, buildKeyboard],
  [/micro|mic\b|voz|vocal|cantante|shure|sennheiser/, buildMic],
  [/amp|marshall|combo|cabina|cabinet|bocina|monitor|speaker|altavoz|parlante|vox|orange/, (g) => buildAmp(g)],
  [/tuba|sousafon|bombardino/, (g) => buildBrass(g, 'tuba')],
  [/trombon/, (g) => buildBrass(g, 'trombone')],
  [/corno|horn|trompa/, (g) => buildBrass(g, 'horn')],
  [/trompeta|trumpet|corneta|fliscorno/, (g) => buildBrass(g, 'trumpet')],
  [/saxof|sax\b|saxo/, buildSax],
  [/armonica|harmonica/, (g) => buildWoodwind(g, 'harmonica')],
  [/flauta|flute|piccolo/, (g) => buildWoodwind(g, 'flute')],
  [/oboe/, (g) => buildWoodwind(g, 'oboe')],
  [/fagot|bassoon/, (g) => buildWoodwind(g, 'bassoon')],
  [/clarinete|clarinet|gaita/, (g) => buildWoodwind(g, 'clarinet')]
];

const normalize = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const createInstrumentModel = (name) => {
  const text = normalize(name);
  const rule = RULES.find(([pattern]) => pattern.test(text));
  const model = new Group();
  try {
    (rule ? rule[1] : buildCase)(model);
  } catch (error) {
    // Un modelo defectuoso nunca debe tumbar la sala: se sustituye por la caja genérica.
    console.warn('[3D] modelo con error, uso genérico:', name, error);
    model.clear();
    buildCase(model);
  }
  model.userData.instrumentName = name;
  return model;
};

export { releaseSharedAssets };
