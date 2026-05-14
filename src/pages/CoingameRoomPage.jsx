import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as THREE from 'three';
import * as LucideIcons from 'lucide-react';
import { fetchCoinById, fetchCoinRewards, spotPrice } from '../utils/coingameApi';
import { useFinanceStore } from '../store/useFinanceStore';

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

function CoinIcon({ name, size = 16, color = 'currentColor' }) {
  const Icon = LucideIcons[name];
  if (!Icon) return null;
  return <Icon size={size} color={color} strokeWidth={1.5} />;
}

function FC({ amount, decimals = 4 }) {
  return (
    <span>
      {Number(amount ?? 0).toLocaleString(undefined, { maximumFractionDigits: decimals })}
      <span style={{ marginLeft: '0.25em', fontSize: '0.75em', color: '#4b5563', fontFamily: 'monospace' }}>FC</span>
    </span>
  );
}

function RewardRow({ item }) {
  const locked = !item.unlocked;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '8px 10px', borderRadius: 7, marginBottom: 6,
      background: locked ? 'rgba(255,255,255,0.02)' : item.rbg,
      border: `1px solid ${locked ? 'rgba(255,255,255,0.06)' : item.rb}`,
      opacity: locked ? 0.5 : 1,
    }}>
      <span style={{ color: locked ? '#374151' : item.color, flexShrink: 0 }}>
        <CoinIcon name={item.icon} size={18} color={locked ? '#374151' : item.color} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: locked ? '#4b5563' : '#e2e8f0', fontSize: 11, fontWeight: 700 }}>{item.label}</div>
        <div style={{ color: locked ? '#374151' : item.color, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
          {locked ? item.unlock_description : item.rarity}
        </div>
      </div>
      {!locked && (
        <span style={{ fontSize: 9, color: '#22c55e', opacity: 0.6 }}>
          <LucideIcons.Check size={12} />
        </span>
      )}
    </div>
  );
}

export default function CoingameRoomPage() {
  const { coinId } = useParams();
  const holdings = useFinanceStore((s) => s.coingameHoldings);

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  const [coin, setCoin] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [tab, setTab] = useState('r');
  const [tooltip, setTooltip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCoinById(coinId), fetchCoinRewards(coinId)]).then(([c, r]) => {
      if (!cancelled) { setCoin(c); setRewards(r); setLoading(false); }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [coinId]);

  // Three.js scene
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
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x080808);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060d06, 0.022);

    const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 120);
    camera.position.set(0, 6, 13);
    camera.lookAt(0, 1.8, 0);

    const amb = new THREE.AmbientLight(0x0d1a0d, 2.0);
    scene.add(amb);
    const mainG = new THREE.PointLight(0x22c55e, 6.5, 28);
    mainG.position.set(0, 8, 0);
    mainG.castShadow = true;
    mainG.shadow.mapSize.set(1024, 1024);
    scene.add(mainG);
    const acc = new THREE.PointLight(0x4ade80, 1.3, 18);
    acc.position.set(-8, 4, -5);
    scene.add(acc);
    scene.add(Object.assign(new THREE.PointLight(0x052e16, 0.7, 22), { position: { x: 7, y: 3, z: 6 } }));

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x050d05, roughness: 0.85, metalness: 0.3 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 28), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    scene.add(new THREE.GridHelper(26, 26, 0x0d2b0d, 0x0a1e0a));

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x060d06, roughness: 0.9, metalness: 0.1, side: THREE.BackSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(28, 16, 28), wallMat);
    room.position.y = 7;
    scene.add(room);

    const ringMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.5, roughness: 0.1, metalness: 1 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.025, 8, 80), ringMat);
    ring.position.y = 0.38; ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    const innerRingMat = new THREE.MeshStandardMaterial({ color: 0x15803d, emissive: 0x15803d, emissiveIntensity: 0.25, roughness: 0.2, metalness: 0.9 });
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.018, 8, 64), innerRingMat);
    innerRing.position.y = 0.39; innerRing.rotation.x = Math.PI / 2;
    scene.add(innerRing);

    // Central coin
    const cg = new THREE.Group();
    cg.position.set(0, 2.6, 0);
    scene.add(cg);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.03, metalness: 1, emissive: 0x15803d, emissiveIntensity: 0.35 });
    const coinMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.14, 80), coinMat);
    coinMesh.castShadow = true; cg.add(coinMesh);
    const bevMesh = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 8, 80), new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.02, metalness: 1 }));
    bevMesh.rotation.x = Math.PI / 2; cg.add(bevMesh);
    const faceRing = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.025, 8, 64), new THREE.MeshStandardMaterial({ color: 0x052e16, roughness: 0.3, metalness: 0.5 }));
    faceRing.rotation.x = Math.PI / 2; faceRing.position.y = 0.072; cg.add(faceRing);
    const gemMat = new THREE.MeshStandardMaterial({ color: 0xbbf7d0, emissive: 0x22c55e, emissiveIntensity: 1.6, roughness: 0, metalness: 1 });
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), gemMat);
    gem.position.y = 0.072; cg.add(gem);

    const orbits = [[2.0, 0x22c55e, 0.70, 0.40], [2.8, 0x16a34a, 0.46, 0.72], [3.6, 0x4ade80, 0.29, 0.22]].map(([r, col, spd, tlt]) => {
      const m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 1 });
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, 0.017, 8, 100), m);
      mesh.rotation.x = Math.PI / 2; cg.add(mesh);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.0, roughness: 0.1, metalness: 0.5 }));
      cg.add(orb);
      return { mesh, orb, r, spd, tlt, angle: Math.random() * Math.PI * 2 };
    });

    const miniCoins = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const rad = 4.5 + Math.random() * 2.5;
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.034, 32), new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.1, metalness: 0.9, emissive: 0x15803d, emissiveIntensity: 0.2 }));
      mesh.position.set(Math.cos(a) * rad, 1 + Math.random() * 2.5, Math.sin(a) * rad);
      scene.add(mesh);
      return { mesh, angle: a, r: rad, spd: 0.18 + Math.random() * 0.28, bob: Math.random() * Math.PI * 2 };
    });

    // Candle chart on back wall
    const bars = [0.4, 0.9, 0.6, 1.4, 0.7, 1.8, 1.0, 2.0, 1.3, 2.5, 1.6, 1.1, 2.0, 2.4, 1.7, 2.9, 2.1, 1.4];
    bars.forEach((h, i) => {
      const up = i === 0 || h > bars[i - 1];
      const bmat = new THREE.MeshStandardMaterial({ color: up ? 0x22c55e : 0xef4444, emissive: up ? 0x22c55e : 0xef4444, emissiveIntensity: 0.14, roughness: 0.4, metalness: 0.3 });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.21, h, 0.04), bmat);
      bar.position.set(-5 + i * 0.6, h / 2 + 0.08, -12.8); scene.add(bar);
      const wick = new THREE.Mesh(new THREE.BoxGeometry(0.025, h * 0.45, 0.04), bmat);
      wick.position.set(-5 + i * 0.6, h + h * 0.23, -12.8); scene.add(wick);
    });

    // Desk
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x0c1a0c, roughness: 0.4, metalness: 0.75 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.5), deskMat);
    desk.position.set(-6, 0.94, -4); desk.castShadow = true; desk.receiveShadow = true; scene.add(desk);
    [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.94, 0.1), deskMat);
      leg.position.set(-6 + lx, 0.47, -4 + lz); scene.add(leg);
    });
    const mon = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.065), new THREE.MeshStandardMaterial({ color: 0x080d08, roughness: 0.5, metalness: 0.9 }));
    mon.position.set(-6, 1.97, -4.58); scene.add(mon);
    const scrMat = new THREE.MeshStandardMaterial({ color: 0x030d03, emissive: 0x22c55e, emissiveIntensity: 0.6, roughness: 1 });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.82), scrMat);
    scr.position.set(-6, 1.97, -4.54); scene.add(scr);

    // Trophy shelf
    const shMat = new THREE.MeshStandardMaterial({ color: 0x0c1a0c, roughness: 0.4, metalness: 0.75 });
    scene.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 0.42), shMat), { position: { x: 7, y: 3.0, z: -8.5 } }));
    scene.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.06, 0.04), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.4, roughness: 0.1, metalness: 1 })), { position: { x: 7, y: 3.06, z: -12.75 } }));
    [0xf59e0b, 0xc084fc, 0x22c55e, 0x38bdf8].forEach((col, i) => {
      const tMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.08, metalness: 1, emissive: col, emissiveIntensity: 0.35 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.36, 8), tMat);
      base.position.set(6.0 + i * 0.68, 3.22, -8.5); scene.add(base);
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), tMat);
      cup.position.set(6.0 + i * 0.68, 3.41, -8.5); scene.add(cup);
    });

    // Reward collectables — will be rebuilt when rewards load
    const itemPositions = [[-3.5, 2], [-1.5, -4.5], [2.5, 3.5], [4.5, -2.5], [-5.5, 4], [-4, -2.5], [3.5, -5], [2.5, 2.5]];
    let itemMeshes = [];
    let spheres = [];

    function buildItems(rewardList) {
      // Remove old meshes
      itemMeshes.forEach(({ sp, gr, plat }) => { scene.remove(sp); scene.remove(gr); scene.remove(plat); });
      itemMeshes = [];
      spheres = [];

      rewardList.forEach((item, i) => {
        const [x, z] = itemPositions[i % itemPositions.length];
        const unlocked = item.unlocked;
        const col = new THREE.Color(item.color);
        const dimCol = new THREE.Color('#1a2e1a');

        const platMat = new THREE.MeshStandardMaterial({ color: 0x0a1a0a, roughness: 0.3, metalness: 0.85 });
        const plat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.07, 16), platMat);
        plat.position.set(x, 0.035, z); scene.add(plat);

        const gMat = new THREE.MeshStandardMaterial({ color: unlocked ? col : dimCol, emissive: unlocked ? col : dimCol, emissiveIntensity: unlocked ? 0.9 : 0.15, transparent: true, opacity: unlocked ? 0.42 : 0.18, roughness: 0.1, metalness: 1 });
        const gr = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.02, 6, 32), gMat);
        gr.position.set(x, 0.085, z); gr.rotation.x = Math.PI / 2; scene.add(gr);

        const sMat = new THREE.MeshStandardMaterial({ color: unlocked ? col : dimCol, roughness: unlocked ? 0.08 : 0.6, metalness: unlocked ? 0.85 : 0.2, emissive: unlocked ? col : dimCol, emissiveIntensity: unlocked ? 0.5 : 0.05 });
        const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 1), sMat);
        sp.position.set(x, 0.65, z); sp.castShadow = true; scene.add(sp);

        itemMeshes.push({ sp, gr, plat, item, bob: Math.random() * Math.PI * 2 });
        spheres.push(sp);
      });
    }

    // Build with whatever rewards are loaded so far (may be empty on first render)
    buildItems(rewards);

    // Particles
    const N = 800;
    const pPos = new Float32Array(N * 3);
    const pCol = new Float32Array(N * 3);
    const pVel = [];
    for (let i = 0; i < N; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 26;
      pPos[i * 3 + 1] = Math.random() * 14;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 26;
      const v = Math.random();
      pCol[i * 3] = 0; pCol[i * 3 + 1] = 0.15 + v * 0.85; pCol[i * 3 + 2] = 0;
      pVel.push(0.011 + Math.random() * 0.022);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.65 })));

    // Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onMouseMove(e) {
      const rect = cvs.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(spheres);
      if (hits.length > 0) {
        const it = itemMeshes[spheres.indexOf(hits[0].object)].item;
        setTooltip({ item: it, x: e.clientX, y: e.clientY });
      } else {
        setTooltip(null);
      }
    }
    wrap.addEventListener('mousemove', onMouseMove);

    // Orbit controls
    let isDrag = false; let px = 0; let py = 0;
    let theta = 0.12; let phi = 0.40;
    let tTheta = 0.12; let tPhi = 0.40;
    let tRad = 13; let autoRot = true;

    const onMDown = (e) => { isDrag = true; autoRot = false; px = e.clientX; py = e.clientY; };
    const onMUp = () => { isDrag = false; };
    const onMDrag = (e) => {
      if (!isDrag) return;
      tTheta -= (e.clientX - px) * 0.007;
      tPhi = Math.max(0.1, Math.min(1.25, tPhi + (e.clientY - py) * 0.005));
      px = e.clientX; py = e.clientY;
    };
    const onWheel = (e) => { tRad = Math.max(4, Math.min(20, tRad + e.deltaY * 0.013)); e.preventDefault(); };
    wrap.addEventListener('mousedown', onMDown);
    window.addEventListener('mouseup', onMUp);
    window.addEventListener('mousemove', onMDrag);
    wrap.addEventListener('wheel', onWheel, { passive: false });

    let touchStart = null;
    const onTStart = (e) => { if (e.touches.length === 1) { autoRot = false; touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; } };
    const onTMove = (e) => {
      if (!touchStart || e.touches.length !== 1) return;
      tTheta -= (e.touches[0].clientX - touchStart.x) * 0.007;
      tPhi = Math.max(0.1, Math.min(1.25, tPhi + (e.touches[0].clientY - touchStart.y) * 0.005));
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      e.preventDefault();
    };
    wrap.addEventListener('touchstart', onTStart, { passive: true });
    wrap.addEventListener('touchmove', onTMove, { passive: false });

    const clock = new THREE.Clock();
    let animId;
    function animate() {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (autoRot) tTheta += 0.0022;
      theta += (tTheta - theta) * 0.06;
      phi += (tPhi - phi) * 0.06;
      camera.position.set(Math.sin(theta) * Math.cos(phi) * tRad, Math.sin(phi) * tRad + 1, Math.cos(theta) * Math.cos(phi) * tRad);
      camera.lookAt(0, 1.8, 0);

      cg.rotation.y = t * 0.72; cg.position.y = 2.6 + Math.sin(t * 1.1) * 0.2;
      gem.rotation.y = t * 2.2; gem.rotation.x = Math.sin(t * 0.75) * 0.5;

      orbits.forEach((o, i) => {
        o.angle += o.spd * 0.016;
        o.mesh.rotation.x = Math.PI / 2 + Math.sin(t * 0.4 + i) * o.tlt;
        o.mesh.rotation.z = Math.cos(t * 0.3 + i) * 0.22;
        o.orb.position.set(Math.cos(o.angle) * o.r, Math.sin(t * 0.6 + i * 2) * 0.18, Math.sin(o.angle) * o.r);
      });

      miniCoins.forEach((mc) => {
        mc.angle += mc.spd * 0.01;
        mc.mesh.position.x = Math.cos(mc.angle) * mc.r;
        mc.mesh.position.z = Math.sin(mc.angle) * mc.r;
        mc.mesh.position.y = 1 + Math.sin(t * 1.3 + mc.bob) * 0.38;
        mc.mesh.rotation.y += 0.055; mc.mesh.rotation.z += 0.018;
      });

      itemMeshes.forEach((im) => {
        if (im.item.unlocked) {
          im.sp.position.y = 0.65 + Math.sin(t * 1.4 + im.bob) * 0.13;
          im.sp.rotation.y += 0.022;
          im.gr.material.opacity = 0.3 + Math.sin(t * 2 + im.bob) * 0.14;
        }
      });

      ringMat.emissiveIntensity = 0.5 + Math.sin(t * 3.0) * 0.3;
      innerRingMat.emissiveIntensity = 0.25 + Math.sin(t * 2.5 + 1) * 0.15;
      scrMat.emissiveIntensity = 0.45 + Math.sin(t * 2.2) * 0.2;
      mainG.intensity = 6.5 + Math.sin(t * 1.6) * 1.2;
      mainG.position.x = Math.sin(t * 0.28) * 3.5;
      acc.intensity = 1.3 + Math.sin(t * 2.1 + 1) * 0.4;

      const pp = pGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        pp.array[i * 3 + 1] -= pVel[i];
        if (pp.array[i * 3 + 1] < 0) {
          pp.array[i * 3 + 1] = 14;
          pp.array[i * 3] = (Math.random() - 0.5) * 26;
          pp.array[i * 3 + 2] = (Math.random() - 0.5) * 26;
        }
      }
      pp.needsUpdate = true;
      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(() => {
      W = wrap.clientWidth; H = wrap.clientHeight;
      camera.aspect = W / H; camera.updateProjectionMatrix();
      renderer.setSize(W, H, false);
    });
    ro.observe(wrap);

    // Expose buildItems so the rewards-load effect can call it
    wrap._buildItems = buildItems;

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      wrap.removeEventListener('mousemove', onMouseMove);
      wrap.removeEventListener('mousedown', onMDown);
      window.removeEventListener('mouseup', onMUp);
      window.removeEventListener('mousemove', onMDrag);
      wrap.removeEventListener('wheel', onWheel);
      wrap.removeEventListener('touchstart', onTStart);
      wrap.removeEventListener('touchmove', onTMove);
      renderer.dispose();
    };
  }, []);

  // Rebuild 3D items when rewards arrive from the API
  useEffect(() => {
    if (rewards.length > 0 && wrapRef.current?._buildItems) {
      wrapRef.current._buildItems(rewards);
    }
  }, [rewards]);

  const price = coin ? spotPrice(Number(coin.tokens_minted), Number(coin.base_price)) : 0;
  const holding = holdings.find((h) => h.coin_id === coinId);
  const coinName = coin?.coin_name || coin?.profiles?.username || '?';
  const initial = (coinName[0] || '?').toUpperCase();
  const unlockedCount = rewards.filter((r) => r.unlocked).length;
  const sortedRewards = [...rewards].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

  const infoRows = [
    ['Items unlocked', `${unlockedCount} / ${rewards.length}`],
    ['Supply', loading ? '—' : Number(coin?.tokens_minted ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })],
    ['Status', coin?.status ?? '—'],
    ['Your hold', holding ? `${Number(holding.tokens_held).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${coinName}` : '—'],
  ];

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#080808', fontFamily: "'DM Mono', 'Space Mono', monospace", overflow: 'hidden', position: 'relative' }}>
      {/* Three.js canvas */}
      <div ref={wrapRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

        {/* HUD */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
          <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(8,8,8,0.92)', border: '1px solid #1a2e1a', borderRadius: 10, padding: '14px 16px', backdropFilter: 'blur(12px)', minWidth: 200 }}>
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
                <div style={{ color: '#4b5563', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Rewards</div>
                <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700, marginTop: 2 }}>{loading ? '—' : `${unlockedCount}/${rewards.length}`}</div>
              </div>
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', color: '#1e3a1e', fontSize: 10, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
            drag to orbit · scroll to zoom
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div style={{ position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 10, background: 'rgba(6,6,6,0.97)', border: `1px solid ${tooltip.item.unlocked ? tooltip.item.rb : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, padding: '10px 14px', pointerEvents: 'none', zIndex: 9999, backdropFilter: 'blur(10px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <CoinIcon name={tooltip.item.icon} size={18} color={tooltip.item.unlocked ? tooltip.item.color : '#4b5563'} />
              <span style={{ color: tooltip.item.unlocked ? '#e2e8f0' : '#6b7280', fontSize: 12, fontWeight: 700 }}>{tooltip.item.label}</span>
            </div>
            {tooltip.item.unlocked ? (
              <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 9999, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: tooltip.item.rbg, border: `1px solid ${tooltip.item.rb}`, color: tooltip.item.color }}>
                {tooltip.item.rarity}
              </span>
            ) : (
              <span style={{ fontSize: 9, color: '#4b5563' }}>{tooltip.item.unlock_description}</span>
            )}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={{ width: 250, flexShrink: 0, background: '#111111', borderLeft: '1px solid #1a2e1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 16px 13px', borderBottom: '1px solid #1a2e1a' }}>
          <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <LucideIcons.Home size={13} /> {loading ? '...' : `${coinName}'s room`}
          </div>
          <div style={{ color: '#4b5563', fontSize: 9 }}>Virtual meme coin lair</div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #1a2e1a' }}>
          {[['r', LucideIcons.Trophy, 'Rewards'], ['i', LucideIcons.Info, 'Info']].map(([key, Icon, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: '11px 4px', fontSize: 10, fontFamily: 'inherit', background: 'transparent', border: 'none', borderBottom: tab === key ? '2px solid #22c55e' : '2px solid transparent', color: tab === key ? '#22c55e' : '#4b5563', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        <div style={{ padding: 14, flex: 1, overflowY: 'auto' }}>
          {tab === 'r' ? (
            <>
              <div style={{ color: '#4b5563', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                {loading ? 'Loading...' : `${unlockedCount} of ${rewards.length} unlocked`}
              </div>
              {sortedRewards.map((item) => <RewardRow key={item.id} item={item} />)}
            </>
          ) : (
            <>
              <div style={{ color: '#4b5563', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Coin info</div>
              {infoRows.map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#161616', borderRadius: 6, border: '1px solid #1a2e1a', marginBottom: 6 }}>
                  <span style={{ color: '#4b5563', fontSize: 10 }}>{label}</span>
                  <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 700 }}>{value}</span>
                </div>
              ))}
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
