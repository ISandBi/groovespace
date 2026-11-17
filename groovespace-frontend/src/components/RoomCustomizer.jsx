import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IcMinimize, IcMaximize, IcSave } from '../ui/icons.jsx';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BackSide,
  Box3,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  Plane,
  Raycaster,
  RepeatWrapping,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { API_ORIGIN, API_URL } from '../api';
import { createInstrumentModel, releaseSharedAssets } from './InstrumentModels3D';
import { createSoundEngine, noteName } from './InstrumentSounds';

const LIMIT_X = 6.3;
const LIMIT_Z = 4.3;
const MAX_SAVED_INSTRUMENTS = 12;

// ---------- Texturas procedurales ----------
const woodTexture = (base, planks, repeatX, repeatY) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  const width = 512 / planks;
  for (let i = 0; i < planks; i += 1) {
    const noise = (Math.sin(i * 12.9898 + 4.1) * 43758.5453) % 1;
    const shade = Math.abs(noise);
    ctx.fillStyle = shade > 0.5 ? `rgba(255,220,170,${(shade - 0.5) * 0.28})` : `rgba(0,0,0,${shade * 0.3})`;
    ctx.fillRect(i * width, 0, width, 512);
    for (let g = 0; g < 7; g += 1) {
      const gx = i * width + ((Math.abs(Math.sin(i * 7.7 + g * 3.3)) * 0.8 + 0.1) * width);
      ctx.fillStyle = 'rgba(40,20,5,.14)';
      ctx.fillRect(gx, 0, 1, 512);
    }
    ctx.fillStyle = 'rgba(20,8,0,.45)';
    ctx.fillRect(i * width, 0, 1.5, 512);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

const woodMaterial = (base, planks, rx, ry, extra = {}) =>
  new MeshStandardMaterial({ map: woodTexture(base, planks, rx, ry), roughness: 0.62, ...extra });

// ---------- Salas ----------
const buildOrchestraHall = (scene) => {
  // Cascarón interior: sólo se ve desde adentro, así la cámara puede salir de la sala sin que las paredes estorben.
  const shell = new Mesh(new BoxGeometry(16.4, 9.6, 22), [
    woodMaterial('#8a4f2b', 22, 5, 2, { side: BackSide }),
    woodMaterial('#8a4f2b', 22, 5, 2, { side: BackSide }),
    woodMaterial('#5a3320', 10, 4, 4, { side: BackSide }),
    new MeshStandardMaterial({ color: '#1a1520', roughness: 0.95, side: BackSide }),
    woodMaterial('#7a4526', 20, 4, 2, { side: BackSide }),
    woodMaterial('#8a4f2b', 22, 4, 2, { side: BackSide })
  ]);
  shell.position.set(0, 3.6, 5.6);
  scene.add(shell);

  const stage = new Mesh(new BoxGeometry(14.8, 1.2, 10.8), [
    new MeshStandardMaterial({ color: '#4a2a1a', roughness: 0.8 }),
    new MeshStandardMaterial({ color: '#4a2a1a', roughness: 0.8 }),
    woodMaterial('#d9a566', 14, 3, 3, { roughness: 0.45 }),
    new MeshStandardMaterial({ color: '#2a1a12' }),
    new MeshStandardMaterial({ color: '#3d2416', roughness: 0.8 }),
    new MeshStandardMaterial({ color: '#4a2a1a', roughness: 0.8 })
  ]);
  stage.position.set(0, -0.6, 0);
  stage.receiveShadow = true;
  scene.add(stage);

  const trim = new Mesh(new BoxGeometry(14.8, 0.08, 0.1), new MeshStandardMaterial({ color: '#e8d9a0', metalness: 0.7, roughness: 0.3 }));
  trim.position.set(0, 0.04, 5.4);
  scene.add(trim);

  // Butacas del público
  const seatBase = new InstancedMesh(new BoxGeometry(0.62, 0.12, 0.58), new MeshStandardMaterial({ color: '#1b2238', roughness: 0.85 }), 7 * 15);
  const seatBack = new InstancedMesh(new BoxGeometry(0.62, 0.7, 0.1), new MeshStandardMaterial({ color: '#232c4a', roughness: 0.85 }), 7 * 15);
  const matrix = new Matrix4();
  let index = 0;
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 15; col += 1) {
      const x = (col - 7) * 0.9;
      const z = 8 + row * 1.2;
      const y = -1.2 + row * 0.12;
      matrix.makeTranslation(x, y + 0.45, z);
      seatBase.setMatrixAt(index, matrix);
      matrix.makeTranslation(x, y + 0.85, z + 0.28);
      seatBack.setMatrixAt(index, matrix);
      index += 1;
    }
  }
  scene.add(seatBase, seatBack);

  // Paneles de luz en el techo
  const lightMaterial = new MeshBasicMaterial({ color: '#fff1cf' });
  [-2, 2, 6, 10].forEach((z) => {
    const slat = new Mesh(new BoxGeometry(9, 0.06, 0.7), lightMaterial);
    slat.position.set(0, 8.35, z);
    scene.add(slat);
  });
  // Arco de proscenio, telón y reflectores sobre el escenario
  const gold = new MeshStandardMaterial({ color: '#d9b25a', metalness: 0.8, roughness: 0.3 });
  [-7.3, 7.3].forEach((x) => { const column = new Mesh(new BoxGeometry(0.5, 8.4, 0.5), gold); column.position.set(x, 4, -5.2); scene.add(column); });
  const arch = new Mesh(new BoxGeometry(15.2, 0.7, 0.5), gold);
  arch.position.set(0, 8.2, -5.2);
  scene.add(arch);
  const curtain = new MeshStandardMaterial({ color: '#7a1124', roughness: 0.95 });
  [-6.6, 6.6].forEach((x) => { for (let fold = 0; fold < 5; fold += 1) { const strip = new Mesh(new BoxGeometry(0.28, 7.6, 0.22), curtain); strip.position.set(x + (x > 0 ? -fold : fold) * 0.26, 4, -5.5 + (fold % 2) * 0.1); scene.add(strip); } });
  for (let i = 0; i < 5; i += 1) {
    const can = new Mesh(new CylinderGeometry(0.16, 0.22, 0.4, 20), new MeshStandardMaterial({ color: '#15151a', metalness: 0.6, roughness: 0.4 }));
    can.position.set(-5 + i * 2.5, 7.9, 2);
    can.rotation.x = 0.35;
    scene.add(can);
    const spot = new PointLight('#fff0cf', 18, 0, 2);
    spot.position.set(-5 + i * 2.5, 7.2, 2.4);
    scene.add(spot);
  }
  const warmA = new PointLight('#ffd9a0', 55, 0, 2);
  warmA.position.set(-4, 6.5, 1);
  const warmB = new PointLight('#ffd9a0', 55, 0, 2);
  warmB.position.set(4, 6.5, 1);
  scene.add(warmA, warmB);
};

const buildStudioRoom = (scene) => {
  const shell = new Mesh(new BoxGeometry(14.6, 4.6, 10.6), [
    new MeshStandardMaterial({ color: '#343a44', roughness: 0.9, side: BackSide }),
    new MeshStandardMaterial({ color: '#30353d', roughness: 0.9, side: BackSide }),
    new MeshStandardMaterial({ color: '#1e2228', roughness: 0.95, side: BackSide }),
    new MeshStandardMaterial({ color: '#4a4f58', roughness: 0.8, side: BackSide }),
    new MeshStandardMaterial({ color: '#2b3038', roughness: 0.9, side: BackSide }),
    new MeshStandardMaterial({ color: '#2b3038', roughness: 0.9, side: BackSide })
  ]);
  shell.position.set(0, 2.2, 0);
  scene.add(shell);
  const panelMaterial = new MeshStandardMaterial({ color: '#6b4fa0', roughness: 0.94 });
  for (let panel = 0; panel < 7; panel += 1) {
    const back = new Mesh(new BoxGeometry(0.9, 1.7, 0.1), panelMaterial);
    back.position.set(-5.6 + panel * 1.85, 2.5, -5.2);
    scene.add(back);
  }
  for (let panel = 0; panel < 4; panel += 1) {
    const side = new Mesh(new BoxGeometry(0.1, 1.7, 0.9), panelMaterial);
    side.position.set(-7.2, 2.5, -3.6 + panel * 2.4);
    scene.add(side);
  }
  // Piso de duela, paneles absorbentes con tela, difusores en el techo, bass traps y tira LED
  const floor = new Mesh(new BoxGeometry(14.4, 0.04, 10.4), woodMaterial('#b98a58', 18, 4, 3, { roughness: 0.38 }));
  floor.position.set(0, 0.01, 0);
  floor.receiveShadow = true;
  scene.add(floor);
  const fabric = new MeshStandardMaterial({ color: '#3b2a5c', roughness: 1 });
  const frame = new MeshStandardMaterial({ color: '#16131c', roughness: 0.6 });
  for (let panel = 0; panel < 7; panel += 1) {
    const x = -5.6 + panel * 1.85;
    const rim = new Mesh(new BoxGeometry(1.0, 1.8, 0.06), frame);
    rim.position.set(x, 2.5, -5.24);
    scene.add(rim);
  }
  for (let col = 0; col < 8; col += 1) {
    for (let row = 0; row < 3; row += 1) {
      const height = 0.12 + ((col * 3 + row * 5) % 4) * 0.07; // difusor tipo Schroeder
      const bar = new Mesh(new BoxGeometry(1.6, height, 0.7), woodMaterial('#c89b62', 4, 1, 1, { roughness: 0.5 }));
      bar.position.set(-6 + col * 1.7, 4.55 - height / 2, -3 + row * 3);
      scene.add(bar);
    }
  }
  [[-7.1, -5.1], [7.1, -5.1], [-7.1, 5.1], [7.1, 5.1]].forEach(([x, z]) => {
    const trap = new Mesh(new BoxGeometry(0.5, 4.4, 0.5), fabric);
    trap.position.set(x, 2.2, z);
    scene.add(trap);
  });
  const led = new Mesh(new BoxGeometry(14.2, 0.05, 0.05), new MeshBasicMaterial({ color: '#c2ff3c' }));
  led.position.set(0, 0.35, -5.27);
  scene.add(led);
  const ledPink = new Mesh(new BoxGeometry(0.05, 0.05, 10.2), new MeshBasicMaterial({ color: '#ff5d8f' }));
  ledPink.position.set(7.27, 0.35, 0);
  scene.add(ledPink);
  const door = new Mesh(new BoxGeometry(0.08, 2.3, 1.1), woodMaterial('#2a2230', 3, 1, 1, { roughness: 0.5 }));
  door.position.set(7.26, 1.15, 3.2);
  scene.add(door);
  const grid = new GridHelper(14, 14, '#c7d4cf', '#7d8a86');
  grid.position.y = 0.005;
  scene.add(grid);
  const lamp = new PointLight('#ffe8c4', 40, 0, 2);
  lamp.position.set(0, 4, 0);
  scene.add(lamp);
};

// ---------- Instrumento con base, zona táctil y etiqueta ----------
const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawTag = (canvas, name, image) => {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#2b2040');
  gradient.addColorStop(1, '#6b3b57');
  ctx.fillStyle = gradient;
  roundRect(ctx, 4, 4, width - 8, height - 8, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 3;
  ctx.stroke();
  let textX = 28;
  if (image) {
    ctx.save();
    roundRect(ctx, 20, 20, height - 40, height - 40, 18);
    ctx.clip();
    const side = Math.min(image.width, image.height);
    ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 20, 20, height - 40, height - 40);
    ctx.restore();
    textX = height;
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px sans-serif';
  ctx.textBaseline = 'middle';
  const maxWidth = width - textX - 24;
  const lines = [];
  let line = '';
  String(name || 'Instrumento').split(/\s+/).forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  });
  lines.push(line);
  const shown = lines.slice(0, 2);
  if (lines.length > 2) shown[1] = `${shown[1].slice(0, -1)}…`;
  shown.forEach((text, i) => {
    let fitted = text;
    while (fitted.length > 3 && ctx.measureText(fitted).width > maxWidth) fitted = `${fitted.slice(0, -2)}…`;
    ctx.fillText(fitted, textX, height / 2 + (i - (shown.length - 1) / 2) * 50);
  });
};

const createInstrumentDisplay = (instrument, textureLoader, onUpdate) => {
  const group = new Group();
  const model = createInstrumentModel(instrument.name);
  group.add(model);
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const radius = MathUtils.clamp(Math.hypot(size.x, size.z) / 2 + 0.2, 0.85, 1.5);

  const pad = new Mesh(new CircleGeometry(radius, 40), new MeshBasicMaterial({ color: '#a08cff', transparent: true, opacity: 0.22, depthWrite: false }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.012;
  group.add(pad);
  const ring = new Mesh(new RingGeometry(radius - 0.05, radius, 48), new MeshBasicMaterial({ color: '#c2ff3c', transparent: true, opacity: 0.55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.014;
  group.add(ring);

  const hitHeight = Math.max(size.y, 1.2);
  const hit = new Mesh(new CylinderGeometry(radius, radius, hitHeight, 16), new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hit.position.y = hitHeight / 2;
  hit.userData.hitProxy = true;
  group.add(hit);

  const tagCanvas = document.createElement('canvas');
  tagCanvas.width = 640;
  tagCanvas.height = 176;
  drawTag(tagCanvas, instrument.name, null);
  const tagTexture = new CanvasTexture(tagCanvas);
  tagTexture.colorSpace = SRGBColorSpace;
  const tag = new Sprite(new SpriteMaterial({ map: tagTexture, transparent: true, depthTest: false }));
  tag.renderOrder = 10;
  tag.scale.set(2.2, 0.605, 1);
  tag.position.y = box.max.y + 0.55;
  group.add(tag);

  if (instrument.photoPath) {
    const url = /^https?:\/\//i.test(instrument.photoPath)
      ? instrument.photoPath
      : `${API_ORIGIN}${instrument.photoPath.startsWith('/') ? '' : '/'}${instrument.photoPath}`;
    const photo = textureLoader.load(url, () => {
      if (photo.image) {
        drawTag(tagCanvas, instrument.name, photo.image);
        tagTexture.needsUpdate = true;
        onUpdate();
      }
      photo.dispose();
    });
  }

  group.userData.setActive = (active) => {
    pad.material.opacity = active ? 0.45 : 0.22;
    pad.material.color.set(active ? '#c2ff3c' : '#a08cff');
    ring.material.opacity = active ? 1 : 0.55;
  };
  return group;
};

const disposeScene = (scene) => {
  scene.traverse((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material) return;
      ['map', 'bumpMap', 'roughnessMap'].forEach((slot) => material[slot]?.dispose());
      material.dispose();
    });
    object.dispose?.();
  });
};

export default function RoomCustomizer({ reservation, instruments, accessToken }) {
  const canvasHost = useRef(null);
  const sceneRef = useRef(null);
  const positionsRef = useRef(new Map());
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(() => Boolean(reservation.roomLayout?.length));
  const [error, setError] = useState('');
  const [mode, setMode] = useState('play'); // 'play' (tocar) | 'move' (acomodar)
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [nowPlaying, setNowPlaying] = useState('');
  const modeRef = useRef('play');
  const engineRef = useRef(null);
  const playingTimer = useRef(null);
  const isOrchestraRoom = reservation.roomId === 'sala_orquesta_e';

  useEffect(() => {
    const engine = createSoundEngine();
    engineRef.current = engine;
    return () => { engine.dispose(); engineRef.current = null; clearTimeout(playingTimer.current); };
  }, []);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { engineRef.current?.setVolume(volume); }, [volume]);
  useEffect(() => { engineRef.current?.setMuted(muted); }, [muted]);

  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setFullscreen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);

  useEffect(() => {
    const host = canvasHost.current;
    if (!host) return undefined;
    if (!positionsRef.current.size) {
      (reservation.roomLayout || []).forEach((item) => positionsRef.current.set(item.instrumentId, { x: item.x, z: item.z }));
    }

    let renderer;
    let disposed = false;
    try {
      const scene = new Scene();
      scene.background = new Color('#0f1216');
      const camera = new PerspectiveCamera(46, 1, 0.1, 140);
      renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      // Tonos cinematográficos + reflejos de entorno: dan brillo real a barniz, cromo y metales.
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
      host.replaceChildren(renderer.domElement);
      const render = () => { if (!disposed) renderer.render(scene, camera); };

      const pmrem = new PMREMGenerator(renderer);
      const roomEnvironment = new RoomEnvironment();
      const environmentTarget = pmrem.fromScene(roomEnvironment, 0.04);
      scene.environment = environmentTarget.texture;
      scene.environmentIntensity = 0.85;
      roomEnvironment.traverse((object) => {
        object.geometry?.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material?.dispose());
      });
      pmrem.dispose();

      scene.add(new AmbientLight('#ffffff', 0.15));
      scene.add(new HemisphereLight('#f2eaff', '#4a4038', 0.7));
      const keyLight = new DirectionalLight('#fff4dc', 2.6);
      keyLight.position.set(4, 11, 9);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      Object.assign(keyLight.shadow.camera, { left: -10, right: 10, top: 9, bottom: -9, near: 1, far: 40 });
      scene.add(keyLight);

      if (isOrchestraRoom) buildOrchestraHall(scene);
      else buildStudioRoom(scene);

      const views = isOrchestraRoom
        ? { general: [[0, 7.5, 16], [0, 1, 0]], top: [[0, 24, 0.01], [0, 0, 1]], front: [[0, 2.4, 14], [0, 1.3, 0]] }
        : { general: [[9, 8, 11], [0, 0.6, 0]], top: [[0, 20, 0.01], [0, 0, 0]], front: [[0, 2.4, 10], [0, 1.2, 0]] };

      const textureLoader = new TextureLoader();
      const meshes = [];
      const columns = Math.max(1, Math.ceil(Math.sqrt(instruments.length * 1.6)));
      const rows = Math.ceil(instruments.length / columns);
      const columnSpacing = Math.min(3.2, 11 / Math.max(1, columns - 1));
      const rowSpacing = Math.min(2.8, 6.5 / Math.max(1, rows - 1));
      instruments.forEach((instrument, index) => {
        const id = String(instrument._id || instrument.id);
        const stored = positionsRef.current.get(id);
        const display = createInstrumentDisplay(instrument, textureLoader, render);
        const x = ((index % columns) - (columns - 1) / 2) * columnSpacing;
        const z = (Math.floor(index / columns) - (rows - 1) / 2) * rowSpacing - 0.5;
        display.position.set(stored?.x ?? x, 0, stored?.z ?? z);
        display.userData.instrumentId = id;
        display.userData.name = instrument.name;
        scene.add(display);
        meshes.push(display);
      });

      const raycaster = new Raycaster();
      const pointer = new Vector2();
      const floorPlane = new Plane(new Vector3(0, 1, 0), 0);
      const intersection = new Vector3();
      let dragged = null;
      let moved = false;

      const updateSize = () => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        render();
      };
      const pointFromEvent = (event) => {
        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      };
      const ownerOf = (object) => {
        let node = object;
        while (node && !node.userData.instrumentId) node = node.parent;
        return node || null;
      };
      // Estos listeners se registran antes que los de OrbitControls para poder cancelarle el gesto
      // cuando el usuario toca un instrumento.
      // Animaciones de golpe: rebote (parches), balanceo (platillos), hundimiento (teclas/botones), vibración (cuerdas).
      const animations = [];
      let frame = 0;
      const tick = (now) => {
        frame = 0;
        for (let i = animations.length - 1; i >= 0; i -= 1) {
          const a = animations[i];
          const p = Math.min(1, (now - a.start) / a.duration);
          const m = a.mesh;
          if (a.kind === 'swing') { m.rotation.x = a.base.rx + Math.sin(p * Math.PI * 7) * 0.07 * (1 - p); m.rotation.z = a.base.rz + Math.cos(p * Math.PI * 6) * 0.05 * (1 - p); }
          else if (a.kind === 'key') m.position.y = a.base.y - 0.012 * (1 - p);
          else if (a.kind === 'pluck') { m.scale.x = a.base.sx * (1 + Math.sin(p * Math.PI * 14) * 0.5 * (1 - p)); }
          else if (a.kind === 'spin') m.rotation.y = a.base.ry + p * Math.PI * 2;
          else { const k = 1 - Math.sin(p * Math.PI) * 0.05; m.scale.y = a.base.sy * k; }
          if (p >= 1) { m.position.y = a.base.y; m.scale.set(a.base.sx, a.base.sy, a.base.sz); m.rotation.set(a.base.rx, a.base.ry, a.base.rz); animations.splice(i, 1); }
        }
        render();
        if (animations.length && !disposed) frame = requestAnimationFrame(tick);
      };
      const pulse = (mesh) => {
        if (animations.some((a) => a.mesh === mesh)) return;
        const kind = mesh.userData.press || 'bounce';
        animations.push({
          mesh, kind, start: performance.now(), duration: kind === 'swing' ? 1100 : kind === 'pluck' ? 600 : kind === 'spin' ? 900 : 200,
          base: { y: mesh.position.y, sx: mesh.scale.x, sy: mesh.scale.y, sz: mesh.scale.z, rx: mesh.rotation.x, ry: mesh.rotation.y, rz: mesh.rotation.z }
        });
        if (!frame) frame = requestAnimationFrame(tick);
      };
      const soundTarget = (hits) => {
        for (const hit of hits) {
          if (hit.object.userData.hitProxy) continue;
          let node = hit.object;
          while (node && !node.userData.sound && !node.userData.instrumentId) node = node.parent;
          if (node?.userData.sound) return { mesh: node, hit };
          return null; // tocó una pieza sin sonido: no hay nada que tocar
        }
        return null;
      };
      const playAt = (event) => {
        const engine = engineRef.current;
        if (!engine) return false;
        const target = soundTarget(raycaster.intersectObjects(meshes, true));
        if (!target) return false;
        engine.unlock();
        const local = target.mesh.worldToLocal(target.hit.point.clone());
        const result = engine.play(target.mesh.userData.sound, { point: local, velocity: event.pointerType === 'mouse' ? 0.85 : 0.9 });
        pulse(target.mesh);
        const owner = ownerOf(target.mesh);
        const label = result ? `${owner?.userData.name || 'Instrumento'}${result.note != null ? ` · ${noteName(result.note)}` : ''}${result.fret != null ? ` (cuerda ${result.string + 1}, traste ${result.fret})` : ''}` : '';
        setNowPlaying(label);
        clearTimeout(playingTimer.current);
        playingTimer.current = setTimeout(() => setNowPlaying(''), 1800);
        return true;
      };
      const onPointerDown = (event) => {
        pointFromEvent(event);
        raycaster.setFromCamera(pointer, camera);
        if (modeRef.current === 'play') {
          if (playAt(event)) event.stopImmediatePropagation();
          return; // en modo tocar no se arrastran instrumentos; el fondo sigue girando la cámara
        }
        const hit = raycaster.intersectObjects(meshes, true)[0];
        dragged = hit ? ownerOf(hit.object) : null;
        if (!dragged) return;
        event.stopImmediatePropagation();
        moved = false;
        dragged.userData.setActive(true);
        renderer.domElement.setPointerCapture(event.pointerId);
        render();
      };
      const onPointerMove = (event) => {
        if (!dragged) return;
        pointFromEvent(event);
        raycaster.setFromCamera(pointer, camera);
        if (raycaster.ray.intersectPlane(floorPlane, intersection)) {
          dragged.position.x = MathUtils.clamp(intersection.x, -LIMIT_X, LIMIT_X);
          dragged.position.z = MathUtils.clamp(intersection.z, -LIMIT_Z, LIMIT_Z);
          positionsRef.current.set(dragged.userData.instrumentId, { x: dragged.position.x, z: dragged.position.z });
          if (!moved) { moved = true; setSaved(false); }
          render();
        }
      };
      const onPointerUp = () => {
        if (dragged) {
          dragged.userData.setActive(false);
          dragged = null;
          render();
        }
      };
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerup', onPointerUp);
      renderer.domElement.addEventListener('pointercancel', onPointerUp);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = false;
      controls.minDistance = 3;
      controls.maxDistance = 38;
      controls.maxPolarAngle = Math.PI / 2 - 0.03;
      controls.addEventListener('change', render);

      const setView = (name) => {
        const [position, target] = views[name] || views.general;
        camera.position.set(...position);
        controls.target.set(...target);
        controls.update();
        render();
      };
      setView('general');

      const resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(host);
      updateSize();
      sceneRef.current = { meshes, render, setView };

      return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        controls.dispose();
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', onPointerUp);
        disposeScene(scene);
        releaseSharedAssets();
        environmentTarget.dispose();
        renderer.dispose();
        sceneRef.current = null;
      };
    } catch {
      if (host) {
        const message = document.createElement('p');
        message.textContent = 'No fue posible iniciar la vista 3D en este dispositivo.';
        message.style.cssText = 'padding:24px;color:#ffffff;text-align:center';
        host.replaceChildren(message);
      }
      renderer?.dispose();
      return undefined;
    }
  }, [reservation, instruments, isOrchestraRoom, fullscreen]);

  const setView = useCallback((name) => sceneRef.current?.setView(name), []);

  const saveLayout = async () => {
    if (!sceneRef.current) return;
    if (instruments.length > MAX_SAVED_INSTRUMENTS) {
      setError(`Se puede guardar la ubicación de hasta ${MAX_SAVED_INSTRUMENTS} instrumentos.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const roomLayout = sceneRef.current.meshes.map((mesh) => ({
        instrumentId: mesh.userData.instrumentId,
        name: mesh.userData.name,
        x: Number(mesh.position.x.toFixed(2)),
        z: Number(mesh.position.z.toFixed(2))
      }));
      const response = await fetch(`${API_URL}/reservations/${reservation._id}/layout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ roomLayout })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo guardar la distribución.');
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const overlayButton = {
    background: 'rgba(15,18,22,.78)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,.28)',
    borderRadius: '999px',
    padding: '8px 14px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backdropFilter: 'blur(6px)'
  };

  const viewport = (
    <div style={fullscreen
      ? { position: 'fixed', inset: 0, zIndex: 2000, background: '#0f1216', display: 'flex', flexDirection: 'column' }
      : { position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)' }}>
      <div ref={canvasHost} style={{ flex: 1, height: fullscreen ? '100%' : 'clamp(440px, 74vh, 780px)', width: '100%', touchAction: 'none' }} />
      <div style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', pointerEvents: 'auto' }}>
          <button type="button" style={overlayButton} onClick={() => setView('general')}>Vista general</button>
          <button type="button" style={overlayButton} onClick={() => setView('top')}>Planta (desde arriba)</button>
          <button type="button" style={overlayButton} onClick={() => setView('front')}>Frente</button>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', pointerEvents: 'auto' }}>
          <button type="button" aria-pressed={mode === 'play'} style={{ ...overlayButton, borderColor: mode === 'play' ? '#c2ff3c' : undefined, color: mode === 'play' ? '#c2ff3c' : '#fff' }} onClick={() => setMode('play')}>🎵 Modo tocar</button>
          <button type="button" aria-pressed={mode === 'move'} style={{ ...overlayButton, borderColor: mode === 'move' ? '#c2ff3c' : undefined, color: mode === 'move' ? '#c2ff3c' : '#fff' }} onClick={() => setMode('move')}>✥ Modo acomodar</button>
          <label style={{ ...overlayButton, cursor: 'default' }}>
            <button type="button" aria-label={muted ? 'Activar sonido' : 'Silenciar'} onClick={() => setMuted((value) => !value)} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0 }}>{muted ? '🔇' : '🔊'}</button>
            <input type="range" min="0" max="1" step="0.05" value={volume} aria-label="Volumen" onChange={(event) => setVolume(Number(event.target.value))} style={{ width: 80 }} />
          </label>
          <button type="button" style={overlayButton} onClick={() => setFullscreen((value) => !value)}>
            {fullscreen ? <><IcMinimize /> Salir</> : <><IcMaximize /> Experiencia completa</>}
          </button>
        </div>
        <button type="button" hidden style={{ ...overlayButton, pointerEvents: 'auto' }} onClick={() => setFullscreen((value) => !value)}>
          {fullscreen ? <><IcMinimize /> Salir</> : <><IcMaximize /> Experiencia completa</>}
        </button>
      </div>
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', pointerEvents: 'none' }}>
        <span style={{ ...overlayButton, cursor: 'default', fontSize: '11px', color: saved ? '#c2ff3c' : '#fff' }} role="status">
          {nowPlaying ? `♪ ${nowPlaying}` : mode === 'play' ? 'Toca cualquier parte del instrumento para escucharlo · Arrastra el fondo para girar' : `${saved ? 'Distribución guardada' : 'Cambios sin guardar'} · Arrastra un instrumento para moverlo`}
        </span>
        <button type="button" className="btn-grid-action" style={{ pointerEvents: 'auto' }} onClick={saveLayout} disabled={saving}>
          <IcSave /> {saving ? 'Guardando...' : 'Guardar sala'}
        </button>
      </div>
      {fullscreen && error && <p role="alert" style={{ position: 'absolute', top: 60, left: 12, margin: 0, color: '#ffb4b4', background: 'rgba(15,18,22,.85)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}>{error}</p>}
    </div>
  );

  return (
    <section
      className="console-section-card"
      style={{ '--room-width': 'min(calc(100vw - 56px), 1280px)', width: 'var(--room-width)', marginLeft: 'calc((100% - var(--room-width)) / 2)', boxSizing: 'border-box' }}
    >
      <h3 className="console-section-title">{isOrchestraRoom ? 'Diseña la Sala E · Orquesta en 3D' : 'Diseña tu sala en 3D'}</h3>
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
        {isOrchestraRoom
          ? `${instruments.length} instrumento${instruments.length === 1 ? '' : 's'} de tu banda como figuras 3D sobre el escenario. Arrástralos para acomodarlos y usa «Experiencia completa» para verlo en pantalla grande.`
          : 'Arrastra tus instrumentos (figuras 3D) para colocarlos en el espacio reservado. Usa «Experiencia completa» para verlo en pantalla grande.'}
      </p>
      {fullscreen ? createPortal(viewport, document.body) : viewport}
      {fullscreen && <p role="status" style={{ fontSize: '13px' }}>Sala 3D abierta en pantalla completa (Esc para salir).</p>}
      {!fullscreen && error && <p role="alert" style={{ color: 'var(--color-state-error)', fontSize: '13px' }}>{error}</p>}
    </section>
  );
}
