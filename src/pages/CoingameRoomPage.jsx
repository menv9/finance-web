import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as THREE from 'three';
import * as LucideIcons from 'lucide-react';
import { fetchCoinById, fetchCoinRewards, spotPrice, updateFurniturePosition } from '../utils/coingameApi';
import { useFinanceStore } from '../store/useFinanceStore';

const ROOM = { w: 22, d: 22, h: 9 };
const FLOOR_Y = 0;
const STAGE_X = -9;
const STAGE_Z_START = -8;
const STAGE_Z_STEP = 2.6;

const RARITY_HEX = { legendary: 0xf59e0b, epic: 0xc084fc, rare: 0x38bdf8, uncommon: 0x4ade80, common: 0x6b7280 };

function FC({ amount, decimals = 4 }) {
  return (
    <span>
      {Number(amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: decimals })}
      <span style={{ marginLeft: '0.25em', fontSize: '0.75em', color: '#4b5563', fontFamily: 'monospace' }}>FC</span>
    </span>
  );
}

// ── Furniture mesh builders ──────────────────────────────────────────────────

function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx, ry, rz);
  return m;
}

function buildThrone() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.08, metalness: 1, emissive: 0xb45309, emissiveIntensity: 0.25 });
  const velvet = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.9, metalness: 0 });
  g.add(mesh(new THREE.BoxGeometry(1.1, 0.12, 1.0), gold, 0, 0.5, 0));
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.12, 0.85), velvet, 0, 0.63, 0));
  g.add(mesh(new THREE.BoxGeometry(1.1, 1.6, 0.1), gold, 0, 1.4, -0.45));
  g.add(mesh(new THREE.BoxGeometry(0.85, 1.2, 0.08), velvet, 0, 1.4, -0.38));
  [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.38], [0.45, 0.38]].forEach(([x, z]) => {
    g.add(mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.5, 8), gold, x, 0.25, z));
  });
  [-0.55, 0.55].forEach((x) => {
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.08, 0.8), gold, x, 0.85, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8), gold, x, 0.68, -0.3));
  });
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.28, 5), gold, 0, 2.25, -0.45));
  return g;
}

function buildGoldPile() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.12, metalness: 1, emissive: 0x92400e, emissiveIntensity: 0.2 });
  [[0,0.12,0],[0.22,0.12,0.1],[-.2,0.12,0.15],[0.1,0.12,-.22],[-.15,0.12,-.2],
   [0.05,0.36,0.05],[-.1,0.36,-.05],[0.15,0.36,-.1],[0,0.58,0]].forEach(([x,y,z], i) => {
    const r = 0.1 + (i % 3) * 0.025;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.045, 20), gold);
    c.position.set(x, y, z);
    c.rotation.set(0.1 * i, (i * 1.3) % (Math.PI * 2), 0.05 * i);
    g.add(c);
  });
  return g;
}

function buildMoonLamp() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 0.3, metalness: 0.8 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xbbf7d0, emissive: 0x4ade80, emissiveIntensity: 1.2, roughness: 0.5, metalness: 0 });
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.06, 16), metal, 0, 0.03, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8), metal, 0, 0.83, 0));
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.025, 0.025), metal, 0.2, 1.62, 0));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 20), glow);
  moon.position.set(0.42, 1.62, 0); g.add(moon);
  const pl = new THREE.PointLight(0x4ade80, 1.8, 4.5);
  pl.position.set(0.42, 1.62, 0); g.add(pl);
  return g;
}

function buildTradingDesk() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x0c1a0c, roughness: 0.45, metalness: 0.6 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x030d03, emissive: 0x22c55e, emissiveIntensity: 0.9, roughness: 1 });
  g.add(mesh(new THREE.BoxGeometry(2.0, 0.08, 0.9), wood, 0, 0.72, 0));
  [[-0.88, -0.36], [0.88, -0.36], [-0.88, 0.34], [0.88, 0.34]].forEach(([x, z]) => {
    g.add(mesh(new THREE.BoxGeometry(0.07, 0.72, 0.07), wood, x, 0.36, z));
  });
  [-0.62, 0, 0.62].forEach((x) => {
    g.add(mesh(new THREE.BoxGeometry(0.04, 0.32, 0.04), wood, x, 1.08, -0.28));
    g.add(mesh(new THREE.BoxGeometry(0.52, 0.32, 0.04), wood, x, 1.4, -0.3));
    g.add(mesh(new THREE.PlaneGeometry(0.44, 0.26), screen, x, 1.4, -0.27));
  });
  g.add(mesh(new THREE.BoxGeometry(0.55, 0.02, 0.22), wood, 0, 0.77, 0.12));
  return g;
}

function buildNftFrame() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x0c1a0c, roughness: 0.3, metalness: 0.85 });
  const art = new THREE.MeshStandardMaterial({ color: 0x0a1a0a, emissive: 0x22c55e, emissiveIntensity: 0.55, roughness: 1 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.1, metalness: 1, emissive: 0x22c55e, emissiveIntensity: 0.3 });
  [-0.3, 0.3].forEach((x) => g.add(mesh(new THREE.BoxGeometry(0.05, 0.55, 0.38), metal, x, 0.275, 0)));
  g.add(mesh(new THREE.BoxGeometry(0.65, 0.04, 0.04), metal, 0, 0.48, 0.16));
  g.add(mesh(new THREE.BoxGeometry(0.84, 1.1, 0.05), metal, 0, 1.1, 0));
  [[-0.4,1.1,0.03],[0.4,1.1,0.03]].forEach(([x,y,z]) => g.add(mesh(new THREE.BoxGeometry(0.04, 1.12, 0.04), trim, x, y, z)));
  [[0,1.67,0.03],[0,0.54,0.03]].forEach(([x,y,z]) => g.add(mesh(new THREE.BoxGeometry(0.86, 0.04, 0.04), trim, x, y, z)));
  g.add(mesh(new THREE.PlaneGeometry(0.72, 0.95), art, 0, 1.1, 0.03));
  return g;
}

function buildDiamondDisplay() {
  const g = new THREE.Group();
  const pedestal = new THREE.MeshStandardMaterial({ color: 0x0c1a0c, roughness: 0.3, metalness: 0.8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbbf7d0, transparent: true, opacity: 0.18, roughness: 0, metalness: 0.1 });
  const gemMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 1.4, roughness: 0, metalness: 0.5 });
  g.add(mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.12, 8), pedestal, 0, 0.06, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.32, 8), pedestal, 0, 0.28, 0));
  g.add(mesh(new THREE.SphereGeometry(0.28, 20, 20, 0, Math.PI*2, 0, Math.PI*0.55), glass, 0, 0.44, 0));
  const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), gemMat);
  d.position.set(0, 0.6, 0); g.add(d);
  const pl = new THREE.PointLight(0x38bdf8, 1.2, 3);
  pl.position.set(0, 0.65, 0); g.add(pl);
  return g;
}

function buildRocket() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.9 });
  const fin = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.8, emissive: 0x38bdf8, emissiveIntensity: 0.2 });
  const flame = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf97316, emissiveIntensity: 1.5, roughness: 1 });
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.14, 8), body, 0, 0.07, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 16), body, 0, 0.49, 0));
  g.add(mesh(new THREE.ConeGeometry(0.12, 0.32, 16), body, 0, 1.0, 0));
  [0, 1, 2].forEach((i) => {
    const a = (i / 3) * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.18), fin);
    f.position.set(Math.sin(a) * 0.14, 0.22, Math.cos(a) * 0.14);
    f.rotation.y = -a; g.add(f);
  });
  g.add(mesh(new THREE.ConeGeometry(0.07, 0.18, 8), flame, 0, -0.09, 0, Math.PI, 0, 0));
  const pl = new THREE.PointLight(0xf97316, 0.8, 2.5);
  pl.position.set(0, -0.15, 0); g.add(pl);
  return g;
}

function buildCandleChart() {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x0c1a0c, roughness: 0.4, metalness: 0.7 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x030d03, emissive: 0x22c55e, emissiveIntensity: 0.6, roughness: 1 });
  const up = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.5, roughness: 0.4 });
  const dn = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.5, roughness: 0.4 });
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.06, 12), frame, 0, 0.03, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 8), frame, 0, 0.49, 0));
  g.add(mesh(new THREE.BoxGeometry(0.82, 0.58, 0.045), frame, 0, 1.12, 0));
  g.add(mesh(new THREE.PlaneGeometry(0.7, 0.48), screenMat, 0, 1.12, 0.025));
  [0.16,0.22,0.14,0.28,0.18,0.32].forEach((h, i) => {
    g.add(mesh(new THREE.BoxGeometry(0.055, h * 0.38, 0.02), i % 2 === 0 ? up : dn, -0.26 + i * 0.105, 0.96 + h * 0.19, 0.04));
  });
  return g;
}

const FURNITURE_BUILDERS = {
  throne:   buildThrone,
  gold:     buildGoldPile,
  moon:     buildMoonLamp,
  desk:     buildTradingDesk,
  nft:      buildNftFrame,
  diamond:  buildDiamondDisplay,
  rocket:   buildRocket,
  chart:    buildCandleChart,
};

// ── Main component ───────────────────────────────────────────────────────────

export default function CoingameRoomPage() {
  const { coinId } = useParams();
  const ownCoin = useFinanceStore((s) => s.coingameOwnCoin);
  const holdings = useFinanceStore((s) => s.coingameHoldings);

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);

  const [coin, setCoin] = useState(null);
  const [tab, setTab] = useState('i');
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState([]);
  const [tooltip, setTooltip] = useState(null);

  const isOwner = ownCoin?.coin_id === coinId;

  useEffect(() => {
    let cancelled = false;
    fetchCoinById(coinId).then((c) => {
      if (!cancelled) { setCoin(c); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [coinId]);

  useEffect(() => {
    let cancelled = false;
    fetchCoinRewards(coinId).then((r) => {
      if (!cancelled) setRewards(r);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [coinId]);

  const savePosition = useCallback(async (collectableId, x, z, rotY) => {
    try {
      await updateFurniturePosition(coinId, collectableId, x, z, rotY);
      setRewards((prev) => prev.map((r) => r.id === collectableId ? { ...r, pos_x: x, pos_z: z, rot_y: rotY } : r));
    } catch {}
  }, [coinId]);

  // ── Three.js scene ─────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current;
    const cvs = canvasRef.current;
    if (!wrap || !cvs) return;

    let W = wrap.clientWidth;
    let H = wrap.clientHeight;

    const renderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.8;
    renderer.setClearColor(0x060806);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060806, 0.016);

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 120);
    camera.position.set(0, 8, 15);
    camera.lookAt(0, 1.5, 0);

    // ── Lighting ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x3a6a3a, 8));

    const ceilLight = new THREE.PointLight(0x22c55e, 28, 55);
    ceilLight.position.set(0, 8.5, 0);
    ceilLight.castShadow = true;
    ceilLight.shadow.mapSize.set(1024, 1024);
    scene.add(ceilLight);

    const accent1 = new THREE.PointLight(0x4ade80, 10, 28);
    accent1.position.set(-7, 4, -6);
    scene.add(accent1);

    const accent2 = new THREE.PointLight(0x22c55e, 8, 26);
    accent2.position.set(7, 3, 4);
    scene.add(accent2);

    const fillLeft = new THREE.PointLight(0x4ade80, 8, 24);
    fillLeft.position.set(-9, 3, 2);
    scene.add(fillLeft);

    const fillFront = new THREE.PointLight(0x86efac, 7, 24);
    fillFront.position.set(0, 2.5, 9);
    scene.add(fillFront);

    const fillBack = new THREE.PointLight(0x4ade80, 6, 22);
    fillBack.position.set(0, 3, -9);
    scene.add(fillBack);

    const fillRight = new THREE.PointLight(0x22c55e, 7, 22);
    fillRight.position.set(9, 3, 0);
    scene.add(fillRight);

    // ── Room shell ────────────────────────────────────────────────────────────
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d1a0d, roughness: 0.88, metalness: 0.05, side: THREE.BackSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w, ROOM.h, ROOM.d), wallMat);
    room.position.y = ROOM.h / 2;
    scene.add(room);

    // Floor
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0c160c, roughness: 0.7, metalness: 0.2 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor grid
    scene.add(new THREE.GridHelper(ROOM.w, ROOM.w, 0x0d2b0d, 0x0a1a0a));

    // Baseboard trim on walls
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0c1a0c, roughness: 0.4, metalness: 0.7 });
    const bH = 0.12;
    [
      [0, 0, -(ROOM.d/2 - 0.05), 0,         ROOM.w],
      [0, 0,  (ROOM.d/2 - 0.05), 0,         ROOM.w],
      [-(ROOM.w/2 - 0.05), 0, 0, Math.PI/2, ROOM.d],
      [ (ROOM.w/2 - 0.05), 0, 0, Math.PI/2, ROOM.d],
    ].forEach(([x, , z, ry, len]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(len, bH, 0.06), baseMat);
      b.position.set(x, bH / 2, z);
      b.rotation.y = ry;
      scene.add(b);
    });

    // Ceiling light fixture
    const fixtMat = new THREE.MeshStandardMaterial({ color: 0x0c1a0c, roughness: 0.3, metalness: 0.9 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xbbf7d0, emissive: 0x22c55e, emissiveIntensity: 1.8, roughness: 1 });
    const fixtBase = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 24), fixtMat);
    fixtBase.position.set(0, ROOM.h - 0.04, 0);
    scene.add(fixtBase);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), glowMat);
    bulb.position.set(0, ROOM.h - 0.22, 0);
    scene.add(bulb);
    const chord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), fixtMat);
    chord.position.set(0, ROOM.h - 0.55, 0);
    scene.add(chord);

    // Wall sconce lights (left & right walls)
    [-1, 1].forEach((side) => {
      const x = side * (ROOM.w / 2 - 0.12);
      const sconceMat = new THREE.MeshStandardMaterial({ color: 0x0c1a0c, roughness: 0.3, metalness: 0.85 });
      const sconceGlow = new THREE.MeshStandardMaterial({ color: 0x86efac, emissive: 0x4ade80, emissiveIntensity: 0.9, roughness: 1 });
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.22), sconceMat);
      plate.position.set(x, 5, -3);
      scene.add(plate);
      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), sconceGlow);
      globe.position.set(x - side * 0.12, 5, -3);
      scene.add(globe);
      const pl = new THREE.PointLight(0x4ade80, 1.1, 8);
      pl.position.set(x - side * 0.2, 5, -3);
      scene.add(pl);
    });

    // ── Static furniture (draggable, positions saved to localStorage) ──────────
    const STATIC_KEY = `cg-room-static-${coinId}`;
    const savedStatic = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');

    function tagStatic(group, id) {
      group.userData.furnitureId = id;
      group.traverse((c) => { c.userData.furnitureId = id; });
    }
    function placeStatic(group, defaultX, defaultZ) {
      const saved = savedStatic[group.userData.furnitureId];
      group.position.set(saved ? saved.x : defaultX, 0, saved ? saved.z : defaultZ);
      if (saved?.ry != null) group.rotation.y = saved.ry;
    }

    // Rug (grouped so it can be dragged)
    const rugGroup = new THREE.Group();
    const rugBorderMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.9 }));
    rugBorderMesh.rotation.x = -Math.PI / 2; rugBorderMesh.position.y = 0.004; rugGroup.add(rugBorderMesh);
    const rugMesh = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 8.5), new THREE.MeshStandardMaterial({ color: 0x052e16, roughness: 0.95, metalness: 0 }));
    rugMesh.rotation.x = -Math.PI / 2; rugMesh.position.y = 0.005; rugGroup.add(rugMesh);
    tagStatic(rugGroup, 'static_rug');
    placeStatic(rugGroup, 0, 0);
    scene.add(rugGroup);

    // Bookshelf (right wall)
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x0c1a0c, roughness: 0.45, metalness: 0.6 });
    const bookshelf = new THREE.Group();
    const bsFrame = new THREE.Mesh(new THREE.BoxGeometry(3.3, 4.8, 0.6), shelfMat);
    bsFrame.position.set(0, 2.4, 0); bookshelf.add(bsFrame);
    const shelfInner = new THREE.MeshStandardMaterial({ color: 0x0f2010, roughness: 0.5, metalness: 0.4 });
    [0.75, 1.95, 3.15, 4.35].forEach((y) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.09, 0.51), shelfInner);
      s.position.set(0, y, 0.015); bookshelf.add(s);
    });
    const bookColors = [0x22c55e, 0x16a34a, 0x4ade80, 0x052e16, 0x15803d, 0x166534];
    let bx = -1.32;
    bookColors.forEach((col) => {
      const bw = 0.15 + Math.random() * 0.15;
      const bh = 0.42 + Math.random() * 0.27;
      const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.42), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
      book.position.set(bx + bw/2, 1.95 + bh/2 + 0.045, 0.015); bookshelf.add(book);
      bx += bw + 0.022;
    });
    bx = -1.05;
    bookColors.slice().reverse().forEach((col) => {
      const bw = 0.135 + Math.random() * 0.12;
      const bh = 0.33 + Math.random() * 0.21;
      const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.42), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
      book.position.set(bx + bw/2, 3.15 + bh/2 + 0.045, 0.015); bookshelf.add(book);
      bx += bw + 0.015;
    });
    bookshelf.rotation.y = -Math.PI / 2;
    tagStatic(bookshelf, 'static_bookshelf');
    placeStatic(bookshelf, 9.5, -7);
    scene.add(bookshelf);

    // Sofa
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x0c1a0c, roughness: 0.88, metalness: 0.05 });
    const sofaAccent = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.85, metalness: 0 });
    const sofa = new THREE.Group();
    [[4.2,0.42,1.42,sofaMat,0,0.57,0],[4.2,1.08,0.3,sofaMat,0,1.08,-0.57],[4.2,0.18,1.42,sofaAccent,0,0.33,0]].forEach(([w,h,d,mat,x,y,z]) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat); p.position.set(x,y,z); sofa.add(p);
    });
    [-1.95, 1.95].forEach((x) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.78, 1.42), sofaMat); arm.position.set(x, 0.78, 0); sofa.add(arm);
    });
    [-1.05, 0, 1.05].forEach((x) => {
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.24, 1.05), sofaAccent);
      cushion.position.set(x, 0.84, 0.15); sofa.add(cushion);
    });
    tagStatic(sofa, 'static_sofa');
    placeStatic(sofa, 4, -9);
    scene.add(sofa);

    // Side table
    const tableGroup = new THREE.Group();
    const tTop = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.09, 16), shelfMat); tTop.position.set(0, 1.0, 0); tableGroup.add(tTop);
    const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 8), shelfMat); tLeg.position.set(0, 0.5, 0); tableGroup.add(tLeg);
    tagStatic(tableGroup, 'static_table');
    placeStatic(tableGroup, 6.2, -8.2);
    scene.add(tableGroup);

    // ── Central coin display ──────────────────────────────────────────────────
    const cg = new THREE.Group();
    cg.position.set(0, 2.6, 0);
    scene.add(cg);

    const coinMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 0.14, 80),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.03, metalness: 1, emissive: 0x15803d, emissiveIntensity: 0.35 })
    );
    coinMesh.castShadow = true; cg.add(coinMesh);

    const bev = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.07, 8, 80),
      new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.02, metalness: 1 })
    );
    bev.rotation.x = Math.PI / 2; cg.add(bev);

    const gemMat = new THREE.MeshStandardMaterial({ color: 0xbbf7d0, emissive: 0x22c55e, emissiveIntensity: 1.6, roughness: 0, metalness: 1 });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), gemMat);
    gem.position.y = 0.072; cg.add(gem);

    const ringMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.5, roughness: 0.1, metalness: 1 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.025, 8, 80), ringMat);
    ring.position.y = 0.38; ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    // ── Staging area (left wall) ───────────────────────────────────────────────
    const stageMat = new THREE.MeshStandardMaterial({ color: 0x0c1a0c, roughness: 0.4, metalness: 0.6 });
    const stageGlow = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.3, roughness: 0.1, metalness: 1 });

    const stageShelf = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, ROOM.d * 0.55), stageMat);
    stageShelf.position.set(-(ROOM.w / 2 - 0.22), 0.5, 0);
    scene.add(stageShelf);
    const stageStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, ROOM.d * 0.55), stageGlow);
    stageStrip.position.set(-(ROOM.w / 2 - 0.08), 0.54, 0);
    scene.add(stageStrip);

    // Label plane for staging area
    const stageLabelMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.15, roughness: 1 });
    const stageLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 1.8), stageLabelMat);
    stageLabel.position.set(-(ROOM.w / 2 - 0.05), 1.5, 0);
    stageLabel.rotation.y = Math.PI / 2;
    scene.add(stageLabel);

    // ── Particles ─────────────────────────────────────────────────────────────
    const N = 600;
    const pPos = new Float32Array(N * 3);
    const pCol = new Float32Array(N * 3);
    const pVel = [];
    for (let i = 0; i < N; i++) {
      pPos[i*3]   = (Math.random() - 0.5) * ROOM.w;
      pPos[i*3+1] = Math.random() * ROOM.h;
      pPos[i*3+2] = (Math.random() - 0.5) * ROOM.d;
      const v = Math.random();
      pCol[i*3] = 0; pCol[i*3+1] = 0.12 + v * 0.7; pCol[i*3+2] = 0;
      pVel.push(0.009 + Math.random() * 0.018);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.55 })));

    // ── Coin name sprite ──────────────────────────────────────────────────────
    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = 512; nameCanvas.height = 128;
    const nameCtx = nameCanvas.getContext('2d');
    const nameTex = new THREE.CanvasTexture(nameCanvas);
    const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTex, transparent: true, depthWrite: false }));
    nameSprite.scale.set(4.0, 1.0, 1);
    nameSprite.position.set(0, 1.55, 0);
    cg.add(nameSprite);

    // ── Furniture map: id → { group, isStaged } ──────────────────────────────
    const furnitureMap = {};
    const staticMap = { static_rug: rugGroup, static_bookshelf: bookshelf, static_sofa: sofa, static_table: tableGroup };
    sceneRef.current = { scene, furnitureMap, staticMap, isOwner, nameCanvas, nameCtx, nameTex, STATIC_KEY };

    // ── Orbit controls ────────────────────────────────────────────────────────
    let isDrag = false; let px = 0; let py = 0;
    let theta = 0.12; let phi = 0.40;
    let tTheta = 0.12; let tPhi = 0.40;
    let tRad = 15; let autoRot = true;

    // ── Drag-to-place state ────────────────────────────────────────────────────
    let dragging = null; // { id, group, origX, origZ }
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const intersectPt = new THREE.Vector3();

    function getPickables() {
      return [
        ...Object.values(furnitureMap).map((f) => f.group),
        ...Object.values(staticMap),
      ];
    }

    function findGroup(id) {
      if (furnitureMap[id]) return furnitureMap[id].group;
      if (staticMap[id]) return staticMap[id];
      return null;
    }

    function onMDown(e) {
      const rect = wrap.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / W) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / H) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      if (sceneRef.current?.isOwner) {
        const hits = raycaster.intersectObjects(getPickables(), true);
        if (hits.length > 0) {
          let obj = hits[0].object;
          while (obj.parent && !obj.userData.furnitureId) obj = obj.parent;
          const id = obj.userData.furnitureId;
          const group = id ? findGroup(id) : null;
          if (group) {
            dragging = { id, group, isStatic: id.startsWith('static_') };
            autoRot = false;
            return;
          }
        }
      }

      isDrag = true; autoRot = false; px = e.clientX; py = e.clientY;
    }

    function onMMove(e) {
      if (dragging) {
        const rect = wrap.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / W) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / H) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(floorPlane, intersectPt);
        const hw = ROOM.w / 2 - 1.2;
        const hd = ROOM.d / 2 - 1.2;
        const nx = Math.max(-hw, Math.min(hw, intersectPt.x));
        const nz = Math.max(-hd, Math.min(hd, intersectPt.z));
        dragging.group.position.set(nx, FLOOR_Y, nz);
        dragging.group.position.y = 0.08;
        return;
      }
      if (!isDrag) return;
      tTheta -= (e.clientX - px) * 0.007;
      tPhi = Math.max(0.1, Math.min(1.25, tPhi + (e.clientY - py) * 0.005));
      px = e.clientX; py = e.clientY;
    }

    function onMUp() {
      if (dragging) {
        const { id, group, isStatic } = dragging;
        const x = parseFloat(group.position.x.toFixed(3));
        const z = parseFloat(group.position.z.toFixed(3));
        group.position.y = FLOOR_Y;
        if (isStatic) {
          const cur = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');
          cur[id] = { x, z, ry: parseFloat(group.rotation.y.toFixed(4)) };
          localStorage.setItem(STATIC_KEY, JSON.stringify(cur));
        } else {
          if (furnitureMap[id]) furnitureMap[id].isStaged = false;
          savePosition(id, x, z, parseFloat(group.rotation.y.toFixed(4)));
        }
        dragging = null;
        return;
      }
      isDrag = false;
    }

    const onWheel = (e) => { tRad = Math.max(5, Math.min(22, tRad + e.deltaY * 0.013)); e.preventDefault(); };

    wrap.addEventListener('mousedown', onMDown);
    window.addEventListener('mousemove', onMMove);
    window.addEventListener('mouseup', onMUp);
    wrap.addEventListener('wheel', onWheel, { passive: false });

    let touchStart = null;
    const onTStart = (e) => {
      if (e.touches.length === 1) { autoRot = false; touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
    };
    const onTMove = (e) => {
      if (!touchStart || e.touches.length !== 1) return;
      tTheta -= (e.touches[0].clientX - touchStart.x) * 0.007;
      tPhi = Math.max(0.1, Math.min(1.25, tPhi + (e.touches[0].clientY - touchStart.y) * 0.005));
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      e.preventDefault();
    };
    wrap.addEventListener('touchstart', onTStart, { passive: true });
    wrap.addEventListener('touchmove', onTMove, { passive: false });

    const onKeyDown = (e) => {
      if ((e.key === 'r' || e.key === 'R') && dragging) {
        dragging.group.rotation.y += Math.PI / 4;
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // ── Animate ────────────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let animId;

    function animate() {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (autoRot) tTheta += 0.0018;
      theta += (tTheta - theta) * 0.06;
      phi += (tPhi - phi) * 0.06;
      camera.position.set(
        Math.sin(theta) * Math.cos(phi) * tRad,
        Math.sin(phi) * tRad + 1,
        Math.cos(theta) * Math.cos(phi) * tRad
      );
      camera.lookAt(0, 1.5, 0);

      cg.rotation.y = t * 0.65;
      cg.position.y = 2.6 + Math.sin(t * 1.0) * 0.18;
      gem.rotation.y = t * 2.0;

      ringMat.emissiveIntensity = 0.5 + Math.sin(t * 2.8) * 0.28;
      ceilLight.intensity = 28 + Math.sin(t * 1.4) * 3.0;
      ceilLight.position.x = Math.sin(t * 0.22) * 2.5;
      bulb.material.emissiveIntensity = 1.8 + Math.sin(t * 1.4) * 0.5;

      const pp = pGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        pp.array[i*3+1] -= pVel[i];
        if (pp.array[i*3+1] < 0) {
          pp.array[i*3+1] = ROOM.h;
          pp.array[i*3]   = (Math.random() - 0.5) * ROOM.w;
          pp.array[i*3+2] = (Math.random() - 0.5) * ROOM.d;
        }
      }
      pp.needsUpdate = true;

      // bob staged furniture
      Object.values(furnitureMap).forEach(({ group, isStaged }) => {
        if (isStaged) group.position.y = 0.53 + Math.sin(t * 1.8 + group.userData.bobOffset) * 0.06;
      });

      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(() => {
      W = wrap.clientWidth; H = wrap.clientHeight;
      camera.aspect = W / H; camera.updateProjectionMatrix();
      renderer.setSize(W, H, false);
    });
    ro.observe(wrap);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      wrap.removeEventListener('mousedown', onMDown);
      window.removeEventListener('mousemove', onMMove);
      window.removeEventListener('mouseup', onMUp);
      wrap.removeEventListener('wheel', onWheel);
      wrap.removeEventListener('touchstart', onTStart);
      wrap.removeEventListener('touchmove', onTMove);
      window.removeEventListener('keydown', onKeyDown);
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync furniture into scene when rewards load ───────────────────────────
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref || rewards.length === 0) return;
    const { scene, furnitureMap } = ref;

    // Remove furniture that's no longer in rewards (shouldn't happen but safe)
    Object.keys(furnitureMap).forEach((id) => {
      if (!rewards.find((r) => r.id === id)) {
        scene.remove(furnitureMap[id].group);
        delete furnitureMap[id];
      }
    });

    let stageSlot = 0;
    rewards.forEach((item) => {
      if (!item.unlocked) return;

      if (furnitureMap[item.id]) {
        const { group } = furnitureMap[item.id];
        if (item.pos_x != null && item.pos_z != null) {
          group.position.set(item.pos_x, FLOOR_Y, item.pos_z);
          if (item.rot_y != null) group.rotation.y = item.rot_y;
          furnitureMap[item.id].isStaged = false;
        }
        return;
      }

      const builder = FURNITURE_BUILDERS[item.id];
      if (!builder) return;

      const group = builder();
      group.userData.furnitureId = item.id;
      group.userData.bobOffset = Math.random() * Math.PI * 2;

      // Tag all children so raycaster can walk up to find the id
      group.traverse((child) => { child.userData.furnitureId = item.id; });

      const col = RARITY_HEX[item.rarity] ?? 0x22c55e;

      // Glow ring under item (owner drag affordance)
      if (ref.isOwner) {
        const ringGeo = new THREE.TorusGeometry(0.45, 0.018, 8, 48);
        const ringMat2 = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.1, metalness: 1 });
        const glowRing = new THREE.Mesh(ringGeo, ringMat2);
        glowRing.rotation.x = Math.PI / 2;
        glowRing.position.y = 0.02;
        group.add(glowRing);
      }

      group.scale.set(2, 2, 2);

      const isStaged = item.pos_x == null || item.pos_z == null;
      if (isStaged) {
        const sx = STAGE_X;
        const sz = STAGE_Z_START + stageSlot * STAGE_Z_STEP;
        group.position.set(sx, 0.53, sz);
        stageSlot++;
      } else {
        group.position.set(item.pos_x, FLOOR_Y, item.pos_z);
        if (item.rot_y != null) group.rotation.y = item.rot_y;
      }

      scene.add(group);
      furnitureMap[item.id] = { group, isStaged };
    });
  }, [rewards]);

  // Keep isOwner live in the scene (ownCoin may load after the scene effect)
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.isOwner = isOwner;
  }, [isOwner]);

  // Paint coin name onto the floating sprite canvas
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref?.nameCtx || !coin) return;
    const { nameCtx, nameCanvas, nameTex } = ref;
    const label = `$${(coin.coin_name || '').toUpperCase()}`;
    nameCtx.clearRect(0, 0, nameCanvas.width, nameCanvas.height);
    nameCtx.font = 'bold 64px "DM Mono", "Space Mono", monospace';
    nameCtx.textAlign = 'center';
    nameCtx.textBaseline = 'middle';
    // glow
    nameCtx.shadowColor = '#22c55e';
    nameCtx.shadowBlur = 18;
    nameCtx.fillStyle = '#4ade80';
    nameCtx.fillText(label, 256, 64);
    // sharp layer on top
    nameCtx.shadowBlur = 0;
    nameCtx.fillStyle = '#bbf7d0';
    nameCtx.fillText(label, 256, 64);
    nameTex.needsUpdate = true;
  }, [coin]);

  // ── Derived UI values ────────────────────────────────────────────────────
  const price = coin ? spotPrice(Number(coin.tokens_minted), Number(coin.base_price)) : 0;
  const holding = holdings.find((h) => h.coin_id === coinId);
  const coinName = coin?.coin_name || coin?.profiles?.username || '?';
  const initial = (coinName[0] || '?').toUpperCase();
  const unlockedCount = rewards.filter((r) => r.unlocked).length;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#060806', fontFamily: "'DM Mono', 'Space Mono', monospace", overflow: 'hidden', position: 'relative' }}>
      <div ref={wrapRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

        {/* HUD */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
          <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(6,8,6,0.92)', border: '1px solid #1a2e1a', borderRadius: 10, padding: '14px 16px', backdropFilter: 'blur(12px)', minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#052e16', border: '1.5px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>
                {loading ? '?' : initial}
              </div>
              <div>
                <div style={{ color: '#22c55e', fontSize: 14, fontWeight: 700 }}>${coinName.toUpperCase()}</div>
                <div style={{ color: '#4b5563', fontSize: 9, marginTop: 2 }}>{coinName}&apos;s room</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div style={{ background: '#0d0d0d', border: '1px solid #1a2e1a', borderRadius: 6, padding: '6px 8px' }}>
                <div style={{ color: '#4b5563', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Price</div>
                <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700, marginTop: 2 }}>{loading ? '—' : <FC amount={price} />}</div>
              </div>
              <div style={{ background: '#0d0d0d', border: '1px solid #1a2e1a', borderRadius: 6, padding: '6px 8px' }}>
                <div style={{ color: '#4b5563', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Supply</div>
                <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700, marginTop: 2 }}>{loading ? '—' : Number(coin?.tokens_minted ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          </div>

          {isOwner && (
            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(6,8,6,0.82)', border: '1px solid #1a2e1a', borderRadius: 6, padding: '5px 12px', color: '#4b5563', fontSize: 9, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
              drag items to place them · scroll to zoom
            </div>
          )}
          {!isOwner && (
            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', color: '#1e3a1e', fontSize: 9, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
              drag to orbit · scroll to zoom
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div style={{ width: 260, flexShrink: 0, background: '#111111', borderLeft: '1px solid #1a2e1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 16px 13px', borderBottom: '1px solid #1a2e1a' }}>
          <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <LucideIcons.Home size={13} /> {loading ? '...' : `${coinName}'s room`}
          </div>
          <div style={{ color: '#4b5563', fontSize: 9 }}>Virtual meme coin lair</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #1a2e1a' }}>
          {[['i', 'Info'], ['r', 'Rewards']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{ flex: 1, padding: '9px 0', background: 'none', border: 'none', borderBottom: tab === key ? '2px solid #22c55e' : '2px solid transparent', color: tab === key ? '#22c55e' : '#4b5563', fontSize: 10, fontFamily: 'inherit', fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              {label}{key === 'r' && rewards.length > 0 ? ` ${unlockedCount}/${rewards.length}` : ''}
            </button>
          ))}
        </div>

        <div style={{ padding: 14, flex: 1, overflowY: 'auto' }}>
          {tab === 'i' && (
            <>
              <div style={{ color: '#4b5563', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Coin info</div>
              {[
                ['Price', loading ? '—' : <FC amount={price} />],
                ['Supply', loading ? '—' : Number(coin?.tokens_minted ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })],
                ['Status', coin?.status ?? '—'],
                ['Your hold', holding ? `${Number(holding.tokens_held).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${coinName}` : '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#161616', borderRadius: 6, border: '1px solid #1a2e1a', marginBottom: 6 }}>
                  <span style={{ color: '#4b5563', fontSize: 10 }}>{label}</span>
                  <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </>
          )}

          {tab === 'r' && (
            <>
              <div style={{ color: '#4b5563', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Collectables</div>
              {rewards.length === 0 && (
                <div style={{ color: '#374151', fontSize: 10, textAlign: 'center', marginTop: 24 }}>Loading...</div>
              )}
              {rewards.map((item) => {
                const Icon = LucideIcons[item.icon] ?? LucideIcons.Star;
                const rarityColors = { legendary: '#f59e0b', epic: '#c084fc', rare: '#38bdf8', uncommon: '#4ade80', common: '#6b7280' };
                const col = item.unlocked ? (rarityColors[item.rarity] ?? '#6b7280') : '#1f2937';
                const isPlaced = item.unlocked && item.pos_x != null && item.pos_z != null;
                return (
                  <div
                    key={item.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', background: item.unlocked ? '#161616' : '#0f0f0f', borderRadius: 7, border: `1px solid ${item.unlocked ? '#1a2e1a' : '#111'}`, marginBottom: 6, opacity: item.unlocked ? 1 : 0.5 }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 7, background: item.unlocked ? `${col}18` : '#161616', border: `1px solid ${item.unlocked ? col : '#1f2937'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={14} color={col} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: item.unlocked ? '#e2e8f0' : '#374151', fontSize: 11, fontWeight: 700 }}>{item.label}</div>
                      <div style={{ color: item.unlocked ? col : '#374151', fontSize: 9, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {item.unlocked ? item.rarity : item.unlock_description}
                      </div>
                    </div>
                    {item.unlocked && (
                      <div style={{ flexShrink: 0 }}>
                        {isPlaced
                          ? <LucideIcons.Check size={12} color="#22c55e" />
                          : <LucideIcons.MoveRight size={12} color="#4b5563" title="in staging area" />
                        }
                      </div>
                    )}
                  </div>
                );
              })}
              {isOwner && unlockedCount > 0 && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: '#0f0f0f', borderRadius: 6, border: '1px solid #1a2e1a', color: '#4b5563', fontSize: 9, lineHeight: 1.5 }}>
                  Unplaced items appear on the left shelf. Drag them into the room to position them.
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '12px 14px 14px', borderTop: '1px solid #1a2e1a', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link to={`/coingame/coin/${coinId}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: 12, background: '#22c55e', border: 'none', borderRadius: 7, color: '#000', fontSize: 12, fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', letterSpacing: '0.04em' }}>
            <LucideIcons.TrendingUp size={13} /> Trade ${coinName.toUpperCase()}
          </Link>
          <Link to="/coingame/market" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: 9, background: 'transparent', border: '1px solid #1a2e1a', borderRadius: 7, color: '#4b5563', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'none' }}>
            <LucideIcons.ArrowLeft size={11} /> Back to Market
          </Link>
        </div>
      </div>
    </div>
  );
}
