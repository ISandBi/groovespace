import { M, add, box, cyl, group, knob, lathe, rbox, rod, sphere, torus, zone } from './kit';

// Percusión: cada pieza golpeable declara su voz en userData.sound (kick, snare, tom, hihat, crash, ride, conga…).

const shell = (g, { r, h, color, pos, rot = [0, 0, 0], voice, note, headTop = true }) => {
  const d = group(g, pos, rot);
  const body = add(d, cyl(r, r, h, 56), M.pearl(color));
  body.position.y = h / 2;
  zone(body, { voice, note });
  [0, h].forEach((y) => {
    add(d, torus(r, 0.007, 64), M.chrome(), [0, y, 0], [Math.PI / 2, 0, 0]);
  });
  const head = add(d, cyl(r * 0.985, r * 0.985, 0.006, 56), M.head(), [0, h + 0.004, 0]);
  zone(head, { voice, note }, { press: 'bounce' });
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    add(d, cyl(0.007, 0.007, 0.03, 10), M.chrome(), [Math.cos(a) * (r + 0.004), h - 0.02, Math.sin(a) * (r + 0.004)]);
    add(d, cyl(0.007, 0.007, 0.03, 10), M.chrome(), [Math.cos(a) * (r + 0.004), 0.04, Math.sin(a) * (r + 0.004)]);
  }
  return d;
};

const cymbal = (g, { r, pos, tilt = 0.08, voice, height }) => {
  const c = group(g, pos);
  rod(c, M.chrome(), [0, -pos[1] + 0.02, 0], [0, 0, 0], 0.011);
  rod(c, M.chrome(), [0, -pos[1] + 0.02, 0], [0.18, -pos[1] + 0.02, 0.18], 0.009);
  rod(c, M.chrome(), [0, -pos[1] + 0.02, 0], [-0.18, -pos[1] + 0.02, 0.18], 0.009);
  rod(c, M.chrome(), [0, -pos[1] + 0.02, 0], [0, -pos[1] + 0.02, -0.2], 0.009);
  const plate = group(c, [0, 0.02, 0], [tilt, 0, 0]);
  const disk = add(plate, lathe([[0, 0.028], [0.025, 0.03], [0.05, 0.022], [r * 0.5, 0.004], [r, 0], [r, -0.003], [r * 0.5, 0.001], [0.05, 0.016], [0, 0.02]], 64), M.cymbal());
  zone(disk, { voice, note: undefined }, { press: 'swing' });
  add(plate, cyl(0.012, 0.012, 0.05, 12), M.chrome(), [0, 0.02, 0]);
  return c;
};

export const buildDrums = (g) => {
  const stool = group(g, [0, 0, -0.62]);
  add(stool, cyl(0.17, 0.17, 0.06, 32), M.rubber('#1b1b1f'), [0, 0.5, 0]);
  [0, 1, 2].forEach((i) => { const a = (i / 3) * Math.PI * 2; rod(stool, M.chrome(), [0, 0.48, 0], [Math.cos(a) * 0.22, 0.02, Math.sin(a) * 0.22], 0.012); });
  rod(stool, M.chrome(), [0, 0.5, 0], [0, 0.2, 0], 0.018);

  // Bombo: tambor horizontal (eje z)
  const kick = group(g, [0, 0.36, 0.05], [Math.PI / 2, 0, 0]);
  const kickBody = add(kick, cyl(0.28, 0.28, 0.42, 56), M.pearl('#a31d2e'));
  zone(kickBody, { voice: 'kick' }, { press: 'bounce' });
  const front = add(kick, cyl(0.275, 0.275, 0.006, 56), M.head(), [0, 0.215, 0]);
  zone(front, { voice: 'kick' }, { press: 'bounce' });
  [-0.215, 0.215].forEach((y) => add(kick, torus(0.28, 0.01, 64), M.chrome(), [0, y, 0], [Math.PI / 2, 0, 0]));
  // Pedal
  add(g, box(0.12, 0.012, 0.28), M.metal(), [0, 0.012, 0.52]);
  rod(g, M.chrome(), [0, 0.03, 0.55], [0, 0.34, 0.4], 0.008);
  add(g, sphere(0.03), M.rubber('#222'), [0, 0.35, 0.39]);
  [-0.22, 0.22].forEach((x) => rod(g, M.chrome(), [x, 0.05, 0.22], [x * 1.4, 0.0, 0.34], 0.011));

  // Redoblante
  const snareStand = group(g, [-0.32, 0, 0.42]);
  rod(snareStand, M.chrome(), [0, 0.02, 0], [0, 0.55, 0], 0.011);
  [0, 1, 2].forEach((i) => { const a = (i / 3) * Math.PI * 2; rod(snareStand, M.chrome(), [0, 0.08, 0], [Math.cos(a) * 0.2, 0.01, Math.sin(a) * 0.2], 0.008); });
  shell(g, { r: 0.18, h: 0.14, color: '#d9d9de', pos: [-0.32, 0.55, 0.42], voice: 'snare' });
  add(g, box(0.3, 0.03, 0.03), M.chrome(), [-0.32, 0.56, 0.42]);

  // Toms montados en el bombo + tom de piso
  rod(g, M.chrome(), [-0.12, 0.62, 0.0], [-0.12, 0.72, -0.05], 0.011);
  rod(g, M.chrome(), [0.12, 0.62, 0.0], [0.12, 0.72, -0.05], 0.011);
  shell(g, { r: 0.15, h: 0.18, color: '#a31d2e', pos: [-0.15, 0.7, -0.07], rot: [-0.25, 0, 0.05], voice: 'tom', note: 50 });
  shell(g, { r: 0.17, h: 0.2, color: '#a31d2e', pos: [0.17, 0.69, -0.07], rot: [-0.25, 0, -0.05], voice: 'tom', note: 47 });
  const floorTom = shell(g, { r: 0.24, h: 0.42, color: '#a31d2e', pos: [0.58, 0.28, 0.1], voice: 'tom', note: 41 });
  [0, 1, 2].forEach((i) => { const a = (i / 3) * Math.PI * 2 + 0.4; rod(floorTom, M.chrome(), [Math.cos(a) * 0.23, 0.36, Math.sin(a) * 0.23], [Math.cos(a) * 0.3, -0.27, Math.sin(a) * 0.3], 0.011); });

  // Hi-hat
  const hat = group(g, [-0.62, 0, 0.3]);
  rod(hat, M.chrome(), [0, 0.02, 0], [0, 0.95, 0], 0.01);
  [0, 1, 2].forEach((i) => { const a = (i / 3) * Math.PI * 2; rod(hat, M.chrome(), [0, 0.1, 0], [Math.cos(a) * 0.2, 0.01, Math.sin(a) * 0.2], 0.008); });
  cymbal(hat, { r: 0.18, pos: [0, 0.98, 0], tilt: 0.03, voice: 'hihat' });
  cymbal(hat, { r: 0.18, pos: [0, 0.95, 0], tilt: -0.03, voice: 'hihat' });
  cymbal(g, { r: 0.22, pos: [-0.36, 1.2, -0.28], tilt: 0.12, voice: 'crash' });
  cymbal(g, { r: 0.26, pos: [0.5, 1.12, -0.32], tilt: 0.1, voice: 'ride' });
  cymbal(g, { r: 0.21, pos: [0.22, 1.28, -0.48], tilt: 0.14, voice: 'crash' });
};

export const buildCymbals = (g) => {
  const hat = group(g, [-0.35, 0, 0]);
  rod(hat, M.chrome(), [0, 0.02, 0], [0, 0.95, 0], 0.01);
  [0, 1, 2].forEach((i) => { const a = (i / 3) * Math.PI * 2; rod(hat, M.chrome(), [0, 0.1, 0], [Math.cos(a) * 0.22, 0.01, Math.sin(a) * 0.22], 0.008); });
  cymbal(hat, { r: 0.19, pos: [0, 0.98, 0], tilt: 0.03, voice: 'hihat' });
  cymbal(hat, { r: 0.19, pos: [0, 0.95, 0], tilt: -0.03, voice: 'hihat' });
  cymbal(g, { r: 0.24, pos: [0.15, 1.3, 0], tilt: 0.12, voice: 'crash' });
  cymbal(g, { r: 0.28, pos: [0.65, 1.15, 0.05], tilt: 0.1, voice: 'ride' });
};

export const buildConga = (g) => {
  const drum = (x, r, h, voice, note) => {
    const d = group(g, [x, 0, 0], [0, 0, x > 0 ? -0.06 : 0.06]);
    const body = add(d, lathe([[0.05, 0], [r * 0.7, 0.04], [r * 0.95, h * 0.55], [r, h * 0.9], [r, h]], 56), M.satin('#a8561d', 0.4));
    body.position.y = 0.2;
    zone(body, { voice, note });
    const head = add(d, cyl(r * 0.99, r * 0.99, 0.008, 56), M.head(), [0, h + 0.2, 0]);
    zone(head, { voice, note }, { press: 'bounce' });
    add(d, torus(r, 0.012, 64), M.chrome(), [0, h + 0.2, 0], [Math.PI / 2, 0, 0]);
    add(d, torus(r * 0.82, 0.008, 48), M.chrome(), [0, h * 0.55 + 0.2, 0], [Math.PI / 2, 0, 0]);
    [0, 1, 2].forEach((i) => { const a = (i / 3) * Math.PI * 2; rod(d, M.chrome(), [Math.cos(a) * 0.07, 0.02, Math.sin(a) * 0.07], [Math.cos(a) * 0.17, 0.22, Math.sin(a) * 0.17], 0.01); });
  };
  drum(-0.18, 0.13, 0.7, 'conga', 55);
  drum(0.18, 0.15, 0.72, 'conga', 50);
  const bongos = group(g, [0, 0.74, 0.34], [0.25, 0, 0]);
  [-0.07, 0.07].forEach((x, i) => {
    const b = add(bongos, cyl(0.07 + i * 0.01, 0.055 + i * 0.01, 0.16, 36), M.satin('#c9904a', 0.4), [x, 0, 0]);
    zone(b, { voice: 'bongo', note: 62 - i * 5 });
    zone(add(bongos, cyl(0.068 + i * 0.01, 0.068 + i * 0.01, 0.006, 36), M.head(), [x, 0.083, 0]), { voice: 'bongo', note: 62 - i * 5 }, { press: 'bounce' });
  });
  rod(g, M.chrome(), [0, 0.7, 0.3], [0, 0.0, 0.36], 0.008);
};

export const buildTimpani = (g) => {
  [{ x: -0.4, r: 0.36, note: 43 }, { x: 0.38, r: 0.31, note: 50 }].forEach(({ x, r, note }) => {
    const t = group(g, [x, 0, 0]);
    const bowl = add(t, lathe([[0.04, 0], [r * 0.5, 0.06], [r * 0.85, 0.22], [r * 0.98, 0.36], [r, 0.4]], 64), M.copper ? M.copper() : M.brass(), [0, 0.35, 0]);
    zone(bowl, { voice: 'timpani', note });
    zone(add(t, cyl(r * 0.99, r * 0.99, 0.008, 64), M.head(), [0, 0.75, 0]), { voice: 'timpani', note }, { press: 'bounce' });
    add(t, torus(r, 0.014, 64), M.chrome(), [0, 0.75, 0], [Math.PI / 2, 0, 0]);
    [0, 1, 2].forEach((i) => { const a = (i / 3) * Math.PI * 2 + 0.5; rod(t, M.chrome(), [Math.cos(a) * 0.08, 0.38, Math.sin(a) * 0.08], [Math.cos(a) * 0.3, 0.02, Math.sin(a) * 0.3], 0.014); });
    add(t, cyl(0.02, 0.02, 0.4, 14), M.chrome(), [0, 0.2, 0]);
    add(t, torus(r * 0.5, 0.014, 48), M.chrome(), [0, 0.1, 0], [Math.PI / 2, 0, 0]);
  });
};

export const buildMallet = (g, voice = 'xylophone') => {
  const wood = voice !== 'vibraphone';
  const count = 18;
  const frame = group(g, [0, 0.78, 0], [0.12, 0, 0]);
  add(frame, rbox(1.5, 0.04, 0.05, 0.01), M.wood('#4a2a14', true), [0, -0.03, 0.26]);
  add(frame, rbox(1.5, 0.04, 0.05, 0.01), M.wood('#4a2a14', true), [0, -0.03, -0.26]);
  for (let i = 0; i < count; i += 1) {
    const w = 0.066;
    const len = 0.34 - i * 0.011;
    const x = (i - (count - 1) / 2) * (w + 0.012);
    const bar = add(frame, rbox(w, 0.024, len, 0.006), wood ? M.wood(i % 2 ? '#c98a4b' : '#d79b5c', true) : M.metal('#cfd2d8', 0.2), [x, 0.012, 0]);
    zone(bar, { voice, note: 65 + i }, { press: 'bounce' });
    if (!wood) add(frame, cyl(0.02, 0.02, 0.3, 14), M.metal('#9aa'), [x, -0.14, -0.1], [0, 0, 0]);
  }
  [-0.68, 0.68].forEach((x) => [-0.22, 0.22].forEach((z) => rod(g, M.chrome(), [x, 0.04, z * 1.3], [x, 0.74, z], 0.014)));
};

export const buildPercussionSmall = (g, kind = 'pad') => {
  if (kind === 'cajon') {
    const c = add(g, rbox(0.3, 0.47, 0.3, 0.012), M.wood('#c79757', false), [0, 0.235, 0]);
    zone(c, { voice: 'cajon' }, { press: 'bounce' });
    add(g, cyl(0.045, 0.045, 0.01, 24), M.rubber('#111'), [0, 0.25, 0.155], [Math.PI / 2, 0, 0]);
    return;
  }
  const base = add(g, rbox(0.6, 0.06, 0.6, 0.02), M.plastic('#25232c'), [0, 0.8, 0]);
  rod(g, M.chrome(), [0, 0.0, 0], [0, 0.78, 0], 0.012);
  [0, 1, 2].forEach((i) => { const a = (i / 3) * Math.PI * 2; rod(g, M.chrome(), [0, 0.1, 0], [Math.cos(a) * 0.3, 0.01, Math.sin(a) * 0.3], 0.01); });
  for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) {
    const pad = add(g, rbox(0.15, 0.025, 0.15, 0.01), M.glow(['#c2ff3c', '#ff5d8f', '#b28aff'][(r + c) % 3]), [(c - 1) * 0.18, 0.84, (r - 1) * 0.18 + 0.0]);
    zone(pad, { voice: 'pad', note: 36 + r * 3 + c }, { press: 'bounce' });
  }
  return base;
};

export const buildTurntable = (g) => {
  const table = add(g, rbox(0.9, 0.09, 0.55, 0.02), M.satin('#18171d', 0.35), [0, 0.95, 0]);
  rod(g, M.chrome(), [-0.4, 0.0, -0.2], [-0.4, 0.9, -0.2], 0.018);
  rod(g, M.chrome(), [0.4, 0.0, -0.2], [0.4, 0.9, -0.2], 0.018);
  [-0.2, 0.2].forEach((x) => {
    const platter = add(g, cyl(0.2, 0.2, 0.02, 56), M.metal('#2a2a31', 0.3), [x - 0.12, 1.01, 0.0]);
    zone(platter, { voice: 'turntable' }, { press: 'spin' });
    add(g, cyl(0.17, 0.17, 0.004, 56), M.rubber('#07070a'), [x - 0.12, 1.022, 0]);
    add(g, cyl(0.04, 0.04, 0.005, 24), M.glow('#c2ff3c'), [x - 0.12, 1.026, 0]);
  });
  const mixer = add(g, rbox(0.22, 0.06, 0.4, 0.015), M.satin('#101015', 0.4), [0.02, 1.0, 0]);
  zone(mixer, { voice: 'pad', note: 40 });
  for (let i = 0; i < 4; i += 1) knob(g, M.chrome(), [-0.05 + (i % 2) * 0.08, 1.03, -0.1 + Math.floor(i / 2) * 0.12], 0.014, 0.014);
  const surface = add(g, box(0.02, 0.01, 0.02), M.glow('#ff5d8f'), [0.02, 1.035, 0.14]);
  return surface;
};

export const buildPedalboard = (g) => {
  add(g, rbox(0.8, 0.04, 0.32, 0.01), M.metal('#3b3b44', 0.4), [0, 0.03, 0]);
  ['#c2ff3c', '#ff5d8f', '#b28aff', '#ffb84d', '#55c7ff'].forEach((c, i) => {
    const p = add(g, rbox(0.12, 0.05, 0.14, 0.012), M.paint(c, 0.25), [-0.31 + i * 0.155, 0.075, 0.02]);
    zone(p, { voice: 'pedal', note: 40 + i * 2 }, { press: 'bounce' });
    knob(g, M.chrome(), [-0.31 + i * 0.155, 0.1, -0.03], 0.013, 0.014);
    add(g, cyl(0.02, 0.02, 0.01, 18), M.chrome(), [-0.31 + i * 0.155, 0.103, 0.07]);
  });
};

export const buildMic = (g) => {
  add(g, cyl(0.2, 0.22, 0.025, 36), M.metal('#1b1b20', 0.3), [0, 0.012, 0]);
  rod(g, M.chrome(), [0, 0.02, 0], [0, 1.3, 0], 0.014);
  rod(g, M.chrome(), [0, 1.3, 0], [0, 1.5, 0.12], 0.011);
  const head = add(g, sphere(0.045, 28), M.grille('#aaaab6'), [0, 1.56, 0.17]);
  zone(head, { voice: 'mic' }, { press: 'bounce' });
  add(g, lathe([[0.03, 0], [0.04, 0.1], [0.032, 0.18]], 28), M.metal('#202026', 0.3), [0, 1.47, 0.14], [0.9, 0, 0]);
};

export const buildAmp = (g, { bass = false } = {}) => {
  const w = bass ? 0.7 : 0.62; const h = bass ? 0.9 : 0.55; const d = 0.34;
  const body = add(g, rbox(w, h, d, 0.018), M.tolex(bass ? '#19191f' : '#16171b'), [0, h / 2 + 0.03, 0]);
  zone(body, { voice: 'amp' });
  const grille = add(g, rbox(w - 0.07, h - 0.2, 0.02, 0.008), M.grille(bass ? '#26252b' : '#2b2a33'), [0, h / 2 - 0.04 + 0.03, d / 2 + 0.002]);
  zone(grille, { voice: 'amp' }, { press: 'bounce' });
  add(g, rbox(w + 0.005, 0.07, d + 0.005, 0.015), M.tolex('#101014'), [0, h + 0.05, 0]);
  const panel = add(g, rbox(w - 0.06, 0.09, 0.012, 0.006), M.metal('#2b2b30', 0.3), [0, h - 0.02 + 0.03 + 0.1, d / 2 + 0.002]);
  for (let i = 0; i < 6; i += 1) knob(g, M.chrome(), [-0.2 + i * 0.08, h + 0.11, d / 2 + 0.008], 0.017, 0.02, [Math.PI / 2, 0, 0]);
  add(g, sphere(0.008), M.glow('#ff5d8f'), [0.24, h + 0.11, d / 2 + 0.01]);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => add(g, cyl(0.02, 0.02, 0.03, 12), M.rubber('#08080a'), [x * (w / 2 - 0.04), 0.015, z * (d / 2 - 0.04)]));
  return panel;
};

export const buildCase = (g) => {
  const c = add(g, rbox(0.7, 0.28, 0.32, 0.03), M.tolex('#1b1a22'), [0, 0.2, 0]);
  zone(c, { voice: 'pad', note: 45 }, { press: 'bounce' });
  [-0.2, 0.2].forEach((x) => add(g, rbox(0.06, 0.03, 0.01, 0.005), M.chrome(), [x, 0.22, 0.165]));
  add(g, torus(0.07, 0.01, 24), M.chrome(), [0, 0.36, 0], [Math.PI / 2, 0, 0], [1.6, 1, 1]);
  [-0.3, 0.3].forEach((x) => add(g, cyl(0.02, 0.02, 0.02, 12), M.rubber('#08080a'), [x, 0.03, 0.12]));
};
