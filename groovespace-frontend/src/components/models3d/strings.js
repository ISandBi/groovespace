import { Shape } from 'three';
import { M, add, box, cyl, extrude, group, knob, lathe, outline, pipe, rbox, rod, sphere, torus, zone } from './kit';

// Cuerdas. Mástil: zona con `neck` en coordenadas LOCALES del mesh (el motor convierte punto → traste/cuerda → nota).
// Convención: instrumento de pie, mástil hacia +y, frente hacia +z. El mástil sube desde el cuerpo.

const NECK_FRETS = 20;
const fretsRatio = 1 - 2 ** (-NECK_FRETS / 12); // fracción de la escala cubierta por 20 trastes

const buildNeck = (g, { voice, strings, y0, length, width, thick = 0.026, wood = '#3a2312', boardColor = '#1d120a', fretted = true, z = 0 }) => {
  const scale = length / fretsRatio;
  const neck = add(g, rbox(width, length, thick, 0.006), M.wood(wood, true), [0, y0 + length / 2, z]);
  zone(neck, {
    voice,
    neck: { strings, nut: length / 2, scale, dir: -1, frets: fretted ? NECK_FRETS : 40, axis: 'y', cross: 'x', center: 0, width }
  }, { press: 'pluck' });
  add(g, rbox(width * 0.94, length, 0.006, 0.002), M.satin(boardColor, 0.3), [0, y0 + length / 2, z + thick / 2 + 0.002]);
  if (fretted) {
    for (let n = 1; n <= NECK_FRETS; n += 1) {
      const d = scale * (1 - 2 ** (-n / 12));
      if (d > length) break;
      add(g, box(width * 0.95, 0.0025, 0.004), M.fret(), [0, y0 + length - d, z + thick / 2 + 0.006]);
    }
    [3, 5, 7, 9, 12].forEach((n) => {
      const d = scale * (1 - 2 ** (-(n - 0.5) / 12));
      if (d < length) add(g, sphere(0.004, 10), M.plastic('#f2efe4'), [0, y0 + length - d, z + thick / 2 + 0.007]);
    });
  }
  strings.forEach((_, i) => {
    const x = (i / (strings.length - 1) - 0.5) * width * 0.82;
    add(g, cyl(i < strings.length / 2 ? 0.0011 + (strings.length - i) * 0.00006 : 0.0013, 0.0011, length + 0.45, 6), M.string(i < strings.length / 2), [x, y0 + length / 2 - 0.15, z + thick / 2 + 0.01]);
  });
  return { neck, top: y0 + length };
};

const headstock = (g, { y, width, color = '#3a2312', tuners = 6 }) => {
  const h = add(g, rbox(width * 1.25, 0.17, 0.02, 0.01), M.paint(color, 0.25), [0, y + 0.085, -0.004], [0, 0, 0]);
  for (let i = 0; i < tuners; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const yy = y + 0.03 + Math.floor(i / 2) * 0.045;
    add(g, cyl(0.006, 0.006, 0.03, 12), M.chrome(), [side * width * 0.72, yy, 0.0], [Math.PI / 2, 0, 0]);
    add(g, rbox(0.012, 0.016, 0.006, 0.002), M.chrome(), [side * width * 0.72 + side * 0.014, yy, -0.02]);
  }
  return h;
};

const bodyShape = (kind) => {
  if (kind === 'bass') return outline([[0, -0.3], [0.17, -0.27], [0.21, -0.14], [0.14, -0.04], [0.1, 0.03], [0.16, 0.12], [0.1, 0.16], [0, 0.16], [-0.1, 0.16], [-0.16, 0.12], [-0.1, 0.03], [-0.14, -0.04], [-0.21, -0.14], [-0.17, -0.27]]);
  if (kind === 'acoustic') return outline([[0, -0.38], [0.2, -0.34], [0.25, -0.2], [0.2, -0.07], [0.12, 0.0], [0.15, 0.1], [0.09, 0.17], [0, 0.18], [-0.09, 0.17], [-0.15, 0.1], [-0.12, 0.0], [-0.2, -0.07], [-0.25, -0.2], [-0.2, -0.34]]);
  return outline([[0, -0.26], [0.14, -0.24], [0.19, -0.14], [0.15, -0.04], [0.09, 0.03], [0.15, 0.13], [0.1, 0.17], [0.03, 0.15], [0, 0.15], [-0.03, 0.15], [-0.1, 0.17], [-0.15, 0.13], [-0.09, 0.03], [-0.15, -0.04], [-0.19, -0.14], [-0.14, -0.24]]);
};

const stand = (g, y = 0) => {
  add(g, cyl(0.19, 0.2, 0.02, 28), M.rubber('#101012'), [0, 0.01, 0.02]);
  rod(g, M.chrome(), [0, 0.02, 0.02], [0, y + 0.3, 0.02], 0.01);
};

export const buildGuitar = (g, { bass = false, color = '#c2185b', body: bodyKind } = {}) => {
  const strings = bass ? [28, 33, 38, 43] : [40, 45, 50, 55, 59, 64];
  const kind = bodyKind || (bass ? 'bass' : 'electric');
  const bodyY = 0.46;
  const body = add(g, extrude(bodyShape(kind), 0.045, 0.008), M.paint(color, 0.14), [0, bodyY, 0]);
  zone(body, { voice: bass ? 'bass' : 'gtr-electric', note: strings[2] }, { press: 'pluck' });
  const length = bass ? 0.64 : 0.5;
  const nw = bass ? 0.048 : 0.042;
  const bodyTop = bodyY + (bass ? 0.16 : 0.15);
  const { top } = buildNeck(g, { voice: bass ? 'bass' : 'gtr-electric', strings, y0: bodyTop - 0.04, length, width: nw, wood: '#6b3d1a', boardColor: '#24140a', z: 0.0 });
  headstock(g, { y: top, width: nw, color, tuners: strings.length });
  // Pastillas, puente, controles
  const front = 0.027;
  const pickups = bass ? [0.0, -0.08] : [0.05, -0.02, -0.09];
  pickups.forEach((y) => add(g, rbox(nw * 1.4, 0.03, 0.01, 0.004), M.plastic('#0d0d10'), [0, bodyY + y, front + 0.004]));
  add(g, rbox(nw * 1.5, 0.026, 0.012, 0.004), M.chrome(), [0, bodyY - 0.17, front + 0.006]);
  [[0.1, -0.13], [0.13, -0.18], [0.07, -0.19]].forEach(([x, y]) => knob(g, M.chrome(), [x, bodyY + y, front + 0.004], 0.014, 0.02, [Math.PI / 2, 0, 0]));
  add(g, rbox(0.2, 0.14, 0.004, 0.01), M.plastic('#f5f2ea'), [-0.02, bodyY - 0.07, front + 0.003]);
  // Cuerdas sobre el cuerpo
  strings.forEach((_, i) => { const x = (i / (strings.length - 1) - 0.5) * nw * 0.8; add(g, cyl(0.0012, 0.0012, 0.42, 6), M.string(i < strings.length / 2), [x, bodyY - 0.02, front + 0.016]); });
  stand(g, bodyY);
  rod(g, M.chrome(), [-0.12, 0.02, 0.02], [-0.02, bodyY - 0.1, 0.0], 0.007);
  rod(g, M.chrome(), [0.12, 0.02, 0.02], [0.02, bodyY - 0.1, 0.0], 0.007);
};

export const buildAcoustic = (g, { type = 'steel' } = {}) => {
  const voice = { steel: 'gtr-acoustic', nylon: 'gtr-nylon', ukulele: 'ukulele', mandolin: 'mandolin', banjo: 'banjo' }[type];
  const strings = { steel: [40, 45, 50, 55, 59, 64], nylon: [40, 45, 50, 55, 59, 64], ukulele: [67, 60, 64, 69], mandolin: [55, 62, 69, 76], banjo: [62, 50, 55, 59, 62] }[type];
  const scaleK = { steel: 1, nylon: 1, ukulele: 0.62, mandolin: 0.68, banjo: 0.85 }[type];
  const color = type === 'nylon' ? '#e0b070' : type === 'banjo' ? '#d8d2c2' : '#c9833f';
  const bodyY = 0.4 * scaleK + 0.05;
  if (type === 'banjo') {
    const pot = group(g, [0, bodyY, 0], [Math.PI / 2, 0, 0]);
    add(pot, cyl(0.15, 0.15, 0.07, 48), M.wood('#7a4a20', true));
    zone(add(pot, cyl(0.147, 0.147, 0.005, 48), M.head(), [0, 0.037, 0]), { voice, note: strings[1] }, { press: 'pluck' });
    add(pot, torus(0.15, 0.007, 48), M.chrome(), [0, 0.037, 0], [Math.PI / 2, 0, 0]);
  } else {
    const shape = type === 'ukulele' ? outline([[0, -0.2], [0.1, -0.18], [0.12, -0.08], [0.08, 0], [0.1, 0.08], [0, 0.1], [-0.1, 0.08], [-0.08, 0], [-0.12, -0.08], [-0.1, -0.18]]) : bodyShape('acoustic');
    const k = type === 'mandolin' ? 0.7 : 1;
    const body = add(g, extrude(shape, 0.09 * (type === 'ukulele' ? 0.7 : 1), 0.01), M.wood(color, true), [0, bodyY, 0], [0, 0, 0], [k, k, 1]);
    zone(body, { voice, note: strings[2] }, { press: 'pluck' });
    add(g, cyl(0.045 * k, 0.045 * k, 0.006, 32), M.rubber('#050505'), [0, bodyY + 0.0, 0.056], [Math.PI / 2, 0, 0]);
    add(g, torus(0.047 * k, 0.004, 32), M.wood('#3a1f0c', true), [0, bodyY + 0.0, 0.056], [0, 0, 0]);
    add(g, rbox(0.12 * k, 0.025, 0.012, 0.004), M.wood('#2b170a', true), [0, bodyY - 0.14 * k, 0.056]);
  }
  const length = 0.5 * scaleK;
  const nw = type === 'ukulele' ? 0.036 : 0.044;
  const topOfBody = bodyY + 0.16 * (type === 'banjo' ? 0.9 : type === 'ukulele' ? 0.5 : type === 'mandolin' ? 0.7 : 1);
  const { top } = buildNeck(g, { voice, strings, y0: topOfBody - 0.03, length, width: nw, wood: '#8a5526', boardColor: '#1f1209' });
  headstock(g, { y: top, width: nw, color: '#4a2a12', tuners: Math.min(6, strings.length * (type === 'mandolin' ? 1 : 1)) });
  stand(g, bodyY);
};

const bowedBody = () => outline([[0, -0.25], [0.1, -0.23], [0.14, -0.14], [0.1, -0.06], [0.06, 0.0], [0.1, 0.07], [0.12, 0.16], [0.06, 0.22], [0, 0.23], [-0.06, 0.22], [-0.12, 0.16], [-0.1, 0.07], [-0.06, 0.0], [-0.1, -0.06], [-0.14, -0.14], [-0.1, -0.23]]);

export const buildBowed = (g, size = 0.85) => {
  const voice = size > 1.25 ? 'contrabass' : size > 1 ? 'cello' : size > 0.8 ? 'violin' : 'viola';
  const strings = { contrabass: [28, 33, 38, 43], cello: [36, 43, 50, 57], violin: [55, 62, 69, 76], viola: [48, 55, 62, 69] }[voice];
  const k = size > 1.25 ? 2.4 : size > 1 ? 1.9 : 1;
  const bodyY = (voice === 'violin' || voice === 'viola' ? 0.6 : 0.38 * k * 0.75) + 0.1;
  const body = add(g, extrude(bowedBody(), 0.055 * Math.max(1, k * 0.7), 0.01), M.wood('#a14f1c', true), [0, bodyY, 0], [0, 0, 0], [k, k, 1]);
  zone(body, { voice, note: strings[1] }, { press: 'pluck' });
  [[-1], [1]].forEach(([s]) => add(g, rbox(0.008 * k, 0.07 * k, 0.003, 0.0015), M.plastic('#120a05'), [s * 0.045 * k, bodyY - 0.02 * k, 0.03 * Math.max(1, k * 0.7) + 0.012], [0, 0, s * 0.18]));
  add(g, rbox(0.05 * k, 0.04 * k, 0.004, 0.003), M.wood('#d9b27a', true), [0, bodyY - 0.07 * k, 0.034 * Math.max(1, k * 0.7) + 0.014]);
  add(g, rbox(0.075 * k, 0.012 * k, 0.012, 0.002), M.plastic('#050403'), [0, bodyY - 0.18 * k, 0.03 * Math.max(1, k * 0.7) + 0.012]);
  const length = 0.34 * k;
  const nw = 0.03 * Math.sqrt(k) + 0.004;
  const y0 = bodyY + 0.2 * k;
  const { top } = buildNeck(g, { voice, strings, y0, length, width: nw, thick: 0.03, wood: '#2b1a0e', boardColor: '#0c0805', fretted: false });
  add(g, sphere(0.03 * Math.sqrt(k), 20), M.wood('#a14f1c', true), [0, top + 0.03, -0.004], [0, 0, 0], [0.7, 1.3, 0.7]);
  strings.forEach((_, i) => add(g, cyl(0.0016, 0.0016, 0.12, 6), M.chrome(), [(i - 1.5) * 0.009, top + 0.012, -0.012]));
  add(g, cyl(0.004, 0.004, 0.2 * k, 8), M.metal('#222'), [0, 0.12, 0.0]); // espiga
  rod(g, M.metal('#222'), [0, bodyY - 0.24 * k, 0], [0, 0.0, 0.0], 0.006);
  add(g, cyl(0.12, 0.13, 0.02, 24), M.rubber('#0d0d10'), [0, 0.01, 0]);
  // Arco recostado
  const bow = group(g, [0.18 * Math.sqrt(k), bodyY, 0.05], [0, 0, 0.12]);
  add(bow, cyl(0.004, 0.004, 0.75 * Math.sqrt(k), 8), M.wood('#6b3a15', true), [0, 0, 0]);
  add(bow, box(0.002, 0.7 * Math.sqrt(k), 0.012), M.plastic('#f1ece0'), [0.012, 0, 0]);
};

export const buildHarp = (g) => {
  add(g, rbox(0.46, 0.07, 0.26, 0.02), M.wood('#5a2e12', true), [0.0, 0.035, 0]);
  add(g, rbox(0.045, 1.5, 0.045, 0.01), M.gold(), [0.27, 0.82, 0]);
  pipe(g, M.wood('#5a2e12', true), [[0.27, 1.58, 0], [0.12, 1.66, 0], [-0.08, 1.62, 0], [-0.3, 1.5, 0]], 0.028, 60);
  const sb = rod(g, M.wood('#7a3d16', true), [0.18, 0.1, 0], [-0.3, 1.46, 0], 0.07);
  sb.scale.z = 1.5;
  zone(sb, { voice: 'harp', note: 60 }, { press: 'pluck' });
  const count = 22;
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const x = 0.2 - t * 0.48;
    const bottom = 0.18 + t * 1.2;
    const top = 1.6 - t * 0.12;
    const s = rod(g, M.string(i < 8), [x, bottom, 0.045], [x, top, 0.045], 0.0026);
    zone(s, { voice: 'harp', note: 72 - Math.round(i * 1.4) }, { press: 'pluck' });
    s.scale.x = 4;
  }
};

export const buildMeshStand = stand;
export { Shape };
