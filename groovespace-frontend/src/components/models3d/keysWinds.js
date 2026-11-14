import { M, add, box, cyl, group, knob, lathe, outline, pipe, rbox, rod, sphere, torus, zone } from './kit';
import { extrude } from './kit';

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK = { 0: 1, 1: 3, 3: 6, 4: 8, 5: 10 }; // índice de blanca → semitono negro a su derecha

/** Teclado con una zona por tecla (nota MIDI). */
const keys = (g, { voice, octaves, start = 48, width, y, z, depth = 0.15 }) => {
  const whites = octaves * 7;
  const kw = width / whites;
  for (let i = 0; i < whites; i += 1) {
    const midi = start + Math.floor(i / 7) * 12 + WHITE[i % 7];
    const k = add(g, rbox(kw * 0.94, 0.02, depth, 0.003), M.plastic('#f6f3ea'), [-width / 2 + kw * (i + 0.5), y, z]);
    zone(k, { voice, note: midi }, { press: 'key' });
  }
  for (let i = 0; i < whites; i += 1) {
    const idx = i % 7;
    if (BLACK[idx] === undefined || i === whites - 1) continue;
    const midi = start + Math.floor(i / 7) * 12 + BLACK[idx];
    const k = add(g, rbox(kw * 0.56, 0.026, depth * 0.62, 0.003), M.plastic('#0b0b0e'), [-width / 2 + kw * (i + 1), y + 0.016, z - depth * 0.19]);
    zone(k, { voice, note: midi }, { press: 'key' });
  }
};

export const buildKeyboard = (g, { voice = 'synth' } = {}) => {
  const w = 1.25;
  [-0.5, 0.5].forEach((x) => { rod(g, M.chrome(), [x, 0.05, -0.18], [x * 1.0, 0.76, -0.04], 0.014); rod(g, M.chrome(), [x, 0.05, 0.18], [x, 0.76, 0.04], 0.014); add(g, box(0.05, 0.02, 0.4), M.rubber('#101012'), [x, 0.012, 0]); });
  add(g, rbox(w + 0.06, 0.07, 0.36, 0.02), M.satin('#17161d', 0.35), [0, 0.82, 0]);
  keys(g, { voice, octaves: 3, start: 48, width: w, y: 0.867, z: 0.08, depth: 0.17 });
  add(g, rbox(w + 0.06, 0.02, 0.1, 0.008), M.satin('#111116', 0.3), [0, 0.855, -0.1]);
  for (let i = 0; i < 8; i += 1) knob(g, M.chrome(), [-0.45 + i * 0.065, 0.86, -0.1], 0.013, 0.016);
  for (let i = 0; i < 4; i += 1) { const p = add(g, rbox(0.045, 0.012, 0.045, 0.005), M.glow(['#c2ff3c', '#ff5d8f', '#b28aff', '#ffb84d'][i]), [0.35 + i * 0.06, 0.862, -0.1]); zone(p, { voice: 'pad', note: 36 + i }, { press: 'bounce' }); }
  add(g, rbox(0.2, 0.012, 0.06, 0.004), M.glow('#22343a'), [-0.1, 0.862, -0.1]);
};

export const buildOrgan = (g) => buildKeyboard(g, { voice: 'organ' });
export const buildAccordion = (g) => {
  const bellows = add(g, cyl(0.11, 0.11, 0.3, 6), M.satin('#7a1124', 0.5), [0, 0.9, 0], [0, 0, Math.PI / 2], [1, 1, 1]);
  zone(bellows, { voice: 'accordion', note: 57 }, { press: 'bounce' });
  [-0.2, 0.2].forEach((x) => add(g, rbox(0.12, 0.3, 0.22, 0.02), M.paint('#16161a', 0.2), [x * 1.0 + (x > 0 ? 0.08 : -0.08), 0.9, 0]));
  for (let i = 0; i < 12; i += 1) { const b = add(g, cyl(0.014, 0.014, 0.01, 14), M.plastic('#f3efe2'), [-0.28, 0.78 + i * 0.025, 0.12], [Math.PI / 2, 0, 0]); zone(b, { voice: 'accordion', note: 57 + i }, { press: 'key' }); }
  for (let i = 0; i < 6; i += 1) add(g, cyl(0.005, 0.005, 0.02, 6), M.chrome(), [0.0 + i * 0.02, 1.06, 0]);
  rod(g, M.chrome(), [-0.3, 0.7, 0], [-0.3, 0.0, 0], 0.012);
  rod(g, M.chrome(), [0.3, 0.7, 0], [0.3, 0.0, 0], 0.012);
};

export const buildPiano = (parent) => {
  const g = group(parent, [0, 0, 0], [0, Math.PI, 0]);
  const wood = M.paint('#0b0b10', 0.08);
  const caseShape = outline([[-0.7, -0.45], [0.7, -0.45], [0.72, 0.4], [0.5, 0.9], [0.15, 1.3], [-0.2, 1.6], [-0.7, 1.7]]);
  const body = add(g, extrude(caseShape, 0.18, 0.015), wood, [0, 0.74, 0], [Math.PI / 2, 0, 0], [1, 1, 1]);
  body.rotation.x = Math.PI / 2;
  body.position.set(0, 0.74, 0.0);
  zone(body, { voice: 'piano', note: 52 }, { press: 'bounce' });
  const lid = add(g, extrude(caseShape, 0.03, 0.01), wood, [0, 1.12, 0.0], [Math.PI / 2 - 0.5, 0, 0], [0.98, 0.98, 1]);
  zone(lid, { voice: 'piano', note: 64 }, { press: 'bounce' });
  rod(g, M.chrome(), [0.55, 0.85, 0.2], [0.35, 1.1, 0.5], 0.01);
  add(g, rbox(1.46, 0.1, 0.34, 0.02), wood, [0, 0.74, -0.38]);
  keys(g, { voice: 'piano', octaves: 4, start: 36, width: 1.38, y: 0.795, z: -0.34, depth: 0.2 });
  add(g, rbox(1.42, 0.05, 0.06, 0.01), M.paint('#0b0b10', 0.1), [0, 0.86, -0.18]);
  [[-0.62, -0.3], [0.62, -0.3], [0.6, 1.1]].forEach(([x, z]) => { add(g, cyl(0.035, 0.05, 0.7, 14), wood, [x, 0.38, z]); add(g, sphere(0.045), M.brass(), [x, 0.03, z]); });
  add(g, rbox(0.5, 0.06, 0.3, 0.015), M.satin('#1a1a1e', 0.4), [0, 0.5, -0.9]);
  [[-0.2, -0.78], [0.2, -0.78], [-0.2, -1.02], [0.2, -1.02]].forEach(([x, z]) => rod(g, M.metal('#16161a'), [x, 0.03, z], [x, 0.48, z], 0.012));
  const pedal = group(g, [0, 0.0, -0.3]);
  [-0.06, 0, 0.06].forEach((x) => add(pedal, rbox(0.04, 0.012, 0.1, 0.004), M.brass(), [x, 0.05, 0.0]));
};

// ───────────────────────────── Vientos ─────────────────────────────

const mouthpiece = (g, pos, rot = [0, 0, 0]) => { const m = group(g, pos, rot); add(m, lathe([[0.02, 0], [0.012, 0.03], [0.008, 0.07], [0.004, 0.075]], 20), M.metal('#e0e0e6', 0.12)); return m; };

export const buildBrass = (g, type = 'trumpet') => {
  const voice = type;
  const base = { trumpet: 70, trombone: 58, tuba: 41, horn: 60 }[type];
  const s = { trumpet: 1, trombone: 1.25, tuba: 1.7, horn: 1.3 }[type];
  const holder = group(g, [0, 0, 0]);
  add(holder, cyl(0.17, 0.19, 0.02, 24), M.rubber('#101012'), [0, 0.01, 0]);
  rod(holder, M.chrome(), [0, 0.02, 0], [0, 0.78 * (type === 'tuba' ? 0.7 : 1), 0], 0.012);
  const y = (type === 'tuba' ? 0.6 : 0.9);
  const bore = type === 'tuba' ? 0.035 : 0.011;
  const body = group(g, [0, y, 0], [0, type === 'trombone' ? 0 : 0.25, 0]);
  const path = type === 'trombone'
    ? [[-0.3, 0, 0.06], [0.3, 0, 0.06], [0.37, 0, 0.0], [0.3, 0, -0.06], [-0.3, 0, -0.06]]
    : [[-0.28 * s, 0, 0.03], [0.22 * s, 0, 0.03], [0.3 * s, 0.0, -0.04 * s], [0.2 * s, 0.0, -0.1 * s], [-0.18 * s, 0.0, -0.1 * s], [-0.26 * s, 0.0, -0.04 * s], [-0.18 * s, 0.0, 0.0], [0.12 * s, 0.0, 0.0]];
  const tube = pipe(body, M.brass(), path, bore * s, 140);
  zone(tube, { voice, note: base }, { press: 'bounce' });
  const bellX = type === 'trombone' ? -0.3 : -0.28 * s;
  const bell = add(body, lathe([[0.012, 0], [0.02, 0.05], [0.05 * s, 0.14 * s], [0.1 * s, 0.22 * s], [0.14 * s, 0.26 * s], [0.141 * s, 0.262 * s], [0.13 * s, 0.262 * s]], 48), M.brass(), [bellX - 0.02, 0, 0.03], [0, 0, Math.PI / 2]);
  bell.rotation.z = Math.PI / 2;
  zone(bell, { voice, note: base + 5 }, { press: 'bounce' });
  mouthpiece(body, [0.3 * s, 0, -0.03], [0, 0, -Math.PI / 2]);
  if (type !== 'trombone') {
    [0, 1, 2].forEach((i) => {
      const v = group(body, [-0.02 + i * 0.045, 0.0, 0.0]);
      add(v, cyl(0.016, 0.016, 0.1, 18), M.brass(), [0, 0.03, 0]);
      const button = add(v, cyl(0.011, 0.011, 0.02, 14), M.plastic('#f2efe4'), [0, 0.1, 0]);
      zone(button, { voice, note: base - [2, 1, 3][i] }, { press: 'key' });
      add(v, torus(0.016, 0.003, 16), M.brass(), [0, 0.08, 0], [Math.PI / 2, 0, 0]);
    });
  }
};

export const buildSax = (g) => {
  add(g, cyl(0.2, 0.22, 0.02, 24), M.rubber('#101012'), [0, 0.01, 0]);
  rod(g, M.chrome(), [0, 0.02, 0], [0, 0.55, 0], 0.012);
  const body = pipe(g, M.gold(), [[0.05, 1.12, 0.0], [0.0, 1.02, 0], [0.0, 0.6, 0], [0.0, 0.32, 0.02], [0.08, 0.2, 0.06], [0.2, 0.22, 0.08], [0.24, 0.34, 0.08]], 0.024, 140);
  zone(body, { voice: 'sax', note: 62 }, { press: 'bounce' });
  const bell = add(g, lathe([[0.02, 0], [0.04, 0.05], [0.09, 0.12], [0.1, 0.13]], 40), M.gold(), [0.245, 0.34, 0.08], [Math.PI, 0, 0]);
  zone(bell, { voice: 'sax', note: 56 }, { press: 'bounce' });
  pipe(g, M.gold(), [[0.05, 1.12, 0], [0.12, 1.2, 0], [0.18, 1.22, 0]], 0.009, 30);
  mouthpiece(g, [0.2, 1.22, 0], [0, 0, -Math.PI / 2]);
  for (let i = 0; i < 8; i += 1) {
    const k = add(g, cyl(0.013, 0.013, 0.012, 14), M.metal('#f3f0e2', 0.15), [0.0, 0.95 - i * 0.055, 0.026], [Math.PI / 2, 0, 0]);
    zone(k, { voice: 'sax', note: 74 - i * 2 }, { press: 'key' });
  }
};

export const buildWoodwind = (g, type = 'clarinet') => {
  const spec = { clarinet: { len: 0.6, r: 0.014, voice: 'clarinet', base: 65, color: '#101014' }, flute: { len: 0.66, r: 0.01, voice: 'flute', base: 72, color: '#d8d8de' }, oboe: { len: 0.58, r: 0.012, voice: 'oboe', base: 70, color: '#16120e' }, bassoon: { len: 0.9, r: 0.02, voice: 'bassoon', base: 46, color: '#5a2a12' }, harmonica: { len: 0.2, r: 0.02, voice: 'harmonica', base: 72, color: '#d8d8de' } }[type];
  if (type === 'harmonica') {
    const h = add(g, rbox(0.2, 0.04, 0.06, 0.008), M.metal('#d8d8de', 0.15), [0, 0.9, 0]);
    zone(h, { voice: 'harmonica', note: 72 }, { press: 'bounce' });
    for (let i = 0; i < 10; i += 1) { const hole = add(g, box(0.012, 0.018, 0.004), M.rubber('#050505'), [-0.08 + i * 0.0175, 0.9, 0.031]); zone(hole, { voice: 'harmonica', note: 60 + i * 2 }, { press: 'key' }); }
    rod(g, M.chrome(), [0, 0.0, 0], [0, 0.88, 0], 0.01); add(g, cyl(0.15, 0.17, 0.02, 20), M.rubber('#101012'), [0, 0.01, 0]);
    return;
  }
  add(g, cyl(0.2, 0.22, 0.02, 24), M.rubber('#101012'), [0, 0.01, 0]);
  rod(g, M.chrome(), [0, 0.02, 0], [0, 0.55, 0], 0.012);
  const pose = group(g, [0, 0.95, 0], [0, 0, 0.35]);
  const tube = add(pose, cyl(spec.r, spec.r, spec.len, 28), type === 'flute' ? M.metal(spec.color, 0.12) : M.paint(spec.color, 0.2), [0, 0, 0], [0, 0, Math.PI / 2]);
  zone(tube, { voice: spec.voice, note: spec.base }, { press: 'bounce' });
  if (type === 'clarinet') add(pose, lathe([[0.014, 0], [0.025, 0.04], [0.05, 0.1], [0.052, 0.102]], 36), M.paint(spec.color, 0.2), [spec.len / 2, 0, 0], [0, 0, -Math.PI / 2]);
  for (let i = 0; i < 6; i += 1) {
    const k = add(pose, cyl(0.011, 0.011, 0.008, 14), M.metal('#e9e6da', 0.14), [-0.2 + i * 0.075, 0.0, spec.r + 0.003], [Math.PI / 2, 0, 0]);
    zone(k, { voice: spec.voice, note: spec.base + 2 * (5 - i) }, { press: 'key' });
    add(pose, rbox(0.008, 0.004, 0.06, 0.002), M.metal('#e9e6da', 0.15), [-0.2 + i * 0.075, 0, spec.r - 0.001]);
  }
};
