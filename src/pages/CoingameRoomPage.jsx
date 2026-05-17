import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as LucideIcons from 'lucide-react';
import { fetchCoinById, spotPrice } from '../utils/coingameApi';
import { useFinanceStore } from '../store/useFinanceStore';
import { HOME_PACK, HOME_PACK_CATEGORIES, findHomeModel, loadHomeModel } from '../utils/coinroomHomePack';
import { getSupabaseBrowserClient } from '../utils/supabase';
import { serializeLocalLayout, applyLayoutToLocal, fetchRoomLayout, saveRoomLayout } from '../utils/coinroomSync';
import HomeModelThumb from '../components/coingame/HomeModelThumb';

const ROOM = { w: 22, d: 22, h: 9 };
const FLOOR_Y = 0;

const AMBIENT_PRESETS = ['#22c55e','#a855f7','#3b82f6','#06b6d4','#f97316','#ef4444','#ec4899','#94a3b8'];

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

// Beveled box via ExtrudeGeometry — soft edges that catch light
function bevelBox(w, h, d, bevel = 0.02, smooth = 2) {
  const shape = new THREE.Shape();
  const hw = w / 2; const hh = h / 2;
  shape.moveTo(-hw, -hh); shape.lineTo(hw, -hh); shape.lineTo(hw, hh); shape.lineTo(-hw, hh); shape.lineTo(-hw, -hh);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: smooth, curveSegments: 4 });
  geo.translate(0, 0, -d / 2);
  return geo;
}


function buildCubeStage0() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.08, metalness: 1, emissive: 0x22c55e, emissiveIntensity: 0.5 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xbbf7d0, emissive: 0x22c55e, emissiveIntensity: 3.0, roughness: 0.1, metalness: 0.5 });
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mat));
  [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([a,b]) => {
    g.add(mesh(new THREE.BoxGeometry(0.72, 0.04, 0.04), edgeMat, 0, a*0.35, b*0.35));
    g.add(mesh(new THREE.BoxGeometry(0.04, 0.72, 0.04), edgeMat, a*0.35, 0, b*0.35));
    g.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 0.72), edgeMat, a*0.35, b*0.35, 0));
  });
  g.add(new THREE.PointLight(0x22c55e, 3, 5));
  return g;
}

function buildCubeStage1() {
  const g = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 1.4, roughness: 0, metalness: 0.4 });
  const cageMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.0, roughness: 0.1, metalness: 1 });
  g.add(mesh(new THREE.OctahedronGeometry(0.42), coreMat));
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.02, 8, 48), cageMat);
  r1.rotation.x = Math.PI / 2;
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.02, 8, 48), cageMat);
  r2.rotation.z = Math.PI / 3;
  g.add(r1); g.add(r2);
  g.add(new THREE.PointLight(0x22d3ee, 5, 7));
  g.userData.spinRings = [r1, r2];
  return g;
}

function buildCubeStage2() {
  const g = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x818cf8, emissive: 0x6366f1, emissiveIntensity: 1.6, roughness: 0, metalness: 0.3 });
  const r1Mat = new THREE.MeshStandardMaterial({ color: 0xc4b5fd, emissive: 0xa78bfa, emissiveIntensity: 1.1, roughness: 0.1, metalness: 0.9 });
  const r2Mat = new THREE.MeshStandardMaterial({ color: 0xf0abfc, emissive: 0xe879f9, emissiveIntensity: 0.9, roughness: 0.1, metalness: 1 });
  g.add(mesh(new THREE.SphereGeometry(0.36, 24, 24), coreMat));
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.60, 0.024, 8, 64), r1Mat);
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.60, 0.024, 8, 64), r2Mat);
  r2.rotation.y = Math.PI / 3;
  g.add(r1); g.add(r2);
  g.add(new THREE.PointLight(0x7c3aed, 6, 8));
  g.userData.orbitRings = [r1, r2];
  return g;
}

function buildCubeStage3() {
  const g = new THREE.Group();
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 2.0, roughness: 0, metalness: 1 });
  const r1Mat = new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xfcd34d, emissiveIntensity: 1.3, roughness: 0, metalness: 1 });
  const r2Mat = new THREE.MeshStandardMaterial({ color: 0xc084fc, emissive: 0xa855f7, emissiveIntensity: 1.1, roughness: 0, metalness: 1 });
  const r3Mat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.1, roughness: 0, metalness: 1 });
  g.add(mesh(new THREE.IcosahedronGeometry(0.40, 0), coreMat));
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.026, 8, 64), r1Mat);
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.026, 8, 64), r2Mat);
  r2.rotation.x = Math.PI / 2;
  const r3 = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.026, 8, 64), r3Mat);
  r3.rotation.z = Math.PI / 3;
  g.add(r1); g.add(r2); g.add(r3);
  g.add(new THREE.PointLight(0xf59e0b, 8, 10));
  g.userData.orbitRings = [r1, r2, r3];
  return g;
}

function buildFCCube() {
  const outer = new THREE.Group();
  const stages = [buildCubeStage0(), buildCubeStage1(), buildCubeStage2(), buildCubeStage3()];
  stages.forEach((s, i) => { s.visible = i === 0; outer.add(s); });
  outer.userData.stages = stages;
  outer.userData.currentStage = 0;
  outer.userData.setStage = (n) => {
    stages.forEach((s, i) => { s.visible = i === n; });
    outer.userData.currentStage = n;
  };
  outer.userData.isBucket = true;
  outer.userData.furnitureId = 'fc_cube';
  outer.traverse((c) => { c.userData.furnitureId = 'fc_cube'; });
  return outer;
}


const SPACESHIP_ROOM_SIZE = 30;

const UPGRADES = [
  { id: 'cursor',  label: 'Gilded Cursor',  desc: '+1 per click',        baseCost: 20,     click: 1,   passive: 0,   crit: 0    },
  { id: 'auto',    label: 'Auto Ticker',    desc: '+0.5 RC/s',           baseCost: 65,     click: 0,   passive: 0.5, crit: 0    },
  { id: 'power',   label: 'Power Click',    desc: '+5 per click',        baseCost: 280,    click: 5,   passive: 0,   crit: 0    },
  { id: 'turbo',   label: 'Turbo Ticker',   desc: '+2 RC/s',             baseCost: 560,    click: 0,   passive: 2,   crit: 0    },
  { id: 'mega',    label: 'Mega Click',     desc: '+20 per click',       baseCost: 2400,   click: 20,  passive: 0,   crit: 0    },
  { id: 'farm',    label: 'Coin Farm',      desc: '+10 RC/s',            baseCost: 7200,   click: 0,   passive: 10,  crit: 0    },
  { id: 'lucky',   label: 'Lucky Strike',   desc: '+1% crit chance',     baseCost: 1500,   click: 0,   passive: 0,   crit: 0.01 },
  { id: 'quantum', label: 'Quantum Click',  desc: '+100 per click',      baseCost: 18000,  click: 100, passive: 0,   crit: 0    },
  { id: 'empire',  label: 'Coin Empire',    desc: '+50 RC/s',            baseCost: 55000,  click: 0,   passive: 50,  crit: 0    },
  { id: 'cosmic',  label: 'Cosmic Tick',    desc: '+200 RC/s',           baseCost: 350000, click: 0,   passive: 200, crit: 0    },
];

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
  const [layoutReady, setLayoutReady] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [ambientColor, setAmbientColor] = useState(() => localStorage.getItem(`cg-room-ambient-${coinId}`) || '#22c55e');
  const [bucketToast, setBucketToast] = useState(null);
  const bucketCallbackRef = useRef(null);

  const [roomCoins, setRoomCoins] = useState(() => parseFloat(localStorage.getItem(`cg-rc-${coinId}`) || '0'));
  const [upgradesPurchased, setUpgradesPurchased] = useState(() => JSON.parse(localStorage.getItem(`cg-ru-${coinId}`) || '{}'));
  const [homeOwned, setHomeOwned] = useState(() => {
    const raw = JSON.parse(localStorage.getItem(`cg-home-${coinId}`) || '{}');
    const cleaned = {};
    Object.entries(raw).forEach(([name, v]) => { if (findHomeModel(name)) cleaned[name] = v; });
    return cleaned;
  });
  const [roomSize] = useState(SPACESHIP_ROOM_SIZE);
  const [buildMode, setBuildMode] = useState(false);
  const [walls, setWalls] = useState(() => JSON.parse(localStorage.getItem(`cg-walls-${coinId}`) || '[]'));
  const [wallView, setWallView] = useState('up'); // 'up' | 'cut' | 'down'
  const [chatDraft, setChatDraft] = useState('');
  const [emoteWheelOpen, setEmoteWheelOpen] = useState(false);
  const [homeCategory, setHomeCategory] = useState('All');
  const [homeSearch, setHomeSearch] = useState('');
  const [floaters, setFloaters] = useState([]);
  const [combo, setCombo] = useState(0);
  const [sessionClicks, setSessionClicks] = useState(0);
  const [totalClicks, setTotalClicks] = useState(() => parseInt(localStorage.getItem(`cg-rt-${coinId}`) || '0', 10));
  const lastClickRef = useRef(0);
  const comboTimerRef = useRef(null);
  const clickerCallbackRef = useRef(null);
  const floaterIdRef = useRef(0);

  const [hype, setHype] = useState(0);
  const [hypePhase, setHypePhase] = useState('normal'); // 'normal' | 'pumping' | 'crashed'
  const [critFlash, setCritFlash] = useState(false);
  const [evolutionToast, setEvolutionToast] = useState(null);
  const hypePhaseRef = useRef('normal');
  const prevStageRef = useRef(totalClicks >= 1000 ? 3 : totalClicks >= 200 ? 2 : totalClicks >= 50 ? 1 : 0);

  const isOwner = ownCoin?.coin_id === coinId;
  const clickPower = 1 + UPGRADES.reduce((acc, u) => acc + u.click * (upgradesPurchased[u.id] || 0), 0);
  const passiveRate = UPGRADES.reduce((acc, u) => acc + u.passive * (upgradesPurchased[u.id] || 0), 0);
  const critChance = Math.min(0.95, 0.05 + UPGRADES.reduce((acc, u) => acc + u.crit * (upgradesPurchased[u.id] || 0), 0));
  const upgradeLevel = Math.floor(Math.log2(totalClicks + 2));
  const cubeStage = totalClicks >= 1000 ? 3 : totalClicks >= 200 ? 2 : totalClicks >= 50 ? 1 : 0;
  const hypeMultiplier = hypePhase === 'pumping' ? 2 : 1;
  const hypeColor = hype >= 80 ? '#ef4444' : hype >= 50 ? '#f97316' : hype >= 25 ? '#f59e0b' : '#22c55e';
  const STAGE_NAMES = ['Starter Cube', 'Power Gem', 'Cosmic Orb', 'Legendary Core'];

  function buyUpgrade(upgId) {
    const upg = UPGRADES.find((u) => u.id === upgId);
    if (!upg) return;
    const count = upgradesPurchased[upgId] || 0;
    const cost = Math.ceil(upg.baseCost * Math.pow(1.5, count));
    if (roomCoins < cost) return;
    setRoomCoins((c) => c - cost);
    setUpgradesPurchased((u) => ({ ...u, [upgId]: count + 1 }));
  }

  // Each entry is a count; instance scene-ids are `static_<kind>_<name>_<idx>` for idx 0..count-1
  const ownedCount = (map, key) => {
    const v = map?.[key];
    if (typeof v === 'number') return v;
    if (v === true) return 1;
    return 0;
  };

  function buyHomeItem(name) {
    if (!isOwner) return;
    const item = findHomeModel(name);
    if (!item) return;
    if (roomCoins < item.price) return;
    setRoomCoins((c) => c - item.price);
    setHomeOwned((o) => ({ ...o, [name]: ownedCount(o, name) + 1 }));
  }

  function removeHomeItem(name, slotIdx) {
    if (!isOwner) return;
    const cnt = ownedCount(homeOwned, name);
    if (cnt < 1) return;
    const item = findHomeModel(name);
    if (!item) return;
    setRoomCoins((c) => c + Math.floor(item.price * 0.5));
    setHomeOwned((o) => {
      const n = { ...o };
      const next = ownedCount(n, name) - 1;
      if (next <= 0) delete n[name]; else n[name] = next;
      return n;
    });
    const STATIC_KEY = sceneRef.current?.STATIC_KEY;
    if (STATIC_KEY) {
      const idx = slotIdx != null ? slotIdx : cnt - 1;
      const cur = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');
      delete cur[`static_home_${name}_${idx}`];
      localStorage.setItem(STATIC_KEY, JSON.stringify(cur)); sceneRef.current?.markLayoutDirty?.();
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchCoinById(coinId).then((c) => {
      if (!cancelled) { setCoin(c); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [coinId]);

  // Persist clicker state
  useEffect(() => { localStorage.setItem(`cg-rc-${coinId}`, roomCoins.toFixed(3)); }, [roomCoins, coinId]);
  useEffect(() => { localStorage.setItem(`cg-ru-${coinId}`, JSON.stringify(upgradesPurchased)); }, [upgradesPurchased, coinId]);
  useEffect(() => { localStorage.setItem(`cg-rt-${coinId}`, String(totalClicks)); }, [totalClicks, coinId]);
  useEffect(() => { localStorage.setItem(`cg-home-${coinId}`, JSON.stringify(homeOwned)); }, [homeOwned, coinId]);
  useEffect(() => { localStorage.setItem(`cg-walls-${coinId}`, JSON.stringify(walls)); }, [walls, coinId]);

  // Fetch the owner's room layout from Supabase on mount so visitors see it
  useEffect(() => {
    let cancelled = false;
    setLayoutReady(false);
    (async () => {
      try {
        const layout = await fetchRoomLayout(coinId);
        if (cancelled) return;
        if (layout) {
          applyLayoutToLocal(coinId, layout);
          try { setWalls(JSON.parse(localStorage.getItem(`cg-walls-${coinId}`) || '[]')); } catch (_) {}
          try { const raw = JSON.parse(localStorage.getItem(`cg-home-${coinId}`) || '{}'); const cleaned = {}; Object.entries(raw).forEach(([n, v]) => { if (findHomeModel(n)) cleaned[n] = v; }); setHomeOwned(cleaned); } catch (_) {}
          const amb = localStorage.getItem(`cg-room-ambient-${coinId}`);
          if (amb) setAmbientColor(amb);
        }
      } finally {
        if (!cancelled) setLayoutReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [coinId]);

  // For owner: debounce-save layout to Supabase whenever any synced state changes
  useEffect(() => {
    if (!isOwner || !layoutReady) return;
    const tid = setTimeout(() => {
      saveRoomLayout(coinId, serializeLocalLayout(coinId))
        .then(() => {
          const ch = sceneRef.current?.supaChannel;
          if (ch) ch.send({ type: 'broadcast', event: 'layout', payload: { coinId } });
        })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(tid);
  }, [coinId, isOwner, layoutReady, walls, homeOwned, roomSize, ambientColor, layoutVersion]);

  function addWall(w) { setWalls((prev) => [...prev, w]); }
  function deleteWall(id) { setWalls((prev) => prev.filter((w) => w.id !== id)); }
  function clearAllWalls() {
    if (!isOwner) return;
    setWalls([]);
  }

  // Sync home-pack owned items into scene as static instances (async OBJ load, draggable)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const { scene, staticMap, STATIC_KEY } = ref;
    const savedStatic = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');
    const defaults = [[-4, 4], [4, 4], [-5, 0], [5, 0], [-4, -4], [4, -4], [0, 5], [0, -5]];
    let slot = 0;

    // Remove instances that are no longer owned
    Object.keys(staticMap).forEach((id) => {
      if (!id.startsWith('static_home_')) return;
      const rest = id.slice('static_home_'.length);
      const lastUnder = rest.lastIndexOf('_');
      const name = lastUnder > 0 ? rest.slice(0, lastUnder) : rest;
      const idxStr = lastUnder > 0 ? rest.slice(lastUnder + 1) : '0';
      const idx = parseInt(idxStr, 10);
      const cnt = ownedCount(homeOwned, name);
      if (Number.isNaN(idx) || idx >= cnt) {
        if (staticMap[id]?.isObject3D) scene.remove(staticMap[id]);
        delete staticMap[id];
      }
    });

    // Add missing instances (one per slot 0..count-1)
    Object.entries(homeOwned).forEach(([name, raw]) => {
      const cnt = ownedCount({ [name]: raw }, name);
      for (let i = 0; i < cnt; i++) {
        const sid = `static_home_${name}_${i}`;
        if (staticMap[sid]) continue;
        staticMap[sid] = 'loading';
        const [dx, dz] = defaults[slot % defaults.length];
        slot++;
        // capture sid in closure
        const mySid = sid;
        loadHomeModel(name).then((group) => {
          if (!sceneRef.current || sceneRef.current.scene !== scene) return;
          if (ownedCount(homeOwned, name) <= i) { delete staticMap[mySid]; return; }
          group.userData.furnitureId = mySid;
          group.traverse((c) => { c.userData.furnitureId = mySid; });
          const saved = savedStatic[mySid];
          group.position.set(saved ? saved.x : dx, saved?.y != null ? saved.y : 0, saved ? saved.z : dz);
          if (saved?.ry != null) group.rotation.y = saved.ry;
          scene.add(group);
          staticMap[mySid] = group;
        }).catch(() => { delete staticMap[mySid]; });
      }
    });
  }, [homeOwned]);

  // Passive income tick
  useEffect(() => {
    if (passiveRate <= 0) return;
    const id = setInterval(() => setRoomCoins((c) => c + passiveRate / 10), 100);
    return () => clearInterval(id);
  }, [passiveRate]);

  // Clicker callback — captured fresh each render so combo/clickPower/hype are current
  useEffect(() => {
    clickerCallbackRef.current = () => {
      // build hype on click (not during crash)
      if (hypePhaseRef.current !== 'crashed' && hypePhaseRef.current !== 'pumping') {
        setHype((h) => Math.min(100, h + 9));
      }

      const now = Date.now();
      const gap = now - lastClickRef.current;
      lastClickRef.current = now;
      const newCombo = gap < 600 ? combo + 1 : 0;
      setCombo(newCombo);
      const comboMult = newCombo >= 5 ? 1 + Math.floor(newCombo / 5) * 0.5 : 1;

      const isCrit = Math.random() < critChance;
      if (isCrit) {
        setCritFlash(true);
        setTimeout(() => setCritFlash(false), 380);
      }

      const earned = Math.max(1, Math.floor(clickPower * comboMult * (isCrit ? 10 : 1) * hypeMultiplier));
      setRoomCoins((c) => c + earned);
      setSessionClicks((s) => s + 1);
      setTotalClicks((t) => t + 1);

      const fId = ++floaterIdRef.current;
      const x = 36 + Math.random() * 28;
      const y = 26 + Math.random() * 30;
      setFloaters((f) => [...f, { id: fId, amount: earned, x, y, isCombo: newCombo >= 5, isCrit }]);
      setTimeout(() => setFloaters((f) => f.filter((fl) => fl.id !== fId)), 1400);
      clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => setCombo(0), 1500);
    };
  }, [combo, clickPower, hypeMultiplier, critChance]);

  // Hype drain — runs unconditionally, reads phase via ref
  useEffect(() => {
    const id = setInterval(() => {
      if (hypePhaseRef.current === 'pumping') return;
      setHype((h) => Math.max(0, h - (hypePhaseRef.current === 'crashed' ? 0 : 0.7)));
    }, 140);
    return () => clearInterval(id);
  }, []);

  // Hype peak → pump → crash state machine
  useEffect(() => {
    if (hype >= 100 && hypePhase === 'normal') {
      setHypePhase('pumping');
      hypePhaseRef.current = 'pumping';
      if (sceneRef.current) sceneRef.current.hypePumping = true;
      const crashTimer = setTimeout(() => {
        setHypePhase('crashed');
        hypePhaseRef.current = 'crashed';
        setHype(0);
        if (sceneRef.current) sceneRef.current.hypePumping = false;
        const recoverTimer = setTimeout(() => {
          setHypePhase('normal');
          hypePhaseRef.current = 'normal';
        }, 6000);
        return () => clearTimeout(recoverTimer);
      }, 15000);
      return () => clearTimeout(crashTimer);
    }
  }, [hype, hypePhase]);

  // Cube stage evolution
  useEffect(() => {
    if (cubeStage > prevStageRef.current) {
      setEvolutionToast(STAGE_NAMES[cubeStage]);
      setTimeout(() => setEvolutionToast(null), 3200);
    }
    prevStageRef.current = cubeStage;
    sceneRef.current?.evolveCube?.(cubeStage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cubeStage]);

  // ── Three.js scene ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Drive room dimensions from state so expansion rebuilds the scene at new size.
    // Spaceship hull (Blender-exported Spaceship_interior.obj) — dims ~64 × 10 × 45 with the roof cut off
    ROOM.w = 64;
    ROOM.d = 45;
    ROOM.h = 9.8;
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

    // ── Sci-fi ambient audio ────────────────────────────────────────────────
    let audioCtx = null;
    let ambientNodes = null;
    function ensureAudio() {
      if (audioCtx) return audioCtx;
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
      return audioCtx;
    }
    function startAmbientHum() {
      const ctx = ensureAudio();
      if (!ctx || ambientNodes) return;
      const master = ctx.createGain();
      master.gain.value = 0.035;
      master.connect(ctx.destination);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 280;
      lp.Q.value = 1.2;
      lp.connect(master);
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60; o1.connect(lp); o1.start();
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 60.4; o2.connect(lp); o2.start();
      const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 120; o3.connect(lp); o3.start();
      // Subtle pulsing LFO on the master
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain); lfoGain.connect(master.gain); lfo.start();
      ambientNodes = { master, lp, oscs: [o1, o2, o3, lfo] };
    }
    function playJoinBeep() {
      const ctx = ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      g.connect(ctx.destination);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 880; o.connect(g);
      o.start(now); o.stop(now + 0.3);
      // Second tone — quick fifth above for the "ping" feel
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, now + 0.06);
      g2.gain.linearRampToValueAtTime(0.1, now + 0.07);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      g2.connect(ctx.destination);
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 1320; o2.connect(g2);
      o2.start(now + 0.05); o2.stop(now + 0.34);
    }
    // Browsers block AudioContext until a user gesture — kick off the hum on first interaction
    const kickAudio = () => {
      const ctx = ensureAudio();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      startAmbientHum();
      window.removeEventListener('pointerdown', kickAudio);
      window.removeEventListener('keydown', kickAudio);
    };
    window.addEventListener('pointerdown', kickAudio);
    window.addEventListener('keydown', kickAudio);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060806, 0.0008);

    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 3000);
    camera.position.set(0, 8, 15);
    camera.lookAt(0, 1.5, 0);

    // ── Lighting ──────────────────────────────────────────────────────────────
    const initAmbient = localStorage.getItem(`cg-room-ambient-${coinId}`) || '#22c55e';
    const ic = new THREE.Color(initAmbient);

    const hemi = new THREE.HemisphereLight(ic, new THREE.Color().setScalar(0.08), 14);
    scene.add(hemi);

    const ceilLight = new THREE.PointLight(ic, 40, 65);
    ceilLight.position.set(0, 8.5, 0);
    ceilLight.castShadow = true;
    ceilLight.shadow.mapSize.set(1024, 1024);
    scene.add(ceilLight);

    const fillLights = [
      new THREE.PointLight(ic, 14, 32), // front
      new THREE.PointLight(ic, 14, 32), // back
      new THREE.PointLight(ic, 14, 32), // left
      new THREE.PointLight(ic, 14, 32), // right
      new THREE.PointLight(ic, 10, 28), // corner fl
      new THREE.PointLight(ic, 10, 28), // corner fr
      new THREE.PointLight(ic, 10, 28), // corner bl
      new THREE.PointLight(ic, 10, 28), // corner br
    ];
    [[0,4,9],[0,4,-9],[-9,4,0],[9,4,0],[-8,3,8],[8,3,8],[-8,3,-8],[8,3,-8]].forEach(([x,y,z], i) => {
      fillLights[i].position.set(x, y, z);
      scene.add(fillLights[i]);
    });

    // ── Spaceship hull — metal panels with viewport cutouts ──
    function makeHullPanelTexture() {
      const c = document.createElement('canvas');
      c.width = 1024; c.height = 256;
      const cx = c.getContext('2d');
      // Brushed dark metal base
      const g = cx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#1c2230'); g.addColorStop(0.5, '#252b3a'); g.addColorStop(1, '#161a25');
      cx.fillStyle = g; cx.fillRect(0, 0, 1024, 256);
      // Subtle horizontal scan lines
      cx.globalAlpha = 0.08;
      for (let y = 0; y < 256; y += 2) {
        cx.fillStyle = y % 4 === 0 ? '#3a4258' : '#10131c';
        cx.fillRect(0, y, 1024, 1);
      }
      cx.globalAlpha = 1;
      // Panel seams (vertical)
      cx.strokeStyle = '#0a0d14'; cx.lineWidth = 2;
      for (let x = 0; x <= 1024; x += 128) {
        cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, 256); cx.stroke();
      }
      cx.strokeStyle = '#3a4258'; cx.lineWidth = 1;
      for (let x = 0; x <= 1024; x += 128) {
        cx.beginPath(); cx.moveTo(x + 1, 0); cx.lineTo(x + 1, 256); cx.stroke();
      }
      // Panel seams (horizontal)
      cx.strokeStyle = '#0a0d14'; cx.lineWidth = 2;
      [0, 128, 256].forEach((y) => { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(1024, y); cx.stroke(); });
      // Bolts at panel corners
      cx.fillStyle = '#0a0d14';
      for (let x = 0; x <= 1024; x += 128) {
        for (let y = 0; y <= 256; y += 128) {
          cx.beginPath(); cx.arc(x + (x % 256 === 0 ? 8 : -8), y + (y === 0 ? 8 : -8), 3, 0, Math.PI * 2); cx.fill();
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }
    const hullTexShared = makeHullPanelTexture();
    function buildSpaceshipWall(w, h, trimColorHex, opts = {}) {
      const group = new THREE.Group();
      const winCount = opts.winCount !== undefined ? opts.winCount : 2;
      const winW = opts.winW !== undefined ? opts.winW : Math.min(5, w / (winCount + 1.4));
      const winH = opts.winH !== undefined ? opts.winH : Math.min(3.6, h * 0.42);
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2);
      shape.lineTo(w / 2, h / 2);   shape.lineTo(-w / 2, h / 2);
      shape.lineTo(-w / 2, -h / 2);
      const winYCenter = 0;
      const winFrames = [];
      if (winCount > 0) {
        for (let i = 0; i < winCount; i++) {
          const cx = winCount === 1 ? 0 : -w / 2 + (w * (i + 1)) / (winCount + 1);
          const hole = new THREE.Path();
          hole.moveTo(cx - winW / 2, winYCenter - winH / 2);
          hole.lineTo(cx + winW / 2, winYCenter - winH / 2);
          hole.lineTo(cx + winW / 2, winYCenter + winH / 2);
          hole.lineTo(cx - winW / 2, winYCenter + winH / 2);
          hole.lineTo(cx - winW / 2, winYCenter - winH / 2);
          shape.holes.push(hole);
          winFrames.push({ cx, cy: winYCenter });
        }
      }
      const wallTex = hullTexShared.clone();
      wallTex.needsUpdate = true;
      wallTex.repeat.set(w / 8, h / 8);
      const wallMat = new THREE.MeshStandardMaterial({
        map: wallTex, color: 0x9aa3b8,
        roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide,
      });
      const wallMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), wallMat);
      wallMesh.receiveShadow = true;
      group.add(wallMesh);
      // Window frame + glass per viewport
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a3148, roughness: 0.35, metalness: 0.85 });
      const trimMat = new THREE.MeshStandardMaterial({ color: trimColorHex, emissive: trimColorHex, emissiveIntensity: 1.6, roughness: 0.5, metalness: 0.4 });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x88c8ff, transparent: true, opacity: 0.06,
        roughness: 0.05, metalness: 0.1, transmission: 0.85,
        clearcoat: 1, clearcoatRoughness: 0.05,
        side: THREE.DoubleSide,
      });
      winFrames.forEach(({ cx, cy }) => {
        const frameThick = 0.18;
        const frameDepth = 0.22;
        // Top
        const fT = new THREE.Mesh(new THREE.BoxGeometry(winW + frameThick * 2, frameThick, frameDepth), frameMat);
        fT.position.set(cx, cy + winH / 2 + frameThick / 2, 0);
        group.add(fT);
        // Bottom
        const fB = new THREE.Mesh(new THREE.BoxGeometry(winW + frameThick * 2, frameThick, frameDepth), frameMat);
        fB.position.set(cx, cy - winH / 2 - frameThick / 2, 0);
        group.add(fB);
        // Sides
        const fL = new THREE.Mesh(new THREE.BoxGeometry(frameThick, winH, frameDepth), frameMat);
        fL.position.set(cx - winW / 2 - frameThick / 2, cy, 0);
        group.add(fL);
        const fR = new THREE.Mesh(new THREE.BoxGeometry(frameThick, winH, frameDepth), frameMat);
        fR.position.set(cx + winW / 2 + frameThick / 2, cy, 0);
        group.add(fR);
        // Inner emissive trim around the window
        const tT = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.04, 0.04, 0.04), trimMat);
        tT.position.set(cx, cy + winH / 2, 0.12);
        group.add(tT);
        const tB = new THREE.Mesh(new THREE.BoxGeometry(winW + 0.04, 0.04, 0.04), trimMat);
        tB.position.set(cx, cy - winH / 2, 0.12);
        group.add(tB);
        const tL = new THREE.Mesh(new THREE.BoxGeometry(0.04, winH, 0.04), trimMat);
        tL.position.set(cx - winW / 2, cy, 0.12);
        group.add(tL);
        const tR = new THREE.Mesh(new THREE.BoxGeometry(0.04, winH, 0.04), trimMat);
        tR.position.set(cx + winW / 2, cy, 0.12);
        group.add(tR);
        // Glass pane
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glassMat);
        glass.position.set(cx, cy, 0);
        group.add(glass);
      });
      // Horizontal emissive trim strips: floor edge + ceiling edge
      const stripMat = new THREE.MeshStandardMaterial({ color: trimColorHex, emissive: trimColorHex, emissiveIntensity: 2.0, roughness: 0.5 });
      const stripT = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.05, 0.08), stripMat);
      stripT.position.set(0, h / 2 - 0.15, 0.06);
      group.add(stripT);
      const stripB = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.05, 0.08), stripMat);
      stripB.position.set(0, -h / 2 + 0.15, 0.06);
      group.add(stripB);
      return group;
    }
    const trimHex = parseInt(initAmbient.replace('#', ''), 16) || 0x22c55e;
    // Holds the loaded ship hull group once OBJ load resolves (async). Read by collision logic.
    let spaceshipHullGroup = null;
    // Per-mesh AABBs of just the wall faces (skipping the deck floor — player must stand on it).
    let spaceshipHullColliders = [];
    // Fighter-ship hull with 10 material slots — load MTL first so slot names survive,
    // then override each slot with a proper PBR config.
    const HULL_MATS = {
      hull_main:       { color: 0x8c95a8, roughness: 0.42, metalness: 0.85, texture: hullTexShared, texRepeat: [3, 2] },
      hull_panel:      { color: 0x6b758a, roughness: 0.32, metalness: 0.90, texture: hullTexShared, texRepeat: [3, 2] },
      hull_underbelly: { color: 0x2d3340, roughness: 0.55, metalness: 0.85, texture: hullTexShared, texRepeat: [3, 2] },
      hull_wing:       { color: 0x525e74, roughness: 0.28, metalness: 0.95, texture: hullTexShared, texRepeat: [3, 2] },
      hull_nose:       { color: 0xa6a8af, roughness: 0.38, metalness: 0.85, texture: hullTexShared, texRepeat: [2, 1] },
      engine_glow:     { color: 0x1a2026, roughness: 0.45, metalness: 0.6,  emissive: trimHex, emissiveIntensity: 3.0 },
      canopy_glass:    { color: 0x08101c, roughness: 0.08, metalness: 0.1,  emissive: 0x1a3055, emissiveIntensity: 0.35, transparent: true, opacity: 0.55 },
      deck_floor:      { color: 0x1a1f2a, roughness: 0.55, metalness: 0.75, texture: hullTexShared, texRepeat: [4, 4] },
      hull_trim:       { color: 0x0c1418, roughness: 0.40, metalness: 0.3,  emissive: trimHex, emissiveIntensity: 4.5 },
      console:         { color: 0x242938, roughness: 0.40, metalness: 0.7,  emissive: trimHex, emissiveIntensity: 0.6 },
      interior_floor:  { color: 0x111720, roughness: 0.62, metalness: 0.70, texture: hullTexShared, texRepeat: [6, 6], emissive: trimHex, emissiveIntensity: 0.08 },
    };
    function buildHullMaterial(name) {
      const cfg = HULL_MATS[name];
      if (!cfg) return new THREE.MeshStandardMaterial({ color: 0x8993ad, roughness: 0.5, metalness: 0.7 });
      const params = {
        color: cfg.color,
        roughness: cfg.roughness ?? 0.5,
        metalness: cfg.metalness ?? 0.5,
      };
      if (cfg.emissive !== undefined) { params.emissive = cfg.emissive; params.emissiveIntensity = cfg.emissiveIntensity ?? 1; }
      if (cfg.transparent) { params.transparent = true; params.opacity = cfg.opacity ?? 0.5; }
      if (cfg.texture) {
        const t = cfg.texture.clone();
        t.repeat.set(cfg.texRepeat[0], cfg.texRepeat[1]);
        t.needsUpdate = true;
        params.map = t;
      }
      return new THREE.MeshStandardMaterial(params);
    }

    // Back-bulkhead viewport — fills the octagonal hole cut in the rear
    // interior partition of the ship hull (Blender Y=10.95 → Three z=-10.95).
    const BACK_WINDOW = { w: 15, h: 8, x: 0, y: 5.5, z: -10.95 };
    {
      const winGeom = new THREE.PlaneGeometry(BACK_WINDOW.w, BACK_WINDOW.h);
      const winMat = new THREE.MeshStandardMaterial({
        color: 0x08101c, roughness: 0.08, metalness: 0.1,
        emissive: 0x1a3055, emissiveIntensity: 0.35,
        transparent: true, opacity: 0.55, side: THREE.DoubleSide,
      });
      const backWindow = new THREE.Mesh(winGeom, winMat);
      backWindow.position.set(BACK_WINDOW.x, BACK_WINDOW.y, BACK_WINDOW.z);
      scene.add(backWindow);
    }

    {
      const mtlLoader = new MTLLoader();
      mtlLoader.setPath('/models/spaceship/');
      mtlLoader.load('Spaceship_interior.mtl', (mtlCreator) => {
        mtlCreator.preload();
        const hullLoader = new OBJLoader();
        hullLoader.setMaterials(mtlCreator);
        hullLoader.load('/models/spaceship/Spaceship_interior.obj', (group) => {
          if (!sceneRef.current || sceneRef.current.scene !== scene) return;
          group.traverse((c) => {
            if (c.isMesh) {
              const slotName = c.material?.name;
              c.material = buildHullMaterial(slotName);
              c.material.side = THREE.DoubleSide;
              c.castShadow = false;
              c.receiveShadow = true;
              c.userData.hullSlot = slotName;
            }
          });
          group.position.set(0, 0, 0);
          group.userData.spaceshipHull = true;
          spaceshipHullGroup = group;
          scene.add(group);
          // Per-triangle AABBs for EVERY face in the hull. Floor and ceiling faces fall
          // outside the player's vertical range (y=[0.15, 1.4]) so they auto-exclude geometrically —
          // slanted body shoulders no longer get falsely skipped by a normal-angle heuristic.
          spaceshipHullColliders = [];
          const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
          const PLAYER_FOOT = 0.15;
          const PLAYER_HEAD = 1.4;
          group.updateMatrixWorld(true);
          group.traverse((c) => {
            if (!c.isMesh || !c.geometry) return;
            const geom = c.geometry;
            const pos = geom.attributes.position;
            const index = geom.index;
            const triCount = index ? index.count / 3 : pos.count / 3;
            for (let t = 0; t < triCount; t++) {
              const i0 = index ? index.getX(t * 3)     : t * 3;
              const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
              const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
              vA.fromBufferAttribute(pos, i0).applyMatrix4(c.matrixWorld);
              vB.fromBufferAttribute(pos, i1).applyMatrix4(c.matrixWorld);
              vC.fromBufferAttribute(pos, i2).applyMatrix4(c.matrixWorld);
              const minY = Math.min(vA.y, vB.y, vC.y);
              const maxY = Math.max(vA.y, vB.y, vC.y);
              // Only keep triangles that overlap the player's body Y range
              if (maxY < PLAYER_FOOT || minY > PLAYER_HEAD) continue;
              const box = new THREE.Box3();
              box.expandByPoint(vA); box.expandByPoint(vB); box.expandByPoint(vC);
              // Clamp the AABB to the player's Y range so the player can step over low lips
              box.min.y = Math.max(box.min.y, PLAYER_FOOT);
              box.max.y = Math.min(box.max.y, PLAYER_HEAD);
              spaceshipHullColliders.push(box);
            }
          });
        }, undefined, (err) => {
          console.warn('Failed to load spaceship interior OBJ', err);
        });
      }, undefined, (err) => {
        console.warn('Failed to load spaceship interior MTL — falling back', err);
        // Fallback: single material
        const hullLoader = new OBJLoader();
        hullLoader.load('/models/spaceship/Spaceship_interior.obj', (group) => {
          if (!sceneRef.current || sceneRef.current.scene !== scene) return;
          group.traverse((c) => {
            if (c.isMesh) {
              c.material = buildHullMaterial('hull_main');
              c.material.side = THREE.DoubleSide;
              c.receiveShadow = true;
            }
          });
          group.position.set(0, 0, 0);
          group.userData.spaceshipHull = true;
          spaceshipHullGroup = group;
          scene.add(group);
          // Per-triangle AABBs for EVERY face in the hull. Floor and ceiling faces fall
          // outside the player's vertical range (y=[0.15, 1.4]) so they auto-exclude geometrically —
          // slanted body shoulders no longer get falsely skipped by a normal-angle heuristic.
          spaceshipHullColliders = [];
          const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
          const PLAYER_FOOT = 0.15;
          const PLAYER_HEAD = 1.4;
          group.updateMatrixWorld(true);
          group.traverse((c) => {
            if (!c.isMesh || !c.geometry) return;
            const geom = c.geometry;
            const pos = geom.attributes.position;
            const index = geom.index;
            const triCount = index ? index.count / 3 : pos.count / 3;
            for (let t = 0; t < triCount; t++) {
              const i0 = index ? index.getX(t * 3)     : t * 3;
              const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
              const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
              vA.fromBufferAttribute(pos, i0).applyMatrix4(c.matrixWorld);
              vB.fromBufferAttribute(pos, i1).applyMatrix4(c.matrixWorld);
              vC.fromBufferAttribute(pos, i2).applyMatrix4(c.matrixWorld);
              const minY = Math.min(vA.y, vB.y, vC.y);
              const maxY = Math.max(vA.y, vB.y, vC.y);
              // Only keep triangles that overlap the player's body Y range
              if (maxY < PLAYER_FOOT || minY > PLAYER_HEAD) continue;
              const box = new THREE.Box3();
              box.expandByPoint(vA); box.expandByPoint(vB); box.expandByPoint(vC);
              // Clamp the AABB to the player's Y range so the player can step over low lips
              box.min.y = Math.max(box.min.y, PLAYER_FOOT);
              box.max.y = Math.min(box.max.y, PLAYER_HEAD);
              spaceshipHullColliders.push(box);
            }
          });
        });
      });
    }

    // ── Outer space backdrop ─────────────────────────────────────────────────
    scene.background = new THREE.Color(0x02030a);
    {
      // Starfield: random points on a large sphere
      const starGeo = new THREE.BufferGeometry();
      const N = 1800;
      const positions = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const u = Math.random(), v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const r = 700 + Math.random() * 300;
        positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi);
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false });
      const stars = new THREE.Points(starGeo, starMat);
      stars.frustumCulled = false;
      scene.add(stars);

      // ── Earth-like planet directly below the room (we orbit above it) ──
      function makeEarthTexture() {
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 512;
        const cx = c.getContext('2d');
        const grad = cx.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0.0, '#0c2660');
        grad.addColorStop(0.5, '#1d4ed8');
        grad.addColorStop(1.0, '#0c2660');
        cx.fillStyle = grad; cx.fillRect(0, 0, 1024, 512);
        // Continents — lush greens, no browns
        const landColors = ['#16a34a', '#15803d', '#166534', '#22c55e', '#4ade80', '#365314'];
        for (let i = 0; i < 90; i++) {
          cx.fillStyle = landColors[(Math.random() * landColors.length) | 0];
          const x = Math.random() * 1024;
          const y = 60 + Math.random() * 390;
          const segs = 6 + ((Math.random() * 6) | 0);
          cx.beginPath();
          for (let s = 0; s < segs; s++) {
            const a = (s / segs) * Math.PI * 2;
            const r = 20 + Math.random() * 90;
            const px = x + Math.cos(a) * r;
            const py = y + Math.sin(a) * r * 0.7;
            if (s === 0) cx.moveTo(px, py); else cx.lineTo(px, py);
          }
          cx.closePath(); cx.fill();
        }
        // Ice caps
        const caps = cx.createLinearGradient(0, 0, 0, 60);
        caps.addColorStop(0, '#f1f5f9'); caps.addColorStop(1, 'rgba(241,245,249,0)');
        cx.fillStyle = caps; cx.fillRect(0, 0, 1024, 60);
        const caps2 = cx.createLinearGradient(0, 452, 0, 512);
        caps2.addColorStop(0, 'rgba(241,245,249,0)'); caps2.addColorStop(1, '#f1f5f9');
        cx.fillStyle = caps2; cx.fillRect(0, 452, 1024, 60);
        return new THREE.CanvasTexture(c);
      }
      function makeCloudTexture() {
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 512;
        const cx = c.getContext('2d');
        cx.clearRect(0, 0, 1024, 512);
        cx.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < 35; i++) {
          const x = Math.random() * 1024;
          const y = 30 + Math.random() * 450;
          const rx = 30 + Math.random() * 90;
          const ry = 10 + Math.random() * 25;
          cx.beginPath();
          cx.ellipse(x, y, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
          cx.fill();
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        return tex;
      }

      const PLANET_R = 420;
      const PLANET_Y = -560;
      const planetMat = new THREE.MeshStandardMaterial({
        map: makeEarthTexture(),
        roughness: 0.7, metalness: 0.05,
        emissive: 0x0a1638, emissiveIntensity: 0.2,
      });
      const planet = new THREE.Mesh(new THREE.SphereGeometry(PLANET_R, 96, 64), planetMat);
      planet.position.set(0, PLANET_Y, 0);
      scene.add(planet);

      // Cloud layer (procedural fallback; replaced by real texture if available)
      const cloudsMat = new THREE.MeshStandardMaterial({
        map: makeCloudTexture(), transparent: true, opacity: 0.3,
        depthWrite: false, roughness: 1, metalness: 0,
      });
      const clouds = new THREE.Mesh(new THREE.SphereGeometry(PLANET_R + 1.5, 64, 48), cloudsMat);
      clouds.position.copy(planet.position);
      scene.add(clouds);

      // Try to upgrade to real NASA-style textures if present in /public/textures/earth/
      {
        const texLoader = new THREE.TextureLoader();
        const trySet = (path, onOk) => texLoader.load(path, onOk, undefined, () => {});
        trySet('/textures/earth/2k_earth_daymap.jpg', (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          planetMat.map = t;
          planetMat.emissiveIntensity = 0.05;
          planetMat.needsUpdate = true;
        });
        trySet('/textures/earth/2k_earth_normal_map.jpg', (t) => {
          planetMat.normalMap = t;
          planetMat.normalScale.set(0.8, 0.8);
          planetMat.needsUpdate = true;
        });
        trySet('/textures/earth/2k_earth_specular_map.jpg', (t) => {
          planetMat.roughnessMap = t;
          planetMat.roughness = 1.0;
          planetMat.metalness = 0.15;
          planetMat.needsUpdate = true;
        });
        trySet('/textures/earth/2k_earth_clouds.jpg', (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          cloudsMat.map = t;
          cloudsMat.alphaMap = t;
          cloudsMat.opacity = 0.85;
          cloudsMat.needsUpdate = true;
        });
      }

      // Atmospheric halo (rim glow)
      const haloMat = new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.18, side: THREE.BackSide, depthWrite: false });
      const halo = new THREE.Mesh(new THREE.SphereGeometry(PLANET_R + 8, 64, 48), haloMat);
      halo.position.copy(planet.position);
      scene.add(halo);

      // Sunlight illuminating the planet from above-side
      const sun = new THREE.DirectionalLight(0xfff7e0, 1.2);
      sun.position.set(120, 80, 60);
      scene.add(sun);

      scene.userData.spaceRefs = { planet, clouds, stars };
    }

    // Spaceship floor — dark hex/grid metal plate with emissive seams
    function makeDeckTexture() {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 512;
      const cx = c.getContext('2d');
      cx.fillStyle = '#10141d'; cx.fillRect(0, 0, 512, 512);
      // Diagonal scratches
      cx.globalAlpha = 0.06; cx.strokeStyle = '#3a4258'; cx.lineWidth = 0.5;
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * 512;
        cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x + 50, 512); cx.stroke();
      }
      cx.globalAlpha = 1;
      // Plate divisions
      cx.strokeStyle = '#252b3a'; cx.lineWidth = 2;
      for (let i = 0; i <= 512; i += 128) {
        cx.beginPath(); cx.moveTo(0, i); cx.lineTo(512, i); cx.stroke();
        cx.beginPath(); cx.moveTo(i, 0); cx.lineTo(i, 512); cx.stroke();
      }
      // Bolts at plate corners
      cx.fillStyle = '#0a0d14';
      for (let x = 0; x <= 512; x += 128) {
        for (let y = 0; y <= 512; y += 128) {
          cx.beginPath(); cx.arc(x, y, 4, 0, Math.PI * 2); cx.fill();
          cx.fillStyle = '#3a4258';
          cx.beginPath(); cx.arc(x, y, 1.5, 0, Math.PI * 2); cx.fill();
          cx.fillStyle = '#0a0d14';
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.repeat.set(ROOM.w / 4, ROOM.d / 4);
      return tex;
    }
    const deckTex = makeDeckTexture();
    deckTex.repeat.set(0.25, 0.25);
    const floorMat = new THREE.MeshStandardMaterial({
      map: deckTex, color: 0xb8c0d4,
      roughness: 0.55, metalness: 0.75,
      transparent: true, opacity: 0.92, depthWrite: true,
    });
    // No explicit floor — the ship hull's interior bottom serves as the floor.

    // Hidden grid helper (H toggle)
    const gridHelper = new THREE.GridHelper(ROOM.w, Math.floor(ROOM.w), 0x2a3148, 0x1a2030);
    gridHelper.visible = false;
    scene.add(gridHelper);

    // (Floor perimeter trim is now baked into the ship OBJ — see hull_trim material slot.)

    // Recessed overhead LED strips — long emissive bars running along the ship's length
    const ledStripMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: trimHex, emissiveIntensity: 2.6, roughness: 0.85 });
    [-1, 1].forEach((sx) => {
      const x = sx * ROOM.w * 0.22;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, ROOM.d * 0.7), ledStripMat);
      strip.position.set(x, ROOM.h - 0.6, 0);
      scene.add(strip);
      // Two soft fill point lights along each strip
      [-1, 1].forEach((sz) => {
        const pl = new THREE.PointLight(trimHex, 1.4, 18);
        pl.position.set(x, ROOM.h - 1.0, sz * ROOM.d * 0.22);
        scene.add(pl);
      });
    });

    // Cockpit-end accent — bright forward spotlight highlighting the cockpit area
    const cockpitLight = new THREE.SpotLight(0xeaf3ff, 8, ROOM.d * 0.7, Math.PI / 4.5, 0.5, 1);
    cockpitLight.position.set(0, ROOM.h - 1.5, ROOM.d * 0.05);
    cockpitLight.target.position.set(0, 1, -ROOM.d * 0.45);
    scene.add(cockpitLight);
    scene.add(cockpitLight.target);

    // Animated status lights — small pulsing red/green dots scattered along the hull at floor level
    const statusDots = [];
    const dotPositions = [
      [-ROOM.w * 0.32, 0.5, -ROOM.d * 0.35, 0xff3344],
      [ROOM.w * 0.32, 0.5, -ROOM.d * 0.35, 0x33ff77],
      [-ROOM.w * 0.32, 0.5, ROOM.d * 0.35, 0x33ff77],
      [ROOM.w * 0.32, 0.5, ROOM.d * 0.35, 0xff3344],
      [-ROOM.w * 0.32, 0.5, 0, 0x4cc9ff],
      [ROOM.w * 0.32, 0.5, 0, 0x4cc9ff],
    ];
    dotPositions.forEach(([x, y, z, c]) => {
      const dotMat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.5, roughness: 1 });
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), dotMat);
      dot.position.set(x, y, z);
      dot.userData.basePhase = Math.random() * Math.PI * 2;
      dot.userData.baseColor = c;
      scene.add(dot);
      statusDots.push(dot);
    });
    scene.userData.statusDots = statusDots;

    // ── Static furniture (draggable, positions saved to localStorage) ──────────
    const STATIC_KEY = `cg-room-static-${coinId}`;
    const savedStatic = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');

    function tagStatic(group, id) {
      group.userData.furnitureId = id;
      group.traverse((c) => { c.userData.furnitureId = id; });
    }
    function placeStatic(group, defaultX, defaultZ) {
      const saved = savedStatic[group.userData.furnitureId];
      group.position.set(saved ? saved.x : defaultX, saved?.y != null ? saved.y : 0, saved ? saved.z : defaultZ);
      if (saved?.ry != null) group.rotation.y = saved.ry;
    }

    // Alien emote/anim helpers
    const EMOTE_DEFS = {
      jump:    { hints: ['jump'],         exclude: ['running'] },
      clap:    { hints: ['clap'] },
      sit:     { hints: ['sit'] },
      punch:   { hints: ['punch'] },
      slash:   { hints: ['swordslash', 'slash'] },
      bigjump: { hints: ['runningjump'] },
      death:   { hints: ['death'] },
    };
    function buildAlienActionMap(acts) {
      const pick = (hints, exclude = []) => acts.find((a) => {
        const n = a.getClip().name.toLowerCase();
        if (exclude.some((x) => n.includes(x))) return false;
        return hints.some((h) => n.includes(h));
      });
      const map = {};
      map.idle = pick(['idle', 'stand', 'breath']) || acts[0];
      map.walk = pick(['walk']) || pick(['run']) || acts[0];
      Object.entries(EMOTE_DEFS).forEach(([key, def]) => {
        const a = pick(def.hints, def.exclude);
        if (a) map[key] = a;
      });
      return map;
    }
    const SUSTAINED_EMOTES = new Set(['sit', 'death']);
    function configureEmoteAction(action) {
      action.reset();
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    }
    function triggerEmote(target, name) {
      if (!target?.byName) return false;
      const action = target.byName[name];
      if (!action) return false;
      const sustained = SUSTAINED_EMOTES.has(name);
      configureEmoteAction(action);
      target.emoteAction = action;
      target.emoteUntil = sustained ? Infinity : performance.now() + (action.getClip().duration * 1000);
      target.emoteSustained = sustained;
      return true;
    }

    // ── Player avatar (animated Alien.fbx) with WASD controls ────────────────
    const player = new THREE.Group();
    player.position.set(0, 0, 4);
    scene.add(player);
    let playerMixer = null;
    let playerActions = [];
    let alienTemplate = null;
    let alienAnimations = [];
    {
      const fbx = new FBXLoader();
      fbx.load('/models/player/fbx/Alien.fbx', (g) => {
        const box = new THREE.Box3().setFromObject(g);
        const size = new THREE.Vector3(); box.getSize(size);
        const center = new THREE.Vector3(); box.getCenter(center);
        const targetH = 2.8;
        const s = targetH / Math.max(0.001, size.y);
        g.scale.setScalar(s);
        g.position.x = -center.x * s;
        g.position.z = -center.z * s;
        g.position.y = -box.min.y * s;
        g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
        alienTemplate = g;
        alienAnimations = g.animations || [];
        player.add(g);
        // Upgrade any already-spawned remote players from capsule to alien
        remotePlayers.forEach((rp) => { if (!rp.isAlien) upgradeRemoteToAlien(rp); });
        if (g.animations && g.animations.length > 0) {
          console.log('[Alien] animation clips:', g.animations.map((a) => a.name));
          playerMixer = new THREE.AnimationMixer(g);
          playerActions = g.animations.map((clip) => playerMixer.clipAction(clip));
          const byName = buildAlienActionMap(playerActions);
          playerActions.forEach((a) => { a.enabled = true; a.setEffectiveWeight(a === byName.idle ? 1 : 0); a.play(); });
          playerMixer.userData = { byName, allActions: playerActions };
        }
      });
    }

    // ── Realtime: broadcast our pose & render other visitors ────────────────
    const remotePlayers = new Map(); // userId → { group, target, label }
    const localBubbleSlot = { bubbleSprite: null, bubbleUntil: 0 };
    let supaChannel = null;
    let myId = null;
    let myName = 'Visitor';

    function makeNameSprite(name) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const cx = c.getContext('2d');
      cx.fillStyle = 'rgba(6,8,6,0.85)';
      cx.fillRect(0, 0, 256, 64);
      cx.fillStyle = '#bbf7d0';
      cx.font = '700 28px monospace';
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText((name || 'Visitor').slice(0, 16), 128, 32);
      const tex = new THREE.CanvasTexture(c);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      sprite.scale.set(2.4, 0.6, 1);
      sprite.position.y = 3.3;
      return sprite;
    }

    function makeChatBubble(text) {
      const lines = wrapBubbleText(text, 20);
      const w = 360; const lh = 36; const padX = 22; const padY = 14;
      const h = padY * 2 + lines.length * lh;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const cx = c.getContext('2d');
      cx.fillStyle = 'rgba(252,252,252,0.96)';
      roundRect(cx, 0, 0, w, h - 10, 14); cx.fill();
      // tail
      cx.beginPath(); cx.moveTo(w/2 - 12, h - 10); cx.lineTo(w/2, h); cx.lineTo(w/2 + 12, h - 10); cx.closePath();
      cx.fill();
      cx.fillStyle = '#111';
      cx.font = '700 28px DM Mono, monospace';
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      lines.forEach((ln, i) => cx.fillText(ln, w / 2, padY + lh / 2 + i * lh));
      const tex = new THREE.CanvasTexture(c);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
      const scaleW = 3.0; const scaleH = scaleW * (h / w);
      sprite.scale.set(scaleW, scaleH, 1);
      sprite.position.y = 4.0 + scaleH / 2;
      return sprite;
    }

    function wrapBubbleText(s, max) {
      const words = String(s).split(/\s+/); const out = []; let cur = '';
      for (const w of words) {
        if ((cur + ' ' + w).trim().length > max) { if (cur) out.push(cur); cur = w; }
        else cur = cur ? cur + ' ' + w : w;
      }
      if (cur) out.push(cur);
      return out.slice(0, 4);
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y,     x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x,     y + h, r);
      ctx.arcTo(x,     y + h, x,     y,     r);
      ctx.arcTo(x,     y,     x + w, y,     r);
      ctx.closePath();
    }

    function makeAlienClone(seed) {
      if (!alienTemplate) return null;
      const clone = cloneSkinned(alienTemplate);
      const hue = ((seed >>> 0) % 360) / 360;
      clone.traverse((c) => {
        if (c.isMesh && c.material) {
          const dup = (m) => { const nm = m.clone(); if (nm.color) nm.color.offsetHSL(hue - 0.33, 0.1, 0); return nm; };
          c.material = Array.isArray(c.material) ? c.material.map(dup) : dup(c.material);
          c.castShadow = true;
        }
      });
      const mixer = new THREE.AnimationMixer(clone);
      const acts = alienAnimations.map((clip) => mixer.clipAction(clip));
      const byName = buildAlienActionMap(acts);
      acts.forEach((a) => { a.enabled = true; a.setEffectiveWeight(a === byName.idle ? 1 : 0); a.play(); });
      return { body: clone, mixer, byName, allActions: acts };
    }

    function upgradeRemoteToAlien(rp) {
      if (!alienTemplate || rp.isAlien) return;
      const seed = [...String(rp.id || '')].reduce((a, c) => a + c.charCodeAt(0), 0) * 47;
      const alien = makeAlienClone(seed);
      if (!alien) return;
      // remove placeholder body but keep label/bubble
      const toRemove = rp.bodyMesh ? [rp.bodyMesh, rp.nubMesh].filter(Boolean) : [];
      toRemove.forEach((m) => rp.group.remove(m));
      rp.group.add(alien.body);
      rp.mixer = alien.mixer;
      rp.byName = alien.byName;
      rp.allActions = alien.allActions;
      rp.isAlien = true;
    }

    function makeRemotePlayer(id, name, colorSeed) {
      const g = new THREE.Group();
      const rp = { id, name, group: g, target: { x: 0, z: 4, yaw: 0 }, isAlien: false, bubbleSprite: null, bubbleUntil: 0, movingUntil: 0, emoteAction: null, emoteUntil: 0 };
      if (alienTemplate) {
        const alien = makeAlienClone(colorSeed);
        if (alien) {
          g.add(alien.body);
          rp.mixer = alien.mixer;
          rp.byName = alien.byName;
          rp.allActions = alien.allActions;
          rp.isAlien = true;
        }
      }
      if (!rp.isAlien) {
        const hue = ((colorSeed >>> 0) % 360) / 360;
        const bodyColor = new THREE.Color().setHSL(hue, 0.6, 0.55);
        const emissive = new THREE.Color().setHSL(hue, 0.7, 0.35);
        const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, emissive, emissiveIntensity: 0.4, roughness: 0.45, metalness: 0.3 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.4, 6, 12), bodyMat);
        body.position.y = 1.2; body.castShadow = true; g.add(body);
        const nub = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0x0c1a0c }));
        nub.position.set(0, 1.6, 0.4); g.add(nub);
        rp.bodyMesh = body; rp.nubMesh = nub;
      }
      g.add(makeNameSprite(name));
      return rp;
    }

    function showChatBubble(group, slot, text) {
      // slot must be an object with bubbleSprite/bubbleUntil keys (rp or localBubbleSlot)
      if (slot.bubbleSprite) {
        group.remove(slot.bubbleSprite);
        slot.bubbleSprite.material.map?.dispose();
        slot.bubbleSprite.material.dispose();
        slot.bubbleSprite = null;
      }
      const sprite = makeChatBubble(text);
      group.add(sprite);
      slot.bubbleSprite = sprite;
      slot.bubbleUntil = performance.now() + 5000;
    }

    (async () => {
      const sb = getSupabaseBrowserClient();
      if (!sb) return;
      const { data: auth } = await sb.auth.getUser();
      myId = auth?.user?.id;
      if (!myId) return;
      myName = (auth.user.user_metadata?.username) || (auth.user.email?.split('@')[0]) || 'Visitor';

      supaChannel = sb.channel(`cg-room-${coinId}`, {
        config: { broadcast: { self: false }, presence: { key: myId } },
      });

      supaChannel.on('broadcast', { event: 'pose' }, ({ payload }) => {
        if (!payload || payload.id === myId) return;
        let rp = remotePlayers.get(payload.id);
        if (!rp) {
          const seed = [...String(payload.id)].reduce((a, c) => a + c.charCodeAt(0), 0);
          rp = makeRemotePlayer(payload.id, payload.name || 'Visitor', seed * 47);
          rp.group.position.set(payload.x, 0, payload.z);
          rp.group.rotation.y = payload.yaw;
          scene.add(rp.group);
          remotePlayers.set(payload.id, rp);
        }
        const moved = Math.hypot(payload.x - rp.target.x, payload.z - rp.target.z) > 0.04;
        rp.target.x = payload.x;
        rp.target.z = payload.z;
        rp.target.yaw = payload.yaw;
        if (moved) {
          rp.movingUntil = performance.now() + 350;
          if (rp.emoteSustained) { rp.emoteAction = null; rp.emoteUntil = 0; rp.emoteSustained = false; }
        }
      });

      supaChannel.on('broadcast', { event: 'emote' }, ({ payload }) => {
        if (!payload || payload.id === myId) return;
        const rp = remotePlayers.get(payload.id);
        if (!rp || !rp.byName) return;
        if (!payload.name) {
          rp.emoteAction = null; rp.emoteUntil = 0; rp.emoteSustained = false;
          return;
        }
        const action = rp.byName[payload.name];
        if (!action) return;
        configureEmoteAction(action);
        rp.emoteAction = action;
        rp.emoteSustained = !!payload.sustain;
        rp.emoteUntil = payload.sustain ? Infinity : performance.now() + (action.getClip().duration * 1000);
      });

      supaChannel.on('broadcast', { event: 'chat' }, ({ payload }) => {
        if (!payload?.message) return;
        if (payload.id === myId) return; // own bubble is rendered locally
        const rp = remotePlayers.get(payload.id);
        if (rp) showChatBubble(rp.group, rp, payload.message);
      });

      supaChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        (leftPresences || []).forEach((p) => {
          const id = p.id || p.key;
          const rp = remotePlayers.get(id);
          if (rp) { scene.remove(rp.group); remotePlayers.delete(id); }
        });
      });

      const sendInitialPose = () => {
        if (!supaChannel || !myId) return;
        supaChannel.send({
          type: 'broadcast',
          event: 'pose',
          payload: { id: myId, name: myName, x: player.position.x, z: player.position.z, yaw: player.rotation.y },
        });
      };

      // When someone new joins, re-broadcast so they see us idle + play the join beep
      supaChannel.on('presence', { event: 'join' }, () => { sendInitialPose(); playJoinBeep(); });

      // Owner published a layout change — pull latest from DB and apply
      supaChannel.on('broadcast', { event: 'layout' }, () => {
        sceneRef.current?.reloadLayout?.();
      });

      supaChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await supaChannel.track({ id: myId, name: myName });
          // Wait a tick so other clients are also subscribed and listening
          setTimeout(sendInitialPose, 200);
        }
      });
      if (sceneRef.current) {
        sceneRef.current.supaChannel = supaChannel;
        sceneRef.current.playEmote = playLocalEmote;
        sceneRef.current.sendChat = (message) => {
          const text = String(message || '').trim().slice(0, 120);
          if (!text) return;
          // Local bubble for self
          showChatBubble(player, localBubbleSlot, text);
          supaChannel.send({ type: 'broadcast', event: 'chat', payload: { id: myId, name: myName, message: text } });
        };
      }
    })();

    const localTarget = { emoteAction: null, emoteUntil: 0, emoteSustained: false };
    let lastBroadcast = 0;
    let lastSentX = 0, lastSentZ = 0, lastSentYaw = 0;
    function broadcastPose() {
      if (!supaChannel || !myId) return;
      const now = performance.now();
      if (now - lastBroadcast < 100) return; // 10 Hz cap
      const dx = player.position.x - lastSentX;
      const dz = player.position.z - lastSentZ;
      const dy = player.rotation.y - lastSentYaw;
      if (Math.abs(dx) < 0.015 && Math.abs(dz) < 0.015 && Math.abs(dy) < 0.02) return;
      lastBroadcast = now;
      lastSentX = player.position.x;
      lastSentZ = player.position.z;
      lastSentYaw = player.rotation.y;
      supaChannel.send({
        type: 'broadcast',
        event: 'pose',
        payload: { id: myId, name: myName, x: player.position.x, z: player.position.z, yaw: player.rotation.y },
      });
    }

    function playLocalEmote(name) {
      if (!playerMixer?.userData) return;
      const ok = triggerEmote({ byName: playerMixer.userData.byName, emoteAction: null, emoteUntil: 0, emoteSustained: false }, name);
      if (!ok) return;
      const action = playerMixer.userData.byName[name];
      if (!action) return;
      const sustained = SUSTAINED_EMOTES.has(name);
      configureEmoteAction(action);
      localTarget.emoteAction = action;
      localTarget.emoteUntil = sustained ? Infinity : performance.now() + (action.getClip().duration * 1000);
      localTarget.emoteSustained = sustained;
      if (supaChannel && myId) {
        supaChannel.send({ type: 'broadcast', event: 'emote', payload: { id: myId, name, sustain: sustained } });
      }
    }
    function clearLocalEmote() {
      localTarget.emoteAction = null;
      localTarget.emoteUntil = 0;
      localTarget.emoteSustained = false;
      if (supaChannel && myId) {
        supaChannel.send({ type: 'broadcast', event: 'emote', payload: { id: myId, name: null } });
      }
    }

    // (Home/shop items are populated by the React sync effects after mount.)

    // ── FC Cube (clicker, grants 1 FC per click, floats + draggable) ─────────
    const bucket = buildFCCube();
    const savedCube = savedStatic['fc_cube'];
    bucket.position.set(savedCube ? savedCube.x : -4, 1.5, savedCube ? savedCube.z : 4);
    bucket.scale.setScalar(1.6);
    scene.add(bucket);
    let bucketBounceEnd = 0;

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

    // ── Drawable wall group (Sims build mode) ────────────────────────────────
    const wallGroup = new THREE.Group();
    scene.add(wallGroup);
    // Preview wall during drag
    const previewWall = new THREE.Mesh(
      new THREE.BoxGeometry(1, ROOM.h, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.4, transparent: true, opacity: 0.55 }),
    );
    previewWall.visible = false;
    scene.add(previewWall);

    // ── Furniture map: id → { group, isStaged } ──────────────────────────────
    const furnitureMap = {};
    // Invisible collider so the player can't walk through the back-bulkhead
    // window. Lives in staticMap so it persists across wallGroup rebuilds.
    const backWindowCollider = new THREE.Mesh(
      new THREE.BoxGeometry(BACK_WINDOW.w, BACK_WINDOW.h, 0.3),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    backWindowCollider.position.set(BACK_WINDOW.x, BACK_WINDOW.y, BACK_WINDOW.z);
    scene.add(backWindowCollider);
    const staticMap = { fc_cube: bucket, back_window: backWindowCollider };
    sceneRef.current = {
      scene, furnitureMap, staticMap, isOwner, nameCanvas, nameCtx, nameTex, STATIC_KEY,
      lights: { hemi, ceil: ceilLight, fills: fillLights }, floorMat, bucket,
      wallGroup, previewWall,
      buildMode: false,
      hypePumping: false,
      evolveCube: (stage) => { bucket.userData.setStage?.(stage); },
    };

    // ── Orbit controls ────────────────────────────────────────────────────────
    let isDrag = false; let px = 0; let py = 0;
    let theta = Math.PI; let phi = 0.40;
    let tTheta = Math.PI; let tPhi = 0.40;
    let tRad = 8; let autoRot = false;

    // ── Drag-to-place state ────────────────────────────────────────────────────
    let dragging = null; // { id, group, origX, origZ }
    let selected = null; // { id, group, isStatic } — last clicked item, target for arrow-key Y nudges
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

    let wallDraw = null; // { x1, z1 } while drawing a wall

    function onMDown(e) {
      const rect = wrap.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / W) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / H) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // ── Build mode: draw/delete walls ───────────────────────────────────────
      if (sceneRef.current?.buildMode && sceneRef.current?.isOwner) {
        // First: does the click hit an existing wall? If so, delete it.
        const wallHits = raycaster.intersectObjects(wallGroup.children, false);
        if (wallHits.length > 0) {
          const wallId = wallHits[0].object.userData.wallId;
          if (wallId) sceneRef.current.deleteWall?.(wallId);
          return;
        }
        // Otherwise start drawing from this grid corner
        raycaster.ray.intersectPlane(floorPlane, intersectPt);
        const sx = Math.round(intersectPt.x);
        const sz = Math.round(intersectPt.z);
        wallDraw = { x1: sx, z1: sz, x2: sx, z2: sz };
        previewWall.visible = false;
        autoRot = false;
        return;
      }

      // Cube click (anyone can click, owner can also drag)
      if (raycaster.intersectObject(bucket, true).length > 0) {
        autoRot = false;
        if (sceneRef.current?.isOwner) {
          dragging = { id: 'fc_cube', group: bucket, isStatic: true, isCube: true, moved: false, startX: bucket.position.x, startZ: bucket.position.z };
        } else {
          dragging = { id: 'fc_cube', group: bucket, isStatic: false, isCube: true, moved: false, startX: bucket.position.x, startZ: bucket.position.z };
        }
        return;
      }

      if (sceneRef.current?.isOwner) {
        const hits = raycaster.intersectObjects(getPickables(), true);
        if (hits.length > 0) {
          let obj = hits[0].object;
          while (obj.parent && !obj.userData.furnitureId) obj = obj.parent;
          const id = obj.userData.furnitureId;
          const group = id ? findGroup(id) : null;
          if (group) {
            dragging = { id, group, isStatic: id.startsWith('static_') || id === 'fc_cube', moved: false, startX: group.position.x, startZ: group.position.z, startY: group.position.y };
            autoRot = false;
            return;
          }
        }
      }

      // Clicked empty space — deselect
      selected = null;
      isDrag = true; autoRot = false; px = e.clientX; py = e.clientY;
    }

    function updatePreviewWall(x1, z1, x2, z2) {
      const dx = x2 - x1; const dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.2) { previewWall.visible = false; return; }
      previewWall.visible = true;
      previewWall.scale.set(len, 1, 1);
      previewWall.position.set((x1 + x2) / 2, ROOM.h / 2, (z1 + z2) / 2);
      previewWall.rotation.y = -Math.atan2(dz, dx);
    }

    function onMMove(e) {
      if (wallDraw) {
        const rect = wrap.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / W) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / H) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(floorPlane, intersectPt);
        wallDraw.x2 = Math.round(intersectPt.x);
        wallDraw.z2 = Math.round(intersectPt.z);
        updatePreviewWall(wallDraw.x1, wallDraw.z1, wallDraw.x2, wallDraw.z2);
        return;
      }
      if (dragging) {
        const rect = wrap.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / W) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / H) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(floorPlane, intersectPt);
        const hw = ROOM.w * 0.4;
        const hd = ROOM.d * 0.45;
        let nx = Math.max(-hw, Math.min(hw, intersectPt.x));
        let nz = Math.max(-hd, Math.min(hd, intersectPt.z));
        // Snap to floor grid (1.0 units = cell size). Hold Shift for free placement.
        if (!e.shiftKey) {
          nx = Math.round(nx);
          nz = Math.round(nz);
        }
        if (dragging.isCube) {
          dragging.group.position.x = nx;
          dragging.group.position.z = nz;
          const dx = nx - dragging.startX;
          const dz = nz - dragging.startZ;
          if (Math.sqrt(dx * dx + dz * dz) > 0.4) dragging.moved = true;
        } else {
          dragging.group.position.set(nx, dragging.startY + 0.08, nz);
          const dx = nx - dragging.startX;
          const dz = nz - dragging.startZ;
          if (Math.sqrt(dx * dx + dz * dz) > 0.3) dragging.moved = true;
        }
        return;
      }
      if (!isDrag) return;
      tTheta -= (e.clientX - px) * 0.007;
      tPhi = Math.max(0.1, Math.min(1.25, tPhi + (e.clientY - py) * 0.005));
      px = e.clientX; py = e.clientY;
    }

    function onMUp() {
      if (wallDraw) {
        const { x1, z1, x2, z2 } = wallDraw;
        const dx = x2 - x1; const dz = z2 - z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        previewWall.visible = false;
        if (len >= 0.5 && sceneRef.current?.addWall) {
          sceneRef.current.addWall({ id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, x1, z1, x2, z2 });
        }
        wallDraw = null;
        return;
      }
      if (dragging) {
        const { id, group, isStatic, isCube } = dragging;
        const x = parseFloat(group.position.x.toFixed(3));
        const z = parseFloat(group.position.z.toFixed(3));

        if (isCube) {
          if (!dragging.moved) {
            // treat as click — fire FC reward
            bucketBounceEnd = clock.getElapsedTime() + 0.25;
            bucketCallbackRef.current?.();
          } else if (sceneRef.current?.isOwner) {
            // save cube position
            const cur = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');
            cur['fc_cube'] = { x, z };
            localStorage.setItem(STATIC_KEY, JSON.stringify(cur)); sceneRef.current?.markLayoutDirty?.();
          }
          dragging = null;
          return;
        }

        if (!dragging.moved) {
          // Treat as select — keep position, target for arrow-key Y nudges
          selected = { id, group, isStatic };
          group.position.set(dragging.startX, dragging.startY, dragging.startZ);
          // Doors: click to toggle open/closed (90° swing around the group's center)
          if (typeof id === 'string' && id.startsWith('static_home_Door_')) {
            if (group.userData.baseRotY == null) group.userData.baseRotY = group.rotation.y;
            group.userData.doorOpen = !group.userData.doorOpen;
            const target = group.userData.baseRotY + (group.userData.doorOpen ? Math.PI / 2 : 0);
            group.userData.doorTween = { from: group.rotation.y, to: target, startT: clock.getElapsedTime(), dur: 0.35 };
          }
          dragging = null;
          return;
        }
        group.position.y = dragging.startY;
        if (isStatic) {
          const cur = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');
          cur[id] = { x, y: parseFloat(group.position.y.toFixed(3)), z, ry: parseFloat(group.rotation.y.toFixed(4)) };
          localStorage.setItem(STATIC_KEY, JSON.stringify(cur)); sceneRef.current?.markLayoutDirty?.();
        }
        selected = { id, group, isStatic };
        dragging = null;
        return;
      }
      isDrag = false;
    }

    const onWheel = (e) => { tRad = Math.max(3, Math.min(40, tRad + e.deltaY * 0.018)); e.preventDefault(); };

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

    const keyState = { w: false, a: false, s: false, d: false };
    const isTyping = (e) => {
      const t = e.target;
      if (!t) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable;
    };
    const onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (k in keyState) keyState[k] = false;
    };
    window.addEventListener('keyup', onKeyUp);
    const onKeyDown = (e) => {
      if (isTyping(e)) return;
      const lk = e.key.toLowerCase();
      if (lk in keyState) {
        keyState[lk] = true;
        if (localTarget.emoteSustained) clearLocalEmote();
      }
      if (lk === 'h') { gridHelper.visible = !gridHelper.visible; }
      if (e.code === 'Space' || lk === ' ') {
        playLocalEmote('jump');
        e.preventDefault();
      }
      if (lk === 't') {
        if (sceneRef.current?.toggleEmoteWheel) sceneRef.current.toggleEmoteWheel();
        e.preventDefault();
      }
      if ((e.key === 'r' || e.key === 'R') && dragging) {
        dragging.group.rotation.y += Math.PI / 4;
      }
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && selected && sceneRef.current?.isOwner) {
        const { id, group, isStatic } = selected;
        if (id === 'fc_cube') return; // cube has its own float animation
        const delta = e.key === 'ArrowUp' ? 0.25 : -0.25;
        const newY = Math.max(0, Math.min(ROOM.h - 1, group.position.y + delta));
        group.position.y = newY;
        e.preventDefault();
        if (isStatic) {
          const cur = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');
          const prev = cur[id] || {};
          cur[id] = { ...prev, x: parseFloat(group.position.x.toFixed(3)), y: parseFloat(newY.toFixed(3)), z: parseFloat(group.position.z.toFixed(3)), ry: parseFloat(group.rotation.y.toFixed(4)) };
          localStorage.setItem(STATIC_KEY, JSON.stringify(cur)); sceneRef.current?.markLayoutDirty?.();
        }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && sceneRef.current?.isOwner) {
        const { id } = selected;
        if (id === 'fc_cube') return;
        if (id.startsWith('static_home_')) {
          const rest = id.slice('static_home_'.length);
          const lu = rest.lastIndexOf('_');
          const name = lu > 0 ? rest.slice(0, lu) : rest;
          const idx = lu > 0 ? parseInt(rest.slice(lu + 1), 10) : 0;
          sceneRef.current?.removeHomeItem?.(name, Number.isNaN(idx) ? undefined : idx);
          selected = null;
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // ── Animate ────────────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let animId;

    function animate() {
      animId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const t = clock.elapsedTime;
      if (playerMixer) playerMixer.update(dt);

      // ── Player tank-style controls (W/S walk, A/D turn) ─────────────────
      const moveSpeed = 0.075;
      const turnSpeed = 2.8; // radians per second
      let forward = 0; let turn = 0;
      if (keyState.w) forward += 1;
      if (keyState.s) forward -= 1;
      if (keyState.a) turn += 1;
      if (keyState.d) turn -= 1;
      const moving = forward !== 0;
      if (turn !== 0) {
        player.rotation.y += turn * turnSpeed * dt;
        autoRot = false;
      }
      if (forward !== 0) {
        const yaw = player.rotation.y;
        const wx = Math.sin(yaw) * forward;
        const wz = Math.cos(yaw) * forward;
        // Conservative AABB inside the ship hull (~70% of bbox).
        const hwBound = ROOM.w * 0.4;
        const hdBound = ROOM.d * 0.45;
        const clampOct = (x, z) => [
          Math.max(-hwBound, Math.min(hwBound, x)),
          Math.max(-hdBound, Math.min(hdBound, z)),
        ];

        // Build collider list this frame
        const colliders = [];
        wallGroup.children.forEach((c) => { if (c.userData.wallId) colliders.push(new THREE.Box3().setFromObject(c)); });
        Object.entries(staticMap).forEach(([id, g]) => {
          if (id === 'fc_cube') return;
          if (g && g.isObject3D) colliders.push(new THREE.Box3().setFromObject(g));
        });
        Object.values(furnitureMap).forEach((f) => { if (f?.group?.isObject3D) colliders.push(new THREE.Box3().setFromObject(f.group)); });
        // Spaceship hull walls — cached once on load, not recomputed every frame
        for (const b of spaceshipHullColliders) colliders.push(b);

        const pr = 0.45;
        const testBox = new THREE.Box3();
        const blockedAt = (x, z) => {
          testBox.min.set(x - pr, 0.15, z - pr);
          testBox.max.set(x + pr, 1.4, z + pr);
          for (const b of colliders) if (b.intersectsBox(testBox)) return true;
          return false;
        };

        const cand = clampOct(player.position.x + wx * moveSpeed, player.position.z + wz * moveSpeed);
        let nx = cand[0], nz = cand[1];
        if (!blockedAt(nx, nz)) {
          player.position.x = nx;
          player.position.z = nz;
        } else if (!blockedAt(nx, player.position.z)) {
          player.position.x = nx;
        } else if (!blockedAt(player.position.x, nz)) {
          player.position.z = nz;
        }
        autoRot = false;
      }

      // Camera auto-follows behind player unless user is mouse-dragging
      if (autoRot) tTheta += 0.0018;
      if (!isDrag) {
        let target = player.rotation.y + Math.PI;
        while (target - tTheta > Math.PI) target -= Math.PI * 2;
        while (target - tTheta < -Math.PI) target += Math.PI * 2;
        tTheta += (target - tTheta) * Math.min(1, dt * 10);
      }
      theta += (tTheta - theta) * 0.08;
      phi += (tPhi - phi) * 0.06;
      // Broadcast our pose and interpolate remote players
      broadcastPose();
      const rLerp = Math.min(1, dt * 12);
      const nowMs = performance.now();
      const blendRate = Math.min(1, dt * 8);
      remotePlayers.forEach((rp) => {
        rp.group.position.x += (rp.target.x - rp.group.position.x) * rLerp;
        rp.group.position.z += (rp.target.z - rp.group.position.z) * rLerp;
        let dy2 = rp.target.yaw - rp.group.rotation.y;
        while (dy2 > Math.PI) dy2 -= Math.PI * 2;
        while (dy2 < -Math.PI) dy2 += Math.PI * 2;
        rp.group.rotation.y += dy2 * rLerp;
        if (rp.mixer) rp.mixer.update(dt);
        if (rp.byName && rp.allActions) {
          const isMoving = nowMs < (rp.movingUntil || 0);
          let target = rp.byName.idle;
          if (rp.emoteAction && nowMs < (rp.emoteUntil || 0)) target = rp.emoteAction;
          else if (isMoving && rp.byName.walk) target = rp.byName.walk;
          rp.allActions.forEach((a) => {
            const tgt = a === target ? 1 : 0;
            const cur = a.getEffectiveWeight();
            a.setEffectiveWeight(cur + (tgt - cur) * blendRate);
          });
        }
        if (rp.bubbleSprite && nowMs > rp.bubbleUntil) {
          rp.group.remove(rp.bubbleSprite);
          rp.bubbleSprite.material.map?.dispose();
          rp.bubbleSprite.material.dispose();
          rp.bubbleSprite = null;
        }
      });
      if (localBubbleSlot.bubbleSprite && nowMs > localBubbleSlot.bubbleUntil) {
        player.remove(localBubbleSlot.bubbleSprite);
        localBubbleSlot.bubbleSprite.material.map?.dispose();
        localBubbleSlot.bubbleSprite.material.dispose();
        localBubbleSlot.bubbleSprite = null;
      }

      // Tick door open/close tweens
      Object.values(staticMap).forEach((g) => {
        if (!g || !g.isObject3D || !g.userData?.doorTween) return;
        const tw = g.userData.doorTween;
        const p = Math.min(1, (clock.getElapsedTime() - tw.startT) / tw.dur);
        const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        g.rotation.y = tw.from + (tw.to - tw.from) * ease;
        if (p >= 1) delete g.userData.doorTween;
      });

      if (playerMixer?.userData) {
        const { byName, allActions } = playerMixer.userData;
        let target = byName.idle;
        if (localTarget.emoteAction && performance.now() < localTarget.emoteUntil) target = localTarget.emoteAction;
        else if (moving && byName.walk) target = byName.walk;
        const blend = Math.min(1, dt * 8);
        allActions.forEach((a) => {
          const tgt = a === target ? 1 : 0;
          const cur = a.getEffectiveWeight();
          a.setEffectiveWeight(cur + (tgt - cur) * blend);
        });
      }

      const px2 = player.position.x;
      const pz2 = player.position.z;
      // Desired camera position (orbit math)
      const camDX = Math.sin(theta) * Math.cos(phi) * tRad;
      const camDY = Math.sin(phi) * tRad + 1;
      const camDZ = Math.cos(theta) * Math.cos(phi) * tRad;
      // Raycast from player head toward desired camera position; if a hull wall is in the way, pull camera in.
      const camOriginX = px2;
      const camOriginY = 1.5;
      const camOriginZ = pz2;
      const dirX = camDX, dirY = camDY - camOriginY, dirZ = camDZ;
      const dirLen = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ) || 1;
      const ndx = dirX / dirLen, ndy = dirY / dirLen, ndz = dirZ / dirLen;
      let safeRad = tRad;
      if (spaceshipHullGroup) {
        raycaster.set(
          new THREE.Vector3(camOriginX, camOriginY, camOriginZ),
          new THREE.Vector3(ndx, ndy, ndz),
        );
        raycaster.far = dirLen;
        const hits = raycaster.intersectObject(spaceshipHullGroup, true);
        const wallHit = hits.find((h) => {
          const slot = h.object?.userData?.hullSlot;
          // skip floor/glass/trim — only opaque walls should pull the camera in
          return slot !== 'deck_floor' && slot !== 'canopy_glass' && slot !== 'hull_trim' && slot !== 'interior_floor';
        });
        if (wallHit) {
          safeRad = Math.max(1.5, wallHit.distance - 0.5);
        }
      }
      const r = safeRad;
      camera.position.set(
        px2 + Math.sin(theta) * Math.cos(phi) * r,
        Math.sin(phi) * r + 1,
        pz2 + Math.cos(theta) * Math.cos(phi) * r,
      );
      camera.lookAt(px2, 1.5, pz2);

      // Earth rotation + cloud drift + starfield drift
      const space = scene.userData.spaceRefs;
      if (space) {
        space.planet.rotation.y = t * 0.035;
        space.clouds.rotation.y = t * 0.05;
        space.stars.rotation.y = t * 0.003;
      }

      cg.rotation.y = t * 0.65;
      cg.position.y = 2.6 + Math.sin(t * 1.0) * 0.18;
      gem.rotation.y = t * 2.0;

      // Cube float + spin + click squish (faster during hype pump)
      const isHypePumping = sceneRef.current?.hypePumping;
      const spinSpeed = isHypePumping ? 2.8 : 0.8;
      if (!dragging?.isCube) bucket.position.y = 1.5 + Math.sin(t * (isHypePumping ? 2.4 : 1.2)) * 0.15;
      bucket.rotation.y = t * spinSpeed;
      bucket.rotation.x = t * (isHypePumping ? 0.9 : 0.3);
      if (t < bucketBounceEnd) {
        const p = (bucketBounceEnd - t) / 0.25;
        const squish = Math.sin(p * Math.PI);
        bucket.scale.set(1.6 * (1 + squish * 0.22), 1.6 * (1 - squish * 0.28), 1.6 * (1 + squish * 0.22));
      } else {
        bucket.scale.setScalar(1.6);
      }

      // Animate stage-specific rings
      const stageGroup = bucket.userData.stages?.[bucket.userData.currentStage ?? 0];
      if (stageGroup?.userData?.orbitRings) {
        const sp = isHypePumping ? 2.2 : 1.0;
        stageGroup.userData.orbitRings.forEach((r, i) => {
          r.rotation.z = t * sp * (0.9 + i * 0.45);
          r.rotation.x = t * sp * (0.55 + i * 0.3);
        });
      }
      if (stageGroup?.userData?.spinRings) {
        const sp = isHypePumping ? 2.5 : 1.2;
        stageGroup.userData.spinRings.forEach((r, i) => {
          r.rotation.z = t * sp * (1.0 + i * 0.6);
        });
      }

      ringMat.emissiveIntensity = 0.5 + Math.sin(t * (isHypePumping ? 5.5 : 2.8)) * 0.28;
      ceilLight.intensity = (isHypePumping ? 60 : 40) + Math.sin(t * (isHypePumping ? 3.2 : 1.4)) * (isHypePumping ? 12 : 4);
      ceilLight.position.x = Math.sin(t * 0.22) * 2.5;

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

      // Pulse status dots
      (scene.userData.statusDots || []).forEach((dot) => {
        dot.material.emissiveIntensity = 1.8 + Math.sin(t * 2.4 + dot.userData.basePhase) * 1.2;
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
      window.removeEventListener('keyup', onKeyUp);
      if (supaChannel) { try { supaChannel.unsubscribe(); } catch (e) { /* ignore */ } }
      window.removeEventListener('pointerdown', kickAudio);
      window.removeEventListener('keydown', kickAudio);
      if (ambientNodes) {
        try { ambientNodes.oscs.forEach((o) => o.stop()); } catch (e) { /* ignore */ }
        ambientNodes = null;
      }
      if (audioCtx) { try { audioCtx.close(); } catch (e) { /* ignore */ } }
      renderer.dispose();
      sceneRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomSize]);

  // Keep isOwner live in the scene (ownCoin may load after the scene effect)
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.isOwner = isOwner;
  }, [isOwner]);

  // Expose remove fns + build mode + wall ops to the scene
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.removeHomeItem = removeHomeItem;
    sceneRef.current.addWall = addWall;
    sceneRef.current.deleteWall = deleteWall;
    sceneRef.current.buildMode = buildMode;
    sceneRef.current.markLayoutDirty = () => setLayoutVersion((v) => v + 1);
    sceneRef.current.toggleEmoteWheel = () => setEmoteWheelOpen((o) => !o);
    sceneRef.current.reloadLayout = async () => {
      const layout = await fetchRoomLayout(coinId);
      if (!layout) return;
      applyLayoutToLocal(coinId, layout);
      try { setWalls(JSON.parse(localStorage.getItem(`cg-walls-${coinId}`) || '[]')); } catch (_) {}
      try { const raw = JSON.parse(localStorage.getItem(`cg-home-${coinId}`) || '{}'); const cleaned = {}; Object.entries(raw).forEach(([n, v]) => { if (findHomeModel(n)) cleaned[n] = v; }); setHomeOwned(cleaned); } catch (_) {}
      const amb = localStorage.getItem(`cg-room-ambient-${coinId}`);
      if (amb) setAmbientColor(amb);
    };
  });

  // Rebuild wall meshes whenever the walls array (or room) changes
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref?.wallGroup) return;
    const { wallGroup } = ref;
    while (wallGroup.children.length) {
      const c = wallGroup.children[0];
      wallGroup.remove(c);
      c.geometry?.dispose();
      if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose());
    }
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.85, metalness: 0.05 });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 0.45, metalness: 0.4 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.5, metalness: 0.3 });
    const wallH = wallView === 'cut' ? 1.6 : ROOM.h;
    const showMain = wallView !== 'down';
    const showCap = wallView === 'up';
    walls.forEach((w) => {
      const dx = w.x2 - w.x1;
      const dz = w.z2 - w.z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.1) return;
      const angle = -Math.atan2(dz, dx);
      const cx = (w.x1 + w.x2) / 2;
      const cz = (w.z1 + w.z2) / 2;
      if (showMain) {
        const main = new THREE.Mesh(new THREE.BoxGeometry(len, wallH, 0.16), wallMat);
        main.position.set(cx, wallH / 2, cz);
        main.rotation.y = angle;
        main.userData.wallId = w.id;
        wallGroup.add(main);
      }
      const base = new THREE.Mesh(new THREE.BoxGeometry(len + 0.05, 0.16, 0.22), baseMat);
      base.position.set(cx, 0.08, cz);
      base.rotation.y = angle;
      base.userData.wallId = w.id;
      wallGroup.add(base);
      if (showCap) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 0.05, 0.04, 0.22), capMat);
        cap.position.set(cx, ROOM.h - 0.02, cz);
        cap.rotation.y = angle;
        cap.userData.wallId = w.id;
        wallGroup.add(cap);
      }
    });
  }, [walls, roomSize, wallView]);

  // Bucket click → RC clicker (no server call; FC claim was repurposed)
  useEffect(() => {
    bucketCallbackRef.current = () => {
      clickerCallbackRef.current?.();
    };
  }, [coinId]);

  // Update room lighting + furniture colors when ambient color changes
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref?.lights) return;
    const c = new THREE.Color(ambientColor);
    ref.lights.hemi.color.set(c);
    ref.lights.ceil.color.set(c);
    ref.lights.fills.forEach((l) => l.color.set(c));
    ref.scene.fog.color.set(new THREE.Color(ambientColor).multiplyScalar(0.06));

    // Update furniture materials + embedded lights
    const allGroups = [
      ...Object.values(ref.furnitureMap).map((f) => f.group),
      ...Object.values(ref.staticMap),
      ...(ref.bucket ? [ref.bucket] : []),
    ];
    allGroups.forEach((group) => {
      (group.userData.emissiveMats || []).forEach((m) => {
        m.emissive.set(c);
        m.color.set(c.clone().multiplyScalar(0.3));
      });
      (group.userData.accentMats || []).forEach((m) => {
        m.color.set(c.clone().multiplyScalar(0.28));
      });
      group.traverse((obj) => {
        if (obj.isLight) obj.color.set(c);
      });
    });

    localStorage.setItem(`cg-room-ambient-${coinId}`, ambientColor);
  }, [ambientColor, coinId]);

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
  const comboMult = combo >= 5 ? 1 + Math.floor(combo / 5) * 0.5 : 1;
  const holding = holdings.find((h) => h.coin_id === coinId);
  const coinName = coin?.coin_name || coin?.profiles?.username || '?';
  const initial = (coinName[0] || '?').toUpperCase();
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
            <>
              {/* Build mode toggle (right side, below RC stats card) */}
              <div style={{ position: 'absolute', top: 200, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, pointerEvents: 'all', zIndex: 2 }}>
                <button
                  type="button"
                  onClick={() => setBuildMode((b) => !b)}
                  style={{
                    background: buildMode ? '#22c55e' : 'rgba(6,8,6,0.88)',
                    color: buildMode ? '#000' : '#4ade80',
                    border: `1px solid ${buildMode ? '#22c55e' : '#1a2e1a'}`,
                    borderRadius: 8, padding: '8px 12px', fontSize: 11, fontFamily: 'inherit',
                    fontWeight: 800, cursor: 'pointer', letterSpacing: '0.06em',
                    display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase',
                  }}
                >
                  <LucideIcons.Hammer size={13} /> {buildMode ? 'Building' : 'Build mode'}
                </button>
                {buildMode && walls.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { if (confirm(`Clear all ${walls.length} walls?`)) clearAllWalls(); }}
                    style={{
                      background: 'rgba(26,13,13,0.88)', color: '#ef4444',
                      border: '1px solid #3a1a1a', borderRadius: 8, padding: '5px 10px',
                      fontSize: 9, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}
                  >
                    Clear walls ({walls.length})
                  </button>
                )}
              </div>

              <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(6,8,6,0.82)', border: `1px solid ${buildMode ? '#22c55e' : '#1a2e1a'}`, borderRadius: 6, padding: '5px 12px', color: buildMode ? '#22c55e' : '#4b5563', fontSize: 9, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                {buildMode
                  ? 'drag from corner to corner to draw a wall · click a wall to delete it'
                  : 'drag to place (snaps to grid · Shift = free) · R rotate · ↑↓ raise/lower · Del remove'}
              </div>
              <div style={{ position: 'absolute', bottom: 46, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(6,8,6,0.88)', border: '1px solid #1a2e1a', borderRadius: 20, padding: '5px 10px', pointerEvents: 'all' }}>
                {AMBIENT_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setAmbientColor(hex)}
                    style={{ width: 16, height: 16, borderRadius: '50%', background: hex, border: ambientColor === hex ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                  />
                ))}
                <div style={{ width: 1, height: 12, background: '#1a2e1a', margin: '0 2px' }} />
                <input
                  type="color"
                  value={ambientColor}
                  onChange={(e) => setAmbientColor(e.target.value)}
                  style={{ width: 16, height: 16, padding: 0, border: 'none', borderRadius: '50%', cursor: 'pointer', background: 'none', flexShrink: 0 }}
                  title="Custom color"
                />
              </div>
            </>
          )}
          {!isOwner && (
            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', color: '#1e3a1e', fontSize: 9, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
              drag to orbit · scroll to zoom
            </div>
          )}

          {/* Emote wheel (open with T) */}
          {emoteWheelOpen && (() => {
            const emotes = [
              { name: 'clap',    label: 'Clap',  icon: 'Hand' },
              { name: 'sit',     label: 'Sit',   icon: 'Armchair' },
              { name: 'punch',   label: 'Punch', icon: 'Zap' },
              { name: 'slash',   label: 'Slash', icon: 'Swords' },
              { name: 'bigjump', label: 'Leap',  icon: 'ArrowUpFromLine' },
              { name: 'death',   label: 'Faint', icon: 'Skull' },
            ];
            const radius = 110;
            return (
              <div
                style={{ position: 'absolute', inset: 0, pointerEvents: 'all', zIndex: 4 }}
                onClick={() => setEmoteWheelOpen(false)}
              >
                <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 280, height: 280 }}>
                  {emotes.map((em, i) => {
                    const angle = (i / emotes.length) * Math.PI * 2 - Math.PI / 2;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    const Ic = LucideIcons[em.icon] ?? LucideIcons.Smile;
                    return (
                      <button
                        key={em.name}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          sceneRef.current?.playEmote?.(em.name);
                          setEmoteWheelOpen(false);
                        }}
                        style={{
                          position: 'absolute', left: '50%', top: '50%',
                          transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                          width: 76, height: 76, borderRadius: '50%',
                          background: 'rgba(6,8,6,0.92)', border: '2px solid #22c55e',
                          color: '#bbf7d0', cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 4, fontFamily: 'inherit', fontSize: 9, fontWeight: 800, letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        <Ic size={22} />
                        <span>{em.label}</span>
                      </button>
                    );
                  })}
                  <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', color: '#4ade80', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em' }}>
                    EMOTES
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Habbo-style chat input */}
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'all', zIndex: 3 }}>
            <input
              type="text"
              value={chatDraft}
              maxLength={120}
              placeholder="Say something…"
              onChange={(e) => setChatDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const text = chatDraft.trim();
                  if (text) sceneRef.current?.sendChat?.(text);
                  setChatDraft('');
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') { setChatDraft(''); e.currentTarget.blur(); }
              }}
              style={{
                background: 'rgba(6,8,6,0.88)', color: '#bbf7d0',
                border: '1px solid #1a2e1a', borderRadius: 20,
                padding: '10px 18px', fontSize: 12, width: 320,
                fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {/* Wall view cycle (Sims-style) */}
          <button
            type="button"
            onClick={() => setWallView((v) => v === 'up' ? 'cut' : v === 'cut' ? 'down' : 'up')}
            style={{
              position: 'absolute', top: isOwner ? 296 : 200, right: 16, zIndex: 2, pointerEvents: 'all',
              background: 'rgba(6,8,6,0.88)', color: '#4ade80',
              border: '1px solid #1a2e1a', borderRadius: 8, padding: '8px 12px',
              fontSize: 11, fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
            title="Cycle wall visibility (Up → Cut → Down)"
          >
            <LucideIcons.Layers size={13} /> Walls: {wallView}
          </button>


          {/* Room Coin tycoon HUD — top right */}
          <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(6,8,6,0.92)', border: `1px solid ${hypePhase === 'pumping' ? '#78350f' : '#1a2e1a'}`, borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(12px)', minWidth: 158, textAlign: 'right', transition: 'border-color 0.4s' }}>
            <div style={{ color: '#4b5563', fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Room Coins</div>
            <div style={{ color: '#4ade80', fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {Math.floor(roomCoins).toLocaleString()}
            </div>
            {passiveRate > 0 && (
              <div style={{ color: '#22c55e', fontSize: 9, marginTop: 3 }}>+{passiveRate.toFixed(1)} /sec</div>
            )}
            <div style={{ color: '#374151', fontSize: 8, marginTop: 4 }}>
              {sessionClicks.toLocaleString()} clicks · {STAGE_NAMES[cubeStage]}
            </div>
            {combo >= 3 && (
              <div style={{ color: '#f59e0b', fontSize: 11, fontWeight: 800, marginTop: 5, animation: 'rc-combo-pop 0.3s ease' }}>
                COMBO ×{comboMult.toFixed(1)}
              </div>
            )}
            {/* Hype meter */}
            <div style={{ marginTop: 8, borderTop: '1px solid #1a2e1a', paddingTop: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ color: hypePhase === 'pumping' ? '#f59e0b' : hypePhase === 'crashed' ? '#374151' : '#4b5563', fontSize: 8, fontWeight: hypePhase !== 'normal' ? 800 : 400, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {hypePhase === 'pumping' ? '🔥 PUMPING' : hypePhase === 'crashed' ? 'CRASHED' : 'Hype'}
                </span>
                <span style={{ color: hypePhase === 'pumping' ? '#f59e0b' : hypePhase === 'crashed' ? '#374151' : hypeColor, fontSize: 8, fontWeight: 700 }}>{Math.floor(hype)}%</span>
              </div>
              <div style={{ height: 5, background: '#1a2e1a', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${hype}%`, background: hypePhase === 'pumping' ? '#f59e0b' : hypePhase === 'crashed' ? '#374151' : hypeColor, borderRadius: 3, transition: 'width 0.14s ease, background 0.3s', boxShadow: hypePhase === 'pumping' ? '0 0 8px #f59e0b' : 'none' }} />
              </div>
              {hypePhase === 'pumping' && <div style={{ color: '#f59e0b', fontSize: 8, marginTop: 3, fontWeight: 800 }}>RC ×2 active!</div>}
              {hypePhase === 'crashed' && <div style={{ color: '#374151', fontSize: 8, marginTop: 3 }}>recovering...</div>}
            </div>
          </div>

          {/* Crit flash overlay */}
          {critFlash && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 25, background: 'radial-gradient(circle at 50% 44%, rgba(251,191,36,0.22) 0%, transparent 60%)', animation: 'rc-crit 0.38s ease-out forwards' }} />
          )}

          {/* Evolution toast */}
          {evolutionToast && (
            <div style={{ position: 'absolute', top: '38%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(6,8,6,0.95)', border: '1px solid #f59e0b', borderRadius: 10, padding: '12px 22px', pointerEvents: 'none', textAlign: 'center', animation: 'rc-combo-pop 0.4s ease' }}>
              <div style={{ color: '#f59e0b', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Cube Evolved!</div>
              <div style={{ color: '#fde68a', fontSize: 17, fontWeight: 900 }}>{evolutionToast}</div>
            </div>
          )}

          {/* Floating +N RC numbers */}
          {floaters.map((fl) => (
            <div
              key={fl.id}
              style={{
                position: 'absolute',
                left: `${fl.x}%`,
                top: `${fl.y}%`,
                pointerEvents: 'none',
                animation: 'rc-float 1.4s ease-out forwards',
                fontSize: fl.isCrit ? 22 : fl.isCombo ? 19 : 14,
                fontWeight: 900,
                color: fl.isCrit ? '#fbbf24' : fl.isCombo ? '#f59e0b' : '#4ade80',
                textShadow: fl.isCrit ? '0 0 18px #f59e0b' : fl.isCombo ? '0 0 14px #f59e0b' : '0 0 8px #22c55e',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                fontFamily: "'DM Mono','Space Mono',monospace",
              }}
            >
              +{fl.amount} RC{fl.isCrit ? ' CRITICAL!' : fl.isCombo ? ' COMBO!' : ''}
            </div>
          ))}
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
          {[['i', 'Info'], ['s', 'Shop']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              style={{ flex: 1, padding: '9px 0', background: 'none', border: 'none', borderBottom: tab === key ? '2px solid #22c55e' : '2px solid transparent', color: tab === key ? '#22c55e' : '#4b5563', fontSize: 10, fontFamily: 'inherit', fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              {label}
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

          {tab === 's' && (
            <>
              <div style={{ color: '#4b5563', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Room Upgrades</div>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
                {[['Click', `${clickPower}×`], ['Passive', `${passiveRate.toFixed(1)}/s`], ['Crit', `${Math.round(critChance * 100)}%`]].map(([l, v]) => (
                  <div key={l} style={{ background: '#0d0d0d', border: '1px solid #1a2e1a', borderRadius: 6, padding: '7px 8px', textAlign: 'center' }}>
                    <div style={{ color: '#4b5563', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                    <div style={{ color: '#4ade80', fontSize: 13, fontWeight: 800, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#0d1a0d', borderRadius: 6, border: '1px solid #1a2e1a', marginBottom: 12 }}>
                <span style={{ color: '#4b5563', fontSize: 9 }}>Balance</span>
                <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 800 }}>{Math.floor(roomCoins).toLocaleString()} RC</span>
              </div>

              {/* Upgrade list */}
              {UPGRADES.map((upg) => {
                const count = upgradesPurchased[upg.id] || 0;
                const cost = Math.ceil(upg.baseCost * Math.pow(1.5, count));
                const canAfford = roomCoins >= cost;
                return (
                  <div
                    key={upg.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#161616', borderRadius: 7, border: `1px solid ${canAfford ? '#1a3a1a' : '#111'}`, marginBottom: 6, opacity: canAfford ? 1 : 0.55 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 700 }}>
                        {upg.label}{count > 0 && <span style={{ color: '#22c55e', fontSize: 9, marginLeft: 5 }}>×{count}</span>}
                      </div>
                      <div style={{ color: '#4b5563', fontSize: 9, marginTop: 2 }}>{upg.desc}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => buyUpgrade(upg.id)}
                      disabled={!canAfford}
                      style={{
                        background: canAfford ? '#22c55e' : '#1a2e1a',
                        border: 'none', borderRadius: 5,
                        color: canAfford ? '#000' : '#374151',
                        fontSize: 9, fontWeight: 800, fontFamily: 'inherit',
                        padding: '5px 9px', cursor: canAfford ? 'pointer' : 'default',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      {cost.toLocaleString()} RC
                    </button>
                  </div>
                );
              })}

              {/* Furniture shop */}
              {/* Home Pack browser */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 }}>
                <div style={{ color: '#4b5563', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Home Pack</div>
                <div style={{ color: '#374151', fontSize: 9 }}>{Object.keys(homeOwned).length}/{HOME_PACK.length}</div>
              </div>
              <input
                type="text"
                value={homeSearch}
                onChange={(e) => setHomeSearch(e.target.value)}
                placeholder="Search furniture..."
                style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d0d', border: '1px solid #1a2e1a', borderRadius: 5, color: '#e2e8f0', fontSize: 10, padding: '6px 8px', fontFamily: 'inherit', marginBottom: 6 }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {HOME_PACK_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setHomeCategory(cat)}
                    style={{
                      background: homeCategory === cat ? '#22c55e' : '#0d0d0d',
                      color: homeCategory === cat ? '#000' : '#4b5563',
                      border: `1px solid ${homeCategory === cat ? '#22c55e' : '#1a2e1a'}`,
                      borderRadius: 4, padding: '3px 7px', fontSize: 9, fontFamily: 'inherit',
                      fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                {HOME_PACK
                  .filter((it) => homeCategory === 'All' || it.category === homeCategory)
                  .filter((it) => !homeSearch || it.label.toLowerCase().includes(homeSearch.toLowerCase()) || it.name.toLowerCase().includes(homeSearch.toLowerCase()))
                  .map((it) => {
                    const count = ownedCount(homeOwned, it.name);
                    const owned = count > 0;
                    const canAfford = roomCoins >= it.price;
                    const buyDisabled = !canAfford || !isOwner;
                    return (
                      <div
                        key={it.name}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: owned ? '#0d1a0d' : '#161616', borderRadius: 6, border: `1px solid ${owned ? '#1a3a1a' : '#1a2e1a'}`, opacity: owned ? 1 : (canAfford ? 1 : 0.6), position: 'relative' }}
                      >
                        {count > 1 && (
                          <span style={{ position: 'absolute', top: 4, right: 4, background: '#22c55e', color: '#000', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 8, zIndex: 1 }}>×{count}</span>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <HomeModelThumb name={it.name} size={64} />
                        </div>
                        <div style={{ color: '#e2e8f0', fontSize: 10, fontWeight: 700, lineHeight: 1.2, minHeight: 24 }}>{it.label}</div>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {owned && (
                            <button
                              type="button"
                              onClick={() => removeHomeItem(it.name)}
                              disabled={!isOwner}
                              title={`Refund ${Math.floor(it.price * 0.5).toLocaleString()} RC`}
                              style={{
                                background: '#1a0d0d', border: '1px solid #3a1a1a', borderRadius: 4,
                                color: '#ef4444', fontSize: 9, fontWeight: 800, fontFamily: 'inherit',
                                padding: '4px 8px', cursor: isOwner ? 'pointer' : 'default',
                              }}
                            >−</button>
                          )}
                          <button
                            type="button"
                            onClick={() => buyHomeItem(it.name)}
                            disabled={buyDisabled}
                            style={{
                              flex: 1,
                              background: canAfford ? '#22c55e' : '#1a2e1a',
                              color: canAfford ? '#000' : '#374151',
                              border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 800,
                              fontFamily: 'inherit', padding: '4px 6px', cursor: buyDisabled ? 'default' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {it.price.toLocaleString()}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div style={{ marginTop: 10, padding: '8px 10px', background: '#0f0f0f', borderRadius: 6, border: '1px solid #1a2e1a', color: '#374151', fontSize: 9, lineHeight: 1.6 }}>
                Click the glowing cube to earn RC. Combos build fast clicks. Drag furniture to place, R to rotate, ↑/↓ raise/lower, Delete to remove (50% RC refund).
              </div>
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
