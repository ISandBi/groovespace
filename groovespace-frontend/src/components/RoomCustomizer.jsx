import { useEffect, useRef, useState } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  GridHelper,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  SRGBColorSpace,
  SphereGeometry,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three';
import { API_ORIGIN, API_URL } from '../api';

const createPart = (geometry, material, position, parent, rotation = [0, 0, 0], scale = [1, 1, 1]) => {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const createInstrumentModel = (name) => {
  const model = new Group();
  const shell = new MeshStandardMaterial({ color: '#6f51a6', roughness: 0.38, metalness: 0.28 });
  const trim = new MeshStandardMaterial({ color: '#d4d1d9', roughness: 0.24, metalness: 0.82 });
  const dark = new MeshStandardMaterial({ color: '#17191e', roughness: 0.65, metalness: 0.14 });
  const light = new MeshStandardMaterial({ color: '#f0edf3', roughness: 0.32 });
  const normalizedName = name.toLowerCase();

  if (/bater|drum|percusi/.test(normalizedName)) {
    const drumMaterial = new MeshStandardMaterial({ color: '#a63c4b', roughness: 0.3, metalness: 0.22 });
    [[-.38, .25, -.12, .3], [0, .42, -.28, .24], [.35, .38, -.2, .22], [0, .25, .28, .3]].forEach(([x, y, z, radius]) => {
      createPart(new CylinderGeometry(radius, radius, .3, 24), drumMaterial, [x, y, z], model, [Math.PI / 2, 0, 0]);
      createPart(new CylinderGeometry(radius * .91, radius * .91, .025, 24), light, [x, y, z + .16], model, [Math.PI / 2, 0, 0]);
    });
    [[-.65, .76, -.34], [.58, .88, -.22], [.7, .66, .28]].forEach(([x, y, z]) => {
      createPart(new CylinderGeometry(.22, .3, .035, 24), trim, [x, y, z], model);
      createPart(new CylinderGeometry(.018, .018, y, 10), dark, [x, y / 2, z], model);
    });
  } else if (/guitar|bajo|bass|violin/.test(normalizedName)) {
    createPart(new SphereGeometry(.5, 24, 16), shell, [0, .17, .12], model, [0, 0, -.22], [.74, .26, .84]);
    createPart(new BoxGeometry(.18, .15, 1.45), trim, [0, .2, -.84], model, [-.08, 0, 0]);
    createPart(new BoxGeometry(.28, .18, .3), shell, [0, .21, -1.64], model, [-.08, 0, 0]);
    createPart(new BoxGeometry(.24, .045, .25), dark, [0, .32, -.15], model);
    for (let string = -2; string <= 2; string += 1) {
      createPart(new BoxGeometry(.009, .012, 1.95), trim, [string * .035, .37, -.68], model);
    }
  } else if (/teclado|keyboard|piano/.test(normalizedName)) {
    createPart(new BoxGeometry(1.65, .2, .58), dark, [0, .15, 0], model);
    for (let key = 0; key < 14; key += 1) {
      const x = -.74 + key * .114;
      createPart(new BoxGeometry(.1, .045, .42), light, [x, .275, .015], model);
      if (key % 7 !== 2 && key % 7 !== 6) {
        createPart(new BoxGeometry(.055, .035, .24), dark, [x + .055, .31, -.075], model);
      }
    }
    createPart(new BoxGeometry(1.72, .06, .08), shell, [0, .19, -.31], model);
  } else if (/micro|mic/.test(normalizedName)) {
    createPart(new CylinderGeometry(.025, .04, .95, 12), trim, [0, .49, 0], model);
    createPart(new CylinderGeometry(.025, .025, .72, 12), dark, [0, .07, 0], model, [0, 0, Math.PI / 2]);
    createPart(new SphereGeometry(.12, 16, 12), shell, [0, 1.01, -.12], model, [Math.PI / 4, 0, 0], [1, 1.3, 1]);
    createPart(new CylinderGeometry(.012, .012, .24, 8), dark, [0, .08, 0], model);
  }
  return model;
};

const createInstrumentLabel = (name) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 512, 320);
  gradient.addColorStop(0, '#302349');
  gradient.addColorStop(1, '#8c4c65');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffffff';
  context.font = 'bold 34px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const words = String(name || 'Instrumento').split(/\s+/);
  let line = '';
  let y = 150;
  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width > 440 && line) {
      context.fillText(line, 256, y);
      line = word;
      y += 44;
    } else line = nextLine;
  }
  context.fillText(line, 256, y);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

const createInstrumentCaption = (name) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  context.fillStyle = '#241c30';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffffff';
  context.font = 'bold 34px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  let caption = String(name || 'Instrumento');
  while (caption.length > 3 && context.measureText(caption).width > 472) {
    caption = `${caption.slice(0, -4)}…`;
  }
  context.fillText(caption, 256, 48);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
};

const createInstrumentDisplay = (instrument, textureLoader, onTextureLoaded) => {
  const display = new Group();
  const model = createInstrumentModel(instrument.name);
  model.position.y = .03;
  display.add(model);
  const stand = new MeshStandardMaterial({ color: '#28212f', roughness: .45, metalness: .45 });
  createPart(new CylinderGeometry(.42, .52, .12, 32), stand, [0, .06, 0], display);
  createPart(new CylinderGeometry(.055, .075, .48, 16), stand, [0, .35, -.16], display);
  createPart(new BoxGeometry(1.3, .92, .09), stand, [0, 1.12, -.16], display);

  let imageTexture;
  const photoMaterial = new MeshStandardMaterial({
    color: '#ffffff',
    roughness: .7,
    side: DoubleSide
  });
  if (instrument.photoPath) {
    const photoUrl = /^https?:\/\//i.test(instrument.photoPath)
      ? instrument.photoPath
      : `${API_ORIGIN}${instrument.photoPath.startsWith('/') ? '' : '/'}${instrument.photoPath}`;
    imageTexture = textureLoader.load(photoUrl, onTextureLoaded, undefined, () => {
      imageTexture?.dispose();
      imageTexture = createInstrumentLabel(instrument.name);
      photoMaterial.map = imageTexture;
      photoMaterial.needsUpdate = true;
    });
  } else imageTexture = createInstrumentLabel(instrument.name);
  imageTexture.colorSpace = SRGBColorSpace;
  photoMaterial.map = imageTexture;
  createPart(new BoxGeometry(1.18, .8, .018), new MeshStandardMaterial({ color: '#ece8ef', roughness: .7 }), [0, 1.12, -.105], display);
  createPart(new BoxGeometry(.02, .84, .02), stand, [-.62, 1.12, -.035], display);
  createPart(new BoxGeometry(.02, .84, .02), stand, [.62, 1.12, -.035], display);
  createPart(new BoxGeometry(1.26, .02, .02), stand, [0, 1.55, -.035], display);
  createPart(new BoxGeometry(1.26, .02, .02), stand, [0, .69, -.035], display);
  const photo = createPart(new BoxGeometry(1.18, .8, .014), photoMaterial, [0, 1.12, -.025], display);
  photo.rotation.y = .16;
  const captionMaterial = new MeshStandardMaterial({ map: createInstrumentCaption(instrument.name), side: DoubleSide });
  const caption = createPart(new BoxGeometry(1.12, .2, .012), captionMaterial, [0, .58, -.018], display);
  caption.rotation.y = .16;
  return display;
};

export default function RoomCustomizer({ reservation, instruments, accessToken }) {
  const canvasHost = useRef(null);
  const sceneRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(() => Boolean(reservation.roomLayout?.length));
  const [error, setError] = useState('');

  useEffect(() => {
    const host = canvasHost.current;
    if (!host) return undefined;

    let renderer;
    try {
      const scene = new Scene();
      scene.background = new Color('#15191e');
      const camera = new PerspectiveCamera(43, 1, 0.1, 100);
      const isOrchestraRoom = reservation.roomId === 'sala_orquesta_e';
      camera.position.set(isOrchestraRoom ? 0 : 10, 9, isOrchestraRoom ? 16 : 12);
      camera.lookAt(0, isOrchestraRoom ? 1.4 : 0, isOrchestraRoom ? -1.2 : 0);
      renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFShadowMap;
      host.replaceChildren(renderer.domElement);
      const render = () => renderer.render(scene, camera);

      scene.add(new HemisphereLight('#f2eaff', '#343b43', 2.3));
      const keyLight = new DirectionalLight('#fff4dc', 3.2);
      keyLight.position.set(3, 9, 5);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      scene.add(keyLight);
      const rimLight = new DirectionalLight('#9e7bff', 1.8);
      rimLight.position.set(-6, 5, -2);
      scene.add(rimLight);
      const floor = new Mesh(
        new BoxGeometry(14, .18, 10),
        new MeshStandardMaterial({ color: isOrchestraRoom ? '#65442f' : '#42464c', roughness: .8 })
      );
      floor.position.y = -.11;
      floor.receiveShadow = true;
      scene.add(floor);

      const textureLoader = new TextureLoader();
      let disposed = false;
      if (isOrchestraRoom) {
        const roomTexture = textureLoader.load('/sala-estudio-e-orquesta.jpg', () => {
          if (!disposed) render();
        });
        roomTexture.colorSpace = SRGBColorSpace;
        const roomPhoto = new Mesh(
          new BoxGeometry(18, 10.125, .12),
          new MeshStandardMaterial({ map: roomTexture, roughness: .9 })
        );
        roomPhoto.position.set(0, 5.06, -5.05);
        scene.add(roomPhoto);
        const sideMaterial = new MeshStandardMaterial({ color: '#4a2d24', roughness: .78 });
        [-9, 9].forEach((x) => {
          const sideWall = new Mesh(new BoxGeometry(.18, 4.4, 10), sideMaterial);
          sideWall.position.set(x, 2.1, 0);
          scene.add(sideWall);
        });
      } else {
        const backWall = new Mesh(
          new BoxGeometry(14, 4.2, .24),
          new MeshStandardMaterial({ color: '#252a32', roughness: .9 })
        );
        backWall.position.set(0, 2, -5);
        scene.add(backWall);
        const sideWall = new Mesh(
          new BoxGeometry(10, 4.2, .24),
          new MeshStandardMaterial({ color: '#30353d', roughness: .9, side: DoubleSide })
        );
        sideWall.rotation.y = Math.PI / 2;
        sideWall.position.set(-7, 2, 0);
        scene.add(sideWall);
        const acousticPanel = new MeshStandardMaterial({ color: '#6b4fa0', roughness: .94 });
        for (let panel = 0; panel < 7; panel += 1) {
          const x = -5.6 + panel * 1.85;
          const panelMesh = new Mesh(new BoxGeometry(.9, 1.65, .09), acousticPanel);
          panelMesh.position.set(x, 2.45, -4.82);
          panelMesh.receiveShadow = true;
          scene.add(panelMesh);
        }
      }
      const baseboard = new Mesh(new BoxGeometry(14, .18, .12), new MeshStandardMaterial({ color: '#111318', metalness: .3, roughness: .55 }));
      baseboard.position.set(0, .12, -4.78);
      scene.add(baseboard);
      if (!isOrchestraRoom) {
        const grid = new GridHelper(14, 14, '#c7d4cf', '#8c9b96');
        grid.position.y = -.015;
        scene.add(grid);
      }

      const placements = new Map((reservation.roomLayout || []).map((item) => [item.instrumentId, item]));
      const meshes = [];
      const columns = Math.max(1, Math.ceil(Math.sqrt(instruments.length)));
      const rows = Math.ceil(instruments.length / columns);
      const columnSpacing = Math.min(2, 12 / Math.max(1, columns - 1));
      const rowSpacing = Math.min(1.8, 8 / Math.max(1, rows - 1));
      instruments.forEach((instrument, index) => {
        const placement = placements.get(String(instrument._id || instrument.id)) || {};
        const mesh = createInstrumentDisplay(instrument, textureLoader, () => {
          if (!disposed) render();
        });
        const x = ((index % columns) - (columns - 1) / 2) * columnSpacing;
        const z = (Math.floor(index / columns) - (rows - 1) / 2) * rowSpacing;
        mesh.position.set(placement.x ?? x, .02, placement.z ?? z);
        mesh.userData.instrumentId = String(instrument._id || instrument.id);
        mesh.userData.name = instrument.name;
        mesh.rotation.y = isOrchestraRoom ? 0 : .45;
        scene.add(mesh);
        meshes.push(mesh);
      });

      const raycaster = new Raycaster();
      const pointer = new Vector2();
      const floorPlane = new Plane(new Vector3(0, 1, 0), -.03);
      const intersection = new Vector3();
      let dragged = null;

      const updateSize = () => {
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        render();
      };
      const pointFromEvent = (event) => {
        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
        pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      };
      const onPointerDown = (event) => {
        pointFromEvent(event);
        raycaster.setFromCamera(pointer, camera);
        dragged = raycaster.intersectObjects(meshes, true)[0]?.object.parent || null;
        if (dragged === scene) dragged = null;
        if (dragged) renderer.domElement.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event) => {
        if (!dragged) return;
        pointFromEvent(event);
        raycaster.setFromCamera(pointer, camera);
        if (raycaster.ray.intersectPlane(floorPlane, intersection)) {
          dragged.position.x = MathUtils.clamp(intersection.x, -6.1, 6.1);
          dragged.position.z = MathUtils.clamp(intersection.z, -4.1, 4.1);
          render();
          setSaved(false);
        }
      };
      const onPointerUp = () => { dragged = null; };
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerup', onPointerUp);
      renderer.domElement.addEventListener('pointercancel', onPointerUp);
      const resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(host);
      updateSize();
      sceneRef.current = { meshes, render };
      return () => {
        disposed = true;
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', onPointerUp);
        scene.traverse((object) => {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material?.dispose();
          object.material?.map?.dispose();
        });
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
  }, [reservation, instruments]);

  const saveLayout = async () => {
    if (!sceneRef.current) return;
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

  return (
    <section className="console-section-card">
      <h3 className="console-section-title">{reservation.roomId === 'sala_orquesta_e' ? 'Diseña la Sala E · Orquesta en 3D' : 'Diseña tu sala'}</h3>
      <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
        {reservation.roomId === 'sala_orquesta_e'
          ? `${instruments.length} instrumento${instruments.length === 1 ? '' : 's'} de tu banda sobre la imagen real de la sala. Arrástralos para acomodarlos.`
          : 'Arrastra tus instrumentos para colocarlos en el espacio reservado.'}
      </p>
      <div ref={canvasHost} style={{ height: 'min(58vh, 460px)', minHeight: '280px', overflow: 'hidden', borderRadius: '8px', touchAction: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '14px' }}>
        <span style={{ fontSize: '12px', color: saved ? 'var(--color-booking-available)' : 'var(--color-text-muted)' }} role="status">{saved ? 'Distribución guardada' : 'Cambios sin guardar'}</span>
        <button type="button" className="btn-grid-action" onClick={saveLayout} disabled={saving}>{saving ? 'Guardando...' : 'Guardar sala'}</button>
      </div>
      {error && <p role="alert" style={{ color: 'var(--color-state-error)', fontSize: '13px' }}>{error}</p>}
    </section>
  );
}