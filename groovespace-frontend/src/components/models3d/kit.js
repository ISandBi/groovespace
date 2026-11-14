import {
  BoxGeometry, CanvasTexture, CatmullRomCurve3, CylinderGeometry, ExtrudeGeometry, Group, LatheGeometry, Mesh,
  MeshPhysicalMaterial, RepeatWrapping, SRGBColorSpace, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Todos los modelos: de pie sobre y = 0, centrados en x/z, frente hacia +z. Unidades en metros.

// ───────────── Texturas procedurales (canvas): dan detalle de "modelo de Blender" sin archivos ─────────────
const textures = new Map();
const rng = (seed) => { let v = seed; return () => { v = (v * 16807) % 2147483647; return v / 2147483647; }; };

const canvasTexture = (key, size, repeat, color, paint) => {
  if (typeof document === 'undefined') return null;
  if (textures.has(key)) return textures.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  paint(canvas.getContext('2d'), size, rng(7919));
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping; texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 8;
  if (color) texture.colorSpace = SRGBColorSpace;
  textures.set(key, texture);
  return texture;
};

const wood = (base, dark = 0.16) => canvasTexture(`wood:${base}:${dark}`, 512, 1, true, (ctx, size, random) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 300; i += 1) {
    const x = random() * size; const w = (random() - 0.5) * 20;
    ctx.strokeStyle = random() > 0.5 ? `rgba(255,235,200,${0.03 + random() * 0.08})` : `rgba(20,8,0,${0.05 + random() * dark})`;
    ctx.lineWidth = 0.5 + random() * 2.6;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + w, size * 0.33, x - w, size * 0.66, x + w * 0.4, size); ctx.stroke();
  }
  // Nudos suaves
  for (let k = 0; k < 3; k += 1) { const x = random() * size; const y = random() * size; const g = ctx.createRadialGradient(x, y, 1, x, y, 26); g.addColorStop(0, 'rgba(30,12,0,.35)'); g.addColorStop(1, 'rgba(30,12,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 30, y - 30, 60, 60); }
});

const brushed = () => canvasTexture('brushed', 512, 1, false, (ctx, size, random) => {
  ctx.fillStyle = '#8a8a8a'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 700; i += 1) { ctx.strokeStyle = `rgba(${random() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + random() * 0.09})`; ctx.lineWidth = 0.4 + random() * 1.1; const y = random() * size; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y + (random() - 0.5) * 3); ctx.stroke(); }
});

// Anillos concéntricos de torneado (platillos): se usa como mapa de rugosidad.
const rings = () => canvasTexture('rings', 512, 1, false, (ctx, size, random) => {
  ctx.fillStyle = '#777'; ctx.fillRect(0, 0, size, size);
  for (let r = 4; r < size / 2; r += 1.4) { ctx.strokeStyle = `rgba(${random() > 0.5 ? '255,255,255' : '0,0,0'},${0.05 + random() * 0.18})`; ctx.lineWidth = 0.6 + random() * 1.2; ctx.beginPath(); ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2); ctx.stroke(); }
});

const pebble = () => canvasTexture('pebble', 256, 8, false, (ctx, size, random) => {
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 6000; i += 1) { const v = Math.floor(random() * 255); ctx.fillStyle = `rgba(${v},${v},${v},.5)`; ctx.fillRect(random() * size, random() * size, 1.6, 1.6); }
});

const weave = () => canvasTexture('weave', 256, 14, false, (ctx, size) => {
  ctx.fillStyle = '#6a6a6a'; ctx.fillRect(0, 0, size, size);
  const step = 8;
  for (let y = 0; y < size; y += step) for (let x = 0; x < size; x += step) { ctx.fillStyle = (x / step + y / step) % 2 ? '#bcbcbc' : '#3e3e3e'; ctx.fillRect(x + 1, y + 1, step - 2, step - 2); }
});

const head = () => canvasTexture('head', 512, 1, true, (ctx, size, random) => {
  const g = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#f3efe6'); g.addColorStop(0.85, '#e5dfd1'); g.addColorStop(1, '#cfc7b4');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1500; i += 1) { ctx.fillStyle = `rgba(120,110,90,${random() * 0.06})`; ctx.fillRect(random() * size, random() * size, 2, 2); }
  ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.18, 0, Math.PI * 2); ctx.stroke();
});

const sparkle = (color) => canvasTexture(`sparkle:${color}`, 512, 3, true, (ctx, size, random) => {
  ctx.fillStyle = color; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i += 1) { ctx.fillStyle = `rgba(255,255,255,${random() * 0.45})`; ctx.fillRect(random() * size, random() * size, 1.3, 1.3); }
});

// ───────────── Materiales (físicos: clearcoat, sheen, iridiscencia). Se comparten entre modelos ─────────────
const materials = new Map();
const cached = (key, make) => { if (!materials.has(key)) { const material = make(); material.userData.shared = true; materials.set(key, material); } return materials.get(key); };

export const M = {
  paint: (color, rough = 0.18) => cached(`paint:${color}:${rough}`, () => new MeshPhysicalMaterial({ color, roughness: rough, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3 })),
  satin: (color, rough = 0.5) => cached(`satin:${color}:${rough}`, () => new MeshPhysicalMaterial({ color, roughness: rough, metalness: 0.1, clearcoat: 0.25, clearcoatRoughness: 0.45 })),
  wood: (color, gloss = true) => cached(`wood:${color}:${gloss}`, () => { const map = wood(color); return new MeshPhysicalMaterial({ color: map ? '#ffffff' : color, map, bumpMap: map, bumpScale: 0.5, roughness: gloss ? 0.32 : 0.62, clearcoat: gloss ? 0.8 : 0.1, clearcoatRoughness: 0.12 }); }),
  metal: (color = '#d8d8de', rough = 0.22) => cached(`metal:${color}:${rough}`, () => { const map = brushed(); return new MeshPhysicalMaterial({ color, metalness: 1, roughness: Math.min(1, rough * 1.5), roughnessMap: map, envMapIntensity: 1.7 }); }),
  chrome: () => cached('chrome', () => new MeshPhysicalMaterial({ color: '#f2f2f6', metalness: 1, roughness: 0.06, envMapIntensity: 2 })),
  brass: () => cached('brass', () => new MeshPhysicalMaterial({ color: '#d9a93d', metalness: 1, roughness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.1, envMapIntensity: 1.8 })),
  gold: () => cached('gold', () => new MeshPhysicalMaterial({ color: '#e7c15a', metalness: 1, roughness: 0.14, envMapIntensity: 2 })),
  cymbal: () => cached('cymbal', () => { const map = rings(); return new MeshPhysicalMaterial({ color: '#d4a63e', metalness: 1, roughness: 0.35, roughnessMap: map, bumpMap: map, bumpScale: 0.25, envMapIntensity: 1.9, side: 2 }); }),
  rubber: (color = '#121214') => cached(`rubber:${color}`, () => new MeshPhysicalMaterial({ color, roughness: 0.85, metalness: 0 })),
  tolex: (color = '#16171b') => cached(`tolex:${color}`, () => { const map = pebble(); return new MeshPhysicalMaterial({ color, roughness: 0.78, bumpMap: map, bumpScale: 1.6, sheen: 0.6, sheenRoughness: 0.6, sheenColor: '#4a4f5c' }); }),
  grille: (color = '#1d1c22') => cached(`grille:${color}`, () => { const map = weave(); return new MeshPhysicalMaterial({ color, roughness: 0.95, bumpMap: map, bumpScale: 1.1, sheen: 0.3, sheenColor: '#3a3a44' }); }),
  head: () => cached('head', () => { const map = head(); return new MeshPhysicalMaterial({ color: '#ffffff', map, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4, side: 2 }); }),
  pearl: (color) => cached(`pearl:${color}`, () => { const map = sparkle(color); return new MeshPhysicalMaterial({ color: '#ffffff', map, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.4, iridescenceIOR: 1.5, metalness: 0.15, envMapIntensity: 1.4 }); }),
  fret: () => cached('fret', () => new MeshPhysicalMaterial({ color: '#cfd0d6', metalness: 1, roughness: 0.18, envMapIntensity: 1.6 })),
  string: (wound = false) => cached(`string:${wound}`, () => new MeshPhysicalMaterial({ color: wound ? '#b9b3a4' : '#e8e8ee', metalness: 1, roughness: wound ? 0.38 : 0.12, envMapIntensity: 1.6 })),
  plastic: (color) => cached(`plastic:${color}`, () => new MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2 })),
  glow: (color) => cached(`glow:${color}`, () => new MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 1.4, roughness: 0.4 }))
};

export const releaseSharedAssets = () => {
  materials.forEach((material) => material.dispose());
  materials.clear();
  textures.forEach((texture) => texture.dispose());
  textures.clear();
};

// ───────────── Geometría con bisel ("bevel"): evita los bordes afilados de plástico de juguete ─────────────
export const rbox = (w, h, d, radius = 0.01, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(radius, w / 2.01, h / 2.01, d / 2.01));

/** Sólido de revolución a partir de un perfil [[radio, y], ...] (casco de tambor, campana, platillo, micrófono…). */
export const lathe = (profile, segments = 64) => new LatheGeometry(profile.map(([x, y]) => new Vector2(x, y)), segments);

/** Extruye una silueta (Shape) con bisel redondeado: cuerpos de guitarra, violín, etc. */
export const extrude = (shape, depth, bevel = 0.006) => {
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 40 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
};

export const outline = (points) => {
  // points: [[x, y], ...] con curvas Catmull-Rom cerradas → Shape suave
  const curve = new CatmullRomCurve3(points.map(([x, y]) => new Vector3(x, y, 0)), true, 'catmullrom', 0.5);
  const shape = new Shape();
  curve.getPoints(120).forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
  return shape;
};

export const add = (parent, geometry, material, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) => {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(...pos); mesh.rotation.set(...rot); mesh.scale.set(...scl);
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

export const group = (parent, pos = [0, 0, 0], rot = [0, 0, 0]) => { const g = new Group(); g.position.set(...pos); g.rotation.set(...rot); parent.add(g); return g; };

/** Cilindro redondeado entre dos puntos (patas, postes, barras). */
export const rod = (parent, material, a, b, radius = 0.012, seg = 14) => {
  const from = new Vector3(...a); const to = new Vector3(...b); const dir = to.clone().sub(from);
  const mesh = new Mesh(new CylinderGeometry(radius, radius, dir.length(), seg), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true; parent.add(mesh);
  return mesh;
};

export const pipe = (parent, material, points, radius, segments = 90) => add(parent, new TubeGeometry(new CatmullRomCurve3(points.map((p) => new Vector3(...p))), segments, radius, 14, false), material);

export const knob = (parent, material, pos, radius = 0.014, height = 0.016, rot = [0, 0, 0]) => {
  const g = group(parent, pos, rot);
  add(g, lathe([[0, 0], [radius * 1.05, 0], [radius * 1.05, height * 0.6], [radius * 0.9, height], [0, height]], 28), material);
  return g;
};

export const sphere = (r, seg = 24) => new SphereGeometry(r, seg, Math.round(seg * 0.75));
export const cyl = (rt, rb, h, seg = 32) => new CylinderGeometry(rt, rb, h, seg);
export const torus = (r, tube, seg = 48) => new TorusGeometry(r, tube, 12, seg);
export const box = (w, h, d) => new BoxGeometry(w, h, d);

/** Marca un mesh como zona táctil con su voz sonora. `swing` hace oscilar platillos al golpearlos. */
export const zone = (mesh, sound, extra = {}) => { mesh.userData.sound = sound; Object.assign(mesh.userData, extra); return mesh; };
