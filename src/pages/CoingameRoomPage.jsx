import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as LucideIcons from 'lucide-react';
import { fetchCoinById, spotPrice } from '../utils/coingameApi';
import { useFinanceStore } from '../store/useFinanceStore';
import { HOME_PACK, HOME_PACK_CATEGORIES, findHomeModel, loadHomeModel } from '../utils/coinroomHomePack';
import { getSupabaseBrowserClient } from '../utils/supabase';
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

// ── Shop-only furniture builders (purchased with RC) ────────────────────────

function buildNeonSign() {
  const g = new THREE.Group();
  const back = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5, metalness: 0.5 });
  const brushed = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.35, metalness: 0.9 });
  const pinkNeon = new THREE.MeshStandardMaterial({ color: 0xfce7f3, emissive: 0xec4899, emissiveIntensity: 2.8, roughness: 0.15, metalness: 0.2 });
  const cyanNeon = new THREE.MeshStandardMaterial({ color: 0xcffafe, emissive: 0x22d3ee, emissiveIntensity: 2.8, roughness: 0.15, metalness: 0.2 });

  // Mounting plate with subtle bevel
  g.add(mesh(bevelBox(1.7, 0.78, 0.08, 0.015), back, 0, 1.2, 0));
  g.add(mesh(bevelBox(1.62, 0.7, 0.04, 0.01), brushed, 0, 1.2, 0.03));

  // Helper to build a tube path
  function tube(pts, mat, radius = 0.022) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const geo = new THREE.TubeGeometry(curve, Math.max(16, pts.length * 4), radius, 12, false);
    return new THREE.Mesh(geo, mat);
  }

  // "$" letter — vertical bar + S curve
  g.add(tube([[-0.6, 1.5, 0.07], [-0.6, 0.95, 0.07]], pinkNeon));
  g.add(tube([[-0.5, 1.45, 0.07], [-0.7, 1.42, 0.07], [-0.72, 1.32, 0.07], [-0.58, 1.25, 0.07], [-0.5, 1.18, 0.07], [-0.5, 1.08, 0.07], [-0.6, 1.0, 0.07], [-0.72, 1.0, 0.07]], pinkNeon));

  // "C" letter
  g.add(tube([[-0.18, 1.45, 0.07], [-0.3, 1.45, 0.07], [-0.35, 1.35, 0.07], [-0.35, 1.05, 0.07], [-0.3, 0.95, 0.07], [-0.18, 0.95, 0.07]], cyanNeon));

  // "O" letter — torus
  const o = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 10, 32), pinkNeon);
  o.position.set(0.05, 1.2, 0.07); g.add(o);

  // "I" letter
  g.add(tube([[0.32, 1.45, 0.07], [0.32, 0.95, 0.07]], cyanNeon));

  // "N" letter
  g.add(tube([[0.5, 0.95, 0.07], [0.5, 1.45, 0.07], [0.7, 0.95, 0.07], [0.7, 1.45, 0.07]], pinkNeon));

  // Tube end caps (small bulbs)
  [[-0.6, 1.5], [-0.6, 0.95], [-0.5, 1.45], [-0.72, 1.0], [-0.18, 1.45], [-0.18, 0.95], [0.32, 1.45], [0.32, 0.95], [0.5, 0.95], [0.5, 1.45], [0.7, 0.95], [0.7, 1.45]].forEach(([x, y]) => {
    g.add(mesh(new THREE.SphereGeometry(0.025, 10, 10), brushed, x, y, 0.07));
  });

  // Stand base
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.78, 12), brushed, 0, 0.4, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.05, 16), back, 0, 0.025, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 16), brushed, 0, 0.06, 0));

  // Lights
  const pinkPL = new THREE.PointLight(0xec4899, 1.6, 4); pinkPL.position.set(-0.3, 1.2, 0.4); g.add(pinkPL);
  const cyanPL = new THREE.PointLight(0x22d3ee, 1.6, 4); cyanPL.position.set(0.3, 1.2, 0.4); g.add(cyanPL);

  g.userData.emissiveMats = [pinkNeon, cyanNeon];
  return g;
}

function buildPlant() {
  const g = new THREE.Group();
  const pot = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.82, metalness: 0 });
  const potRim = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.85, metalness: 0 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 1, metalness: 0 });
  const leafA = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55, metalness: 0, emissive: 0x14532d, emissiveIntensity: 0.12, side: THREE.DoubleSide });
  const leafB = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5, metalness: 0, emissive: 0x166534, emissiveIntensity: 0.18, side: THREE.DoubleSide });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7, metalness: 0 });

  // Terracotta pot — lathe for smooth taper
  const potPts = [[0.0, 0], [0.28, 0.02], [0.3, 0.06], [0.27, 0.32], [0.32, 0.42], [0.32, 0.46], [0.0, 0.46]];
  const potGeo = new THREE.LatheGeometry(potPts.map(([r, y]) => new THREE.Vector2(r, y)), 24);
  g.add(new THREE.Mesh(potGeo, pot));
  g.add(mesh(new THREE.TorusGeometry(0.32, 0.025, 8, 24), potRim, 0, 0.46, 0));
  // Soil
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.27, 0.04, 20), soil, 0, 0.44, 0));

  // Main stem clump
  const trunkPts = [new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(0.02, 0.7, 0.01), new THREE.Vector3(-0.01, 0.95, -0.02), new THREE.Vector3(0.03, 1.15, 0.02)];
  const trunkCurve = new THREE.CatmullRomCurve3(trunkPts);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 8, 0.04, 8), stemMat));

  // Monstera-style leaves — flat shapes that curl
  function makeLeaf(scale = 1, mat = leafA) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.25, 0.1, 0.42, 0.5, 0.32, 0.95);
    shape.bezierCurveTo(0.2, 1.2, 0.05, 1.3, 0, 1.35);
    shape.bezierCurveTo(-0.05, 1.3, -0.2, 1.2, -0.32, 0.95);
    shape.bezierCurveTo(-0.42, 0.5, -0.25, 0.1, 0, 0);
    const geo = new THREE.ShapeGeometry(shape, 16);
    geo.scale(scale, scale, scale);
    return new THREE.Mesh(geo, mat);
  }
  const leafConfigs = [
    { s: 0.55, mat: leafA, rotZ: 0.2, rotY: 0,        rotX: -0.3, x: 0,    y: 1.15, z: 0.05 },
    { s: 0.6,  mat: leafB, rotZ: -0.2, rotY: 1.05,    rotX: -0.4, x: 0.05, y: 1.1,  z: 0    },
    { s: 0.5,  mat: leafA, rotZ: 0.3,  rotY: 2.1,     rotX: -0.35,x: -0.04,y: 1.08, z: -0.03},
    { s: 0.55, mat: leafB, rotZ: -0.15,rotY: 3.14,    rotX: -0.3, x: 0,    y: 1.12, z: -0.05},
    { s: 0.48, mat: leafA, rotZ: 0.25, rotY: 4.18,    rotX: -0.4, x: -0.04,y: 1.06, z: 0.02 },
    { s: 0.52, mat: leafB, rotZ: -0.3, rotY: 5.23,    rotX: -0.35,x: 0.03, y: 1.1,  z: 0.04 },
    { s: 0.42, mat: leafA, rotZ: 0,    rotY: 0.5,     rotX: -0.7, x: 0,    y: 1.28, z: 0    },
  ];
  leafConfigs.forEach((c) => {
    const l = makeLeaf(c.s, c.mat);
    l.position.set(c.x, c.y, c.z);
    l.rotation.set(c.rotX, c.rotY, c.rotZ);
    g.add(l);
    // Small stem connecting to trunk
    const sx = c.x - Math.sin(c.rotY) * 0.04;
    const sz = c.z - Math.cos(c.rotY) * 0.04;
    g.add(mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.18, 6), stemMat, sx, c.y - 0.08, sz, c.rotX, c.rotY, 0));
  });
  return g;
}

function buildDiscoBall() {
  const g = new THREE.Group();
  const chrome = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.02, metalness: 1, emissive: 0xc084fc, emissiveIntensity: 0.45, envMapIntensity: 1.5 });
  const mirror = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.0, metalness: 1, emissive: 0xffffff, emissiveIntensity: 0.6 });
  const chain = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.25, metalness: 1 });
  const mount = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.4, metalness: 0.9 });

  // Ball — core sphere + many tiny mirror tiles
  const ballGroup = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 24), chrome);
  ballGroup.add(core);
  // Tile pattern using lat/long
  const tileGeo = new THREE.BoxGeometry(0.07, 0.07, 0.012);
  const rings = 10;
  for (let i = 1; i < rings; i++) {
    const phi = (i / rings) * Math.PI;
    const r = 0.365 * Math.sin(phi);
    const y = 0.365 * Math.cos(phi);
    const count = Math.max(6, Math.floor(r * 22));
    for (let j = 0; j < count; j++) {
      const theta = (j / count) * Math.PI * 2;
      const tile = new THREE.Mesh(tileGeo, mirror);
      tile.position.set(Math.sin(theta) * r, y, Math.cos(theta) * r);
      tile.lookAt(0, 0, 0);
      tile.rotateY(Math.PI);
      ballGroup.add(tile);
    }
  }
  ballGroup.position.set(0, 1.35, 0); g.add(ballGroup);

  // Chain — beaded
  for (let i = 0; i < 7; i++) {
    g.add(mesh(new THREE.SphereGeometry(0.025, 8, 8), chain, 0, 1.78 + i * 0.07, 0));
  }
  // Ceiling mount
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.06, 16), mount, 0, 2.28, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 12), chain, 0, 2.22, 0));

  // Lights — multiple colored, animated for sweep
  const pl = new THREE.PointLight(0xa855f7, 2.0, 6); pl.position.set(0, 1.35, 0); g.add(pl);
  const pl2 = new THREE.PointLight(0xec4899, 1.6, 5); pl2.position.set(0.5, 1.35, 0.3); g.add(pl2);
  const pl3 = new THREE.PointLight(0x22d3ee, 1.4, 5); pl3.position.set(-0.4, 1.35, -0.3); g.add(pl3);

  g.userData.spinBall = ballGroup;
  g.userData.discoLights = [pl, pl2, pl3];
  g.userData.emissiveMats = [chrome, mirror];
  return g;
}

function buildArcade() {
  const g = new THREE.Group();
  const cab = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.55, metalness: 0.35 });
  const cabDark = new THREE.MeshStandardMaterial({ color: 0x0f0a2e, roughness: 0.6, metalness: 0.3 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xec4899, emissiveIntensity: 0.7, roughness: 0.35 });
  const marquee = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 1.2, roughness: 0.5 });
  const screenBezel = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.9, metalness: 0.5 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: 0x22d3ee, emissiveIntensity: 1.4, roughness: 1 });
  const joyBall = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25, metalness: 0.6, emissive: 0xdc2626, emissiveIntensity: 0.2 });
  const joyStick = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3, metalness: 0.9 });
  const btnColors = [0xef4444, 0xfbbf24, 0x22c55e, 0x3b82f6];

  // Main cabinet — beveled body
  g.add(mesh(bevelBox(0.95, 1.55, 0.78, 0.025), cab, 0, 0.78, 0));
  // Side stripes
  [-0.477, 0.477].forEach((x) => {
    g.add(mesh(bevelBox(0.012, 1.5, 0.78, 0.005), trim, x, 0.78, 0));
  });

  // Marquee header — slightly tilted, glowing
  const marqueeGroup = new THREE.Group();
  marqueeGroup.add(mesh(bevelBox(1.02, 0.32, 0.12, 0.02), cabDark, 0, 0, 0));
  marqueeGroup.add(mesh(bevelBox(0.92, 0.22, 0.04, 0.015), marquee, 0, 0, 0.07));
  // Pixel-ish dots on marquee
  for (let i = 0; i < 5; i++) {
    g.add(mesh(new THREE.SphereGeometry(0.018, 8, 8), trim, -0.32 + i * 0.16, 1.78, 0.1));
  }
  marqueeGroup.position.set(0, 1.78, 0);
  marqueeGroup.rotation.x = -0.12;
  g.add(marqueeGroup);

  // Screen bezel — tilted back to face player
  const screenGroup = new THREE.Group();
  screenGroup.add(mesh(bevelBox(0.78, 0.6, 0.06, 0.015), screenBezel, 0, 0, 0));
  screenGroup.add(mesh(new THREE.PlaneGeometry(0.66, 0.48), screen, 0, 0, 0.035));
  // Scanlines on screen
  for (let i = 0; i < 5; i++) {
    g.add(mesh(new THREE.PlaneGeometry(0.62, 0.005), new THREE.MeshStandardMaterial({ color: 0x0e7490, emissive: 0x0e7490, emissiveIntensity: 0.4, transparent: true, opacity: 0.5 }), 0, 1.4 - 0.18 + i * 0.08, 0.42));
  }
  screenGroup.position.set(0, 1.36, 0.4);
  screenGroup.rotation.x = 0.12;
  g.add(screenGroup);

  // Control deck — angled forward
  const deck = new THREE.Group();
  deck.add(mesh(bevelBox(0.86, 0.06, 0.42, 0.012), cabDark, 0, 0, 0));
  deck.add(mesh(bevelBox(0.78, 0.04, 0.36, 0.008), cab, 0, 0.05, 0));
  // Joystick
  deck.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.015, 16), joyStick, -0.22, 0.06, 0));
  deck.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8), joyStick, -0.22, 0.12, 0));
  deck.add(mesh(new THREE.SphereGeometry(0.045, 16, 16), joyBall, -0.22, 0.2, 0));
  // Buttons (4-pack)
  btnColors.forEach((c, i) => {
    const col = i % 2; const row = Math.floor(i / 2);
    const bMat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.3, roughness: 0.3, metalness: 0.4 });
    deck.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.025, 16), bMat, 0.05 + col * 0.11, 0.07, -0.05 + row * 0.12));
    deck.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.01, 16), joyStick, 0.05 + col * 0.11, 0.06, -0.05 + row * 0.12));
  });
  // Coin slot
  deck.add(mesh(bevelBox(0.18, 0.04, 0.06, 0.005), joyStick, 0, 0.07, 0.15));
  deck.position.set(0, 0.98, 0.22);
  deck.rotation.x = -0.32;
  g.add(deck);

  // Coin door at base
  g.add(mesh(bevelBox(0.36, 0.18, 0.04, 0.008), cabDark, 0, 0.32, 0.4));
  g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 16), marquee, 0, 0.32, 0.43, Math.PI / 2, 0, 0));

  // Vents on side
  [-0.476, 0.476].forEach((x) => {
    for (let i = 0; i < 4; i++) {
      g.add(mesh(new THREE.BoxGeometry(0.008, 0.02, 0.2), cabDark, x, 1.42 - i * 0.04, 0));
    }
  });

  // Lights
  const pl = new THREE.PointLight(0x22d3ee, 1.1, 3); pl.position.set(0, 1.36, 0.7); g.add(pl);
  const pl2 = new THREE.PointLight(0xfbbf24, 0.8, 2); pl2.position.set(0, 1.78, 0.3); g.add(pl2);

  g.userData.emissiveMats = [screen, marquee, trim];
  return g;
}

function buildChest() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a2210, roughness: 0.88, metalness: 0 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x3a1607, roughness: 0.92, metalness: 0 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.15, metalness: 1, emissive: 0xb45309, emissiveIntensity: 0.35 });
  const goldDark = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.3, metalness: 1 });
  const inner = new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xf59e0b, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.9 });
  const gem = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 1.4, roughness: 0.1, metalness: 0.5 });
  const gemR = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.4, roughness: 0.1, metalness: 0.5 });
  const gemG = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.4, roughness: 0.1, metalness: 0.5 });

  // Body — beveled box with plank seams
  g.add(mesh(bevelBox(1.0, 0.5, 0.66, 0.018), wood, 0, 0.25, 0));
  // Plank seams
  [-0.3, 0, 0.3].forEach((x) => {
    g.add(mesh(new THREE.BoxGeometry(0.005, 0.46, 0.665), woodDark, x, 0.25, 0));
  });
  // Bottom skirting
  g.add(mesh(bevelBox(1.04, 0.08, 0.7, 0.015), woodDark, 0, 0.04, 0));

  // Lid — curved top using lathe
  const lid = new THREE.Group();
  const lidPts = [[0, 0], [0.48, 0], [0.5, 0.04], [0.42, 0.22], [0.0, 0.32]];
  const lidGeo = new THREE.LatheGeometry(lidPts.map(([r, y]) => new THREE.Vector2(r, y)), 24, 0, Math.PI);
  const lidMesh = new THREE.Mesh(lidGeo, wood);
  lidMesh.rotation.z = -Math.PI / 2;
  lid.add(lidMesh);
  // Cap ends of lid
  lid.add(mesh(new THREE.CircleGeometry(0.32, 16, 0, Math.PI), wood, 0.5, 0.0, 0, 0, Math.PI / 2, 0));
  lid.add(mesh(new THREE.CircleGeometry(0.32, 16, 0, Math.PI), wood, -0.5, 0.0, 0, 0, -Math.PI / 2, 0));
  // Gold bands around lid
  [-0.32, 0, 0.32].forEach((x) => {
    lid.add(mesh(new THREE.TorusGeometry(0.32, 0.015, 8, 24, Math.PI), gold, x, 0, 0));
  });
  // Center lock plate
  lid.add(mesh(bevelBox(0.18, 0.16, 0.03, 0.008), gold, 0, -0.1, 0.32));
  lid.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 12), goldDark, 0, -0.1, 0.34, Math.PI / 2, 0, 0));
  lid.position.set(0, 0.5, 0); lid.rotation.x = -0.5;
  g.add(lid);

  // Corner reinforcements (gold) — 4 vertical bands
  [-0.5, 0.5].forEach((x) => {
    [-0.33, 0.33].forEach((z) => {
      g.add(mesh(bevelBox(0.04, 0.48, 0.04, 0.008), gold, x, 0.25, z));
    });
  });
  // Horizontal gold bands
  g.add(mesh(bevelBox(1.06, 0.04, 0.005, 0.005), gold, 0, 0.46, 0.331));
  g.add(mesh(bevelBox(1.06, 0.04, 0.005, 0.005), gold, 0, 0.46, -0.331));
  g.add(mesh(bevelBox(0.005, 0.04, 0.7, 0.005), gold, 0.501, 0.46, 0));
  g.add(mesh(bevelBox(0.005, 0.04, 0.7, 0.005), gold, -0.501, 0.46, 0));
  // Lock front
  g.add(mesh(bevelBox(0.22, 0.16, 0.02, 0.008), gold, 0, 0.42, 0.34));
  g.add(mesh(new THREE.TorusGeometry(0.03, 0.012, 8, 16), goldDark, 0, 0.46, 0.35, Math.PI / 2, 0, 0));

  // Overflowing treasure — varied gold + gems
  const treasures = [
    { type: 'coin', x: 0.18, y: 0.42, z: 0.05, r: 0.06 },
    { type: 'coin', x: -0.15, y: 0.4,  z: -0.08, r: 0.05 },
    { type: 'coin', x: 0.05, y: 0.48, z: 0.18,  r: 0.055 },
    { type: 'coin', x: 0.25, y: 0.46, z: -0.1,  r: 0.045 },
    { type: 'coin', x: -0.28, y: 0.42, z: 0.12, r: 0.05 },
    { type: 'coin', x: 0,    y: 0.52, z: -0.05, r: 0.05 },
    { type: 'gem',  x: 0.12, y: 0.5,  z: 0.0,   mat: gem,   r: 0.07 },
    { type: 'gem',  x: -0.05,y: 0.55, z: 0.1,   mat: gemR,  r: 0.06 },
    { type: 'gem',  x: 0.2,  y: 0.5,  z: 0.2,   mat: gemG,  r: 0.05 },
  ];
  treasures.forEach((t) => {
    if (t.type === 'coin') {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, 0.018, 18), inner);
      c.position.set(t.x, t.y, t.z);
      c.rotation.set(Math.random() * 0.6 - 0.3, Math.random() * Math.PI, Math.random() * 0.6 - 0.3);
      g.add(c);
    } else {
      const j = new THREE.Mesh(new THREE.OctahedronGeometry(t.r, 0), t.mat);
      j.position.set(t.x, t.y, t.z);
      j.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      g.add(j);
    }
  });

  const pl = new THREE.PointLight(0xfbbf24, 1.6, 3); pl.position.set(0, 0.55, 0.1); g.add(pl);
  g.userData.emissiveMats = [inner, gem, gemR, gemG];
  return g;
}

function buildLavaLamp() {
  const g = new THREE.Group();
  const base = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.4, metalness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xfde68a, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.1 });
  const lava = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf97316, emissiveIntensity: 1.6, roughness: 0.4 });
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.18, 16), base, 0, 0.09, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.06, 16), base, 0, 0.21, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.9, 20), glass, 0, 0.7, 0));
  g.add(mesh(new THREE.SphereGeometry(0.16, 16, 16, 0, Math.PI*2, 0, Math.PI/2), base, 0, 1.15, 0));
  const blobs = [];
  [[0,0.4,0,0.09],[0.05,0.65,0,0.07],[-0.04,0.85,0,0.08],[0.02,1.0,0,0.06]].forEach(([x,y,z,r]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), lava);
    b.position.set(x, y, z); g.add(b); blobs.push({ mesh: b, baseY: y, phase: Math.random() * Math.PI * 2 });
  });
  const pl = new THREE.PointLight(0xf97316, 1.4, 3); pl.position.set(0, 0.7, 0); g.add(pl);
  g.userData.lavaBlobs = blobs;
  g.userData.emissiveMats = [lava];
  return g;
}

// ── Wall partition builders (sub-room dividers) ─────────────────────────────

function buildWallMaterials() {
  return {
    wall: new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.85, metalness: 0.05 }),
    base: new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 0.45, metalness: 0.4 }),
    cap: new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.5, metalness: 0.3 }),
  };
}

function buildWallStraight() {
  const g = new THREE.Group();
  const m = buildWallMaterials();
  // 4u long, 3u tall, 0.18 thick
  g.add(mesh(new THREE.BoxGeometry(4, 2.7, 0.18), m.wall, 0, 1.5, 0));
  g.add(mesh(new THREE.BoxGeometry(4.1, 0.16, 0.22), m.base, 0, 0.08, 0));
  g.add(mesh(new THREE.BoxGeometry(4.1, 0.04, 0.22), m.cap, 0, 2.88, 0));
  return g;
}

function buildWallCorner() {
  const g = new THREE.Group();
  const m = buildWallMaterials();
  // L-shape: 3u arm along +x, 3u arm along +z
  g.add(mesh(new THREE.BoxGeometry(3, 2.7, 0.18), m.wall, 1.5, 1.5, 0));
  g.add(mesh(new THREE.BoxGeometry(3.1, 0.16, 0.22), m.base, 1.5, 0.08, 0));
  g.add(mesh(new THREE.BoxGeometry(3.1, 0.04, 0.22), m.cap, 1.5, 2.88, 0));
  g.add(mesh(new THREE.BoxGeometry(0.18, 2.7, 3), m.wall, 0, 1.5, 1.5));
  g.add(mesh(new THREE.BoxGeometry(0.22, 0.16, 3.1), m.base, 0, 0.08, 1.5));
  g.add(mesh(new THREE.BoxGeometry(0.22, 0.04, 3.1), m.cap, 0, 2.88, 1.5));
  return g;
}

function buildWallDoorway() {
  const g = new THREE.Group();
  const m = buildWallMaterials();
  // Two side panels + lintel; 4u total, doorway is 1.4u wide
  g.add(mesh(new THREE.BoxGeometry(1.3, 2.7, 0.18), m.wall, -1.35, 1.5, 0));
  g.add(mesh(new THREE.BoxGeometry(1.3, 2.7, 0.18), m.wall,  1.35, 1.5, 0));
  g.add(mesh(new THREE.BoxGeometry(4, 0.6, 0.18), m.wall, 0, 2.55, 0));
  // Side bases only (clear the doorway)
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.16, 0.22), m.base, -1.35, 0.08, 0));
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.16, 0.22), m.base,  1.35, 0.08, 0));
  g.add(mesh(new THREE.BoxGeometry(4.1, 0.04, 0.22), m.cap, 0, 2.88, 0));
  return g;
}

const SHOP_FURNITURE = [
  { id: 'plant',     label: 'Potted Plant',    desc: 'Cozy green vibes',           cost: 800,    builder: buildPlant,         scale: 1.6, icon: 'Leaf' },
  { id: 'wall_straight', label: 'Wall (Straight)', desc: 'Sub-room divider, 4u long',  cost: 1500,   builder: buildWallStraight,  scale: 1.0, icon: 'Minus' },
  { id: 'wall_corner',   label: 'Wall (Corner)',   desc: 'L-shape partition',          cost: 2400,   builder: buildWallCorner,    scale: 1.0, icon: 'CornerDownRight' },
  { id: 'wall_doorway',  label: 'Wall (Doorway)',  desc: 'Wall with arched opening',   cost: 3200,   builder: buildWallDoorway,   scale: 1.0, icon: 'DoorOpen' },
  { id: 'neon_sign', label: 'Neon Sign',       desc: 'Glowing $COIN signage',      cost: 2500,   builder: buildNeonSign,      scale: 1.4, icon: 'Zap' },
  { id: 'lava',      label: 'Lava Lamp',       desc: 'Hypnotic blob action',       cost: 8000,   builder: buildLavaLamp,      scale: 1.7, icon: 'Flame' },
  { id: 'arcade',    label: 'Arcade Cabinet',  desc: 'Pixel paradise',             cost: 25000,  builder: buildArcade,        scale: 1.7, icon: 'Gamepad2' },
  { id: 'chest',     label: 'Treasure Chest',  desc: 'Overflowing with gold',      cost: 80000,  builder: buildChest,         scale: 1.5, icon: 'Box' },
  { id: 'disco',     label: 'Disco Ball',      desc: 'Bring the party',            cost: 250000, builder: buildDiscoBall,     scale: 1.6, icon: 'Sparkles' },
];

const ROOM_TIERS = [
  { size: 22, cost: 0,       label: 'Starter Den' },
  { size: 30, cost: 75000,   label: 'Loft' },
  { size: 40, cost: 400000,  label: 'Penthouse' },
  { size: 50, cost: 2000000, label: 'Mansion' },
  { size: 64, cost: 10000000,label: 'Skyhall' },
];

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
  const [tooltip, setTooltip] = useState(null);
  const [ambientColor, setAmbientColor] = useState(() => localStorage.getItem(`cg-room-ambient-${coinId}`) || '#22c55e');
  const [bucketToast, setBucketToast] = useState(null);
  const bucketCallbackRef = useRef(null);

  const [roomCoins, setRoomCoins] = useState(() => parseFloat(localStorage.getItem(`cg-rc-${coinId}`) || '0'));
  const [upgradesPurchased, setUpgradesPurchased] = useState(() => JSON.parse(localStorage.getItem(`cg-ru-${coinId}`) || '{}'));
  const [shopOwned, setShopOwned] = useState(() => JSON.parse(localStorage.getItem(`cg-shop-${coinId}`) || '{}'));
  const [homeOwned, setHomeOwned] = useState(() => JSON.parse(localStorage.getItem(`cg-home-${coinId}`) || '{}'));
  const [roomSize, setRoomSize] = useState(() => parseInt(localStorage.getItem(`cg-room-size-${coinId}`) || '22', 10));
  const [buildMode, setBuildMode] = useState(false);
  const [walls, setWalls] = useState(() => JSON.parse(localStorage.getItem(`cg-walls-${coinId}`) || '[]'));
  const [wallView, setWallView] = useState('up'); // 'up' | 'cut' | 'down'
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

  function buyShopItem(itemId) {
    if (!isOwner) return;
    if (shopOwned[itemId]) return;
    const item = SHOP_FURNITURE.find((i) => i.id === itemId);
    if (!item) return;
    if (roomCoins < item.cost) return;
    setRoomCoins((c) => c - item.cost);
    setShopOwned((o) => ({ ...o, [itemId]: true }));
  }

  function buyHomeItem(name) {
    if (!isOwner) return;
    if (homeOwned[name]) return;
    const item = findHomeModel(name);
    if (!item) return;
    if (roomCoins < item.price) return;
    setRoomCoins((c) => c - item.price);
    setHomeOwned((o) => ({ ...o, [name]: true }));
  }

  function removeShopItem(itemId) {
    if (!isOwner) return;
    if (!shopOwned[itemId]) return;
    const item = SHOP_FURNITURE.find((i) => i.id === itemId);
    if (!item) return;
    setRoomCoins((c) => c + Math.floor(item.cost * 0.5));
    setShopOwned((o) => { const n = { ...o }; delete n[itemId]; return n; });
    // Clear saved position
    const STATIC_KEY = sceneRef.current?.STATIC_KEY;
    if (STATIC_KEY) {
      const cur = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');
      delete cur[`static_shop_${itemId}`];
      localStorage.setItem(STATIC_KEY, JSON.stringify(cur));
    }
  }

  function removeHomeItem(name) {
    if (!isOwner) return;
    if (!homeOwned[name]) return;
    const item = findHomeModel(name);
    if (!item) return;
    setRoomCoins((c) => c + Math.floor(item.price * 0.5));
    setHomeOwned((o) => { const n = { ...o }; delete n[name]; return n; });
    const STATIC_KEY = sceneRef.current?.STATIC_KEY;
    if (STATIC_KEY) {
      const cur = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');
      delete cur[`static_home_${name}`];
      localStorage.setItem(STATIC_KEY, JSON.stringify(cur));
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
  useEffect(() => { localStorage.setItem(`cg-shop-${coinId}`, JSON.stringify(shopOwned)); }, [shopOwned, coinId]);
  useEffect(() => { localStorage.setItem(`cg-home-${coinId}`, JSON.stringify(homeOwned)); }, [homeOwned, coinId]);
  useEffect(() => { localStorage.setItem(`cg-room-size-${coinId}`, String(roomSize)); }, [roomSize, coinId]);
  useEffect(() => { localStorage.setItem(`cg-walls-${coinId}`, JSON.stringify(walls)); }, [walls, coinId]);

  function addWall(w) { setWalls((prev) => [...prev, w]); }
  function deleteWall(id) { setWalls((prev) => prev.filter((w) => w.id !== id)); }
  function clearAllWalls() {
    if (!isOwner) return;
    setWalls([]);
  }

  function buyRoomExpansion(targetSize) {
    if (!isOwner) return;
    const tier = ROOM_TIERS.find((t) => t.size === targetSize);
    if (!tier) return;
    if (roomSize >= targetSize) return;
    if (roomCoins < tier.cost) return;
    setRoomCoins((c) => c - tier.cost);
    setRoomSize(targetSize);
  }

  // Sync home-pack owned items into scene as static (async OBJ load, draggable)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const { scene, staticMap, STATIC_KEY } = ref;
    const savedStatic = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');
    const defaults = [[-4, 4], [4, 4], [-5, 0], [5, 0], [-4, -4], [4, -4], [0, 5], [0, -5]];
    let slot = 0;

    // Remove items that are no longer owned
    Object.keys(staticMap).forEach((id) => {
      if (!id.startsWith('static_home_')) return;
      const name = id.slice('static_home_'.length);
      if (!homeOwned[name]) {
        scene.remove(staticMap[id]);
        delete staticMap[id];
      }
    });

    // Add newly-owned items (async)
    Object.keys(homeOwned).forEach((name) => {
      const sid = `static_home_${name}`;
      if (staticMap[sid]) return;
      // Placeholder to prevent double-loads while async resolves
      staticMap[sid] = 'loading';
      const [dx, dz] = defaults[slot % defaults.length];
      slot++;
      loadHomeModel(name).then((group) => {
        if (!sceneRef.current || sceneRef.current.scene !== scene) return;
        // Cancelled if no longer owned by the time it loads
        if (!homeOwned[name]) { delete staticMap[sid]; return; }
        group.userData.furnitureId = sid;
        group.traverse((c) => { c.userData.furnitureId = sid; });
        const saved = savedStatic[sid];
        group.position.set(saved ? saved.x : dx, saved?.y != null ? saved.y : 0, saved ? saved.z : dz);
        if (saved?.ry != null) group.rotation.y = saved.ry;
        scene.add(group);
        staticMap[sid] = group;
      }).catch(() => { delete staticMap[sid]; });
    });
  }, [homeOwned]);

  // Sync shop-owned furniture into scene as static (draggable, persisted via STATIC_KEY)
  useEffect(() => {
    const ref = sceneRef.current;
    if (!ref) return;
    const { scene, staticMap, STATIC_KEY } = ref;
    const savedStatic = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');
    const defaults = [[-6, 6], [6, 6], [-7, 1], [7, 1], [-6, -3], [6, -3]];
    let slot = 0;
    SHOP_FURNITURE.forEach((item) => {
      const sid = `static_shop_${item.id}`;
      if (!shopOwned[item.id]) {
        if (staticMap[sid]) { scene.remove(staticMap[sid]); delete staticMap[sid]; }
        return;
      }
      if (staticMap[sid]) return;
      const group = item.builder();
      group.scale.setScalar(item.scale || 1.5);
      group.userData.furnitureId = sid;
      group.traverse((c) => { c.userData.furnitureId = sid; });
      const saved = savedStatic[sid];
      const [dx, dz] = defaults[slot % defaults.length];
      group.position.set(saved ? saved.x : dx, 0, saved ? saved.z : dz);
      if (saved?.ry != null) group.rotation.y = saved.ry;
      scene.add(group);
      staticMap[sid] = group;
      slot++;
    });
  }, [shopOwned]);

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
    ROOM.w = roomSize;
    ROOM.d = roomSize;
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

    // ── Room shell ────────────────────────────────────────────────────────────
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2d5a2d, roughness: 0.88, metalness: 0.05, side: THREE.BackSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(ROOM.w, ROOM.h, ROOM.d), wallMat);
    room.position.y = ROOM.h / 2;
    scene.add(room);

    // Floor
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a301a, roughness: 0.7, metalness: 0.2 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.005;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor grid (toggle with H)
    const gridHelper = new THREE.GridHelper(ROOM.w, ROOM.w, 0x0d2b0d, 0x0a1a0a);
    scene.add(gridHelper);

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
      group.position.set(saved ? saved.x : defaultX, saved?.y != null ? saved.y : 0, saved ? saved.z : defaultZ);
      if (saved?.ry != null) group.rotation.y = saved.ry;
    }

    // ── Player avatar (animated Alien.fbx) with WASD controls ────────────────
    const player = new THREE.Group();
    player.position.set(0, 0, 4);
    scene.add(player);
    let playerMixer = null;
    let playerActions = [];
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
        player.add(g);
        if (g.animations && g.animations.length > 0) {
          console.log('[Alien] animation clips:', g.animations.map((a) => a.name));
          playerMixer = new THREE.AnimationMixer(g);
          playerActions = g.animations.map((clip) => playerMixer.clipAction(clip));
          const pickByHint = (hints) => playerActions.find((a) => hints.some((h) => a.getClip().name.toLowerCase().includes(h)));
          const idle = pickByHint(['idle', 'stand', 'breath']) || playerActions[0];
          const walk = pickByHint(['walk', 'run', 'move']) || playerActions[1] || playerActions[0];
          playerActions.forEach((a) => { a.enabled = true; a.setEffectiveWeight(a === idle ? 1 : 0); a.play(); });
          playerMixer.userData = { idle, walk };
        }
      });
    }

    // ── Realtime: broadcast our pose & render other visitors ────────────────
    const remotePlayers = new Map(); // userId → { group, target, label }
    let supaChannel = null;
    let myId = null;
    let myName = 'Visitor';

    function makeRemotePlayer(name, colorSeed) {
      const g = new THREE.Group();
      const hue = ((colorSeed >>> 0) % 360) / 360;
      const bodyColor = new THREE.Color().setHSL(hue, 0.6, 0.55);
      const emissive = new THREE.Color().setHSL(hue, 0.7, 0.35);
      const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, emissive, emissiveIntensity: 0.4, roughness: 0.45, metalness: 0.3 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.4, 6, 12), bodyMat);
      body.position.y = 1.2;
      body.castShadow = true;
      g.add(body);
      // facing indicator (small nub)
      const nub = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshStandardMaterial({ color: 0x0c1a0c }));
      nub.position.set(0, 1.6, 0.4);
      g.add(nub);
      // name sprite
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
      sprite.position.y = 3.1;
      g.add(sprite);
      return { group: g, target: { x: 0, z: 4, yaw: 0 } };
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
          rp = makeRemotePlayer(payload.name || 'Visitor', seed * 47);
          rp.group.position.set(payload.x, 0, payload.z);
          rp.group.rotation.y = payload.yaw;
          scene.add(rp.group);
          remotePlayers.set(payload.id, rp);
        }
        rp.target.x = payload.x;
        rp.target.z = payload.z;
        rp.target.yaw = payload.yaw;
      });

      supaChannel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        (leftPresences || []).forEach((p) => {
          const id = p.id || p.key;
          const rp = remotePlayers.get(id);
          if (rp) { scene.remove(rp.group); remotePlayers.delete(id); }
        });
      });

      supaChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await supaChannel.track({ id: myId, name: myName });
        }
      });
    })();

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

    // ── Home-pack owned (async loaded at init from localStorage) ─────────────
    const initialHome = JSON.parse(localStorage.getItem(`cg-home-${coinId}`) || '{}');
    const homeDefaults = [[-4, 4], [4, 4], [-5, 0], [5, 0], [-4, -4], [4, -4], [0, 5], [0, -5]];
    let homeSlot = 0;
    Object.keys(initialHome).forEach((name) => {
      const sid = `static_home_${name}`;
      const [dx, dz] = homeDefaults[homeSlot % homeDefaults.length];
      homeSlot++;
      loadHomeModel(name).then((group) => {
        if (!sceneRef.current || sceneRef.current.scene !== scene) return;
        tagStatic(group, sid);
        placeStatic(group, dx, dz);
        scene.add(group);
        if (sceneRef.current?.staticMap) sceneRef.current.staticMap[sid] = group;
      }).catch(() => {});
    });

    // ── Shop-owned furniture (loaded at init from localStorage) ──────────────
    const initialShop = JSON.parse(localStorage.getItem(`cg-shop-${coinId}`) || '{}');
    const shopDefaults = [[-6, 6], [6, 6], [-7, 1], [7, 1], [-6, -3], [6, -3]];
    const initialShopGroups = {};
    let shopSlot = 0;
    SHOP_FURNITURE.forEach((item) => {
      if (!initialShop[item.id]) return;
      const sid = `static_shop_${item.id}`;
      const group = item.builder();
      group.scale.setScalar(item.scale || 1.5);
      tagStatic(group, sid);
      const [dx, dz] = shopDefaults[shopSlot % shopDefaults.length];
      placeStatic(group, dx, dz);
      scene.add(group);
      initialShopGroups[sid] = group;
      shopSlot++;
    });

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
    const staticMap = { fc_cube: bucket, ...initialShopGroups };
    sceneRef.current = {
      scene, furnitureMap, staticMap, isOwner, nameCanvas, nameCtx, nameTex, STATIC_KEY,
      lights: { hemi, ceil: ceilLight, fills: fillLights }, wallMat, floorMat, bucket,
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
        const hw = ROOM.w / 2 - 1.2;
        const hd = ROOM.d / 2 - 1.2;
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
            localStorage.setItem(STATIC_KEY, JSON.stringify(cur));
          }
          dragging = null;
          return;
        }

        if (!dragging.moved) {
          // Treat as select — keep position, target for arrow-key Y nudges
          selected = { id, group, isStatic };
          group.position.set(dragging.startX, dragging.startY, dragging.startZ);
          dragging = null;
          return;
        }
        group.position.y = dragging.startY;
        if (isStatic) {
          const cur = JSON.parse(localStorage.getItem(STATIC_KEY) || '{}');
          cur[id] = { x, y: parseFloat(group.position.y.toFixed(3)), z, ry: parseFloat(group.rotation.y.toFixed(4)) };
          localStorage.setItem(STATIC_KEY, JSON.stringify(cur));
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
    const onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (k in keyState) keyState[k] = false;
    };
    window.addEventListener('keyup', onKeyUp);
    const onKeyDown = (e) => {
      const lk = e.key.toLowerCase();
      if (lk in keyState) { keyState[lk] = true; }
      if (lk === 'h') { gridHelper.visible = !gridHelper.visible; }
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
          localStorage.setItem(STATIC_KEY, JSON.stringify(cur));
        }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && sceneRef.current?.isOwner) {
        const { id } = selected;
        if (id === 'fc_cube') return;
        if (id.startsWith('static_shop_')) {
          sceneRef.current?.removeShopItem?.(id.slice('static_shop_'.length));
          selected = null;
          e.preventDefault();
        } else if (id.startsWith('static_home_')) {
          sceneRef.current?.removeHomeItem?.(id.slice('static_home_'.length));
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
        const hw = ROOM.w / 2 - 0.8;
        const hd = ROOM.d / 2 - 0.8;

        // Build collider list this frame
        const colliders = [];
        wallGroup.children.forEach((c) => { if (c.userData.wallId) colliders.push(new THREE.Box3().setFromObject(c)); });
        Object.entries(staticMap).forEach(([id, g]) => {
          if (id === 'fc_cube') return;
          if (g && g.isObject3D) colliders.push(new THREE.Box3().setFromObject(g));
        });
        Object.values(furnitureMap).forEach((f) => { if (f?.group?.isObject3D) colliders.push(new THREE.Box3().setFromObject(f.group)); });

        const pr = 0.45;
        const testBox = new THREE.Box3();
        const blockedAt = (x, z) => {
          testBox.min.set(x - pr, 0.15, z - pr);
          testBox.max.set(x + pr, 1.4, z + pr);
          for (const b of colliders) if (b.intersectsBox(testBox)) return true;
          return false;
        };

        let nx = Math.max(-hw, Math.min(hw, player.position.x + wx * moveSpeed));
        let nz = Math.max(-hd, Math.min(hd, player.position.z + wz * moveSpeed));
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
      remotePlayers.forEach((rp) => {
        rp.group.position.x += (rp.target.x - rp.group.position.x) * rLerp;
        rp.group.position.z += (rp.target.z - rp.group.position.z) * rLerp;
        let dy2 = rp.target.yaw - rp.group.rotation.y;
        while (dy2 > Math.PI) dy2 -= Math.PI * 2;
        while (dy2 < -Math.PI) dy2 += Math.PI * 2;
        rp.group.rotation.y += dy2 * rLerp;
      });

      if (playerMixer?.userData) {
        const { idle, walk } = playerMixer.userData;
        if (idle && walk && idle !== walk) {
          const target = moving ? 1 : 0;
          const cur = walk.getEffectiveWeight();
          const next = cur + (target - cur) * Math.min(1, dt * 8);
          walk.setEffectiveWeight(next);
          idle.setEffectiveWeight(1 - next);
        }
      }

      const px2 = player.position.x;
      const pz2 = player.position.z;
      camera.position.set(
        px2 + Math.sin(theta) * Math.cos(phi) * tRad,
        Math.sin(phi) * tRad + 1,
        pz2 + Math.cos(theta) * Math.cos(phi) * tRad
      );
      camera.lookAt(px2, 1.5, pz2);

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
      bulb.material.emissiveIntensity = 1.8 + Math.sin(t * (isHypePumping ? 3.0 : 1.4)) * 0.5;

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

      // animate shop furniture
      Object.entries(staticMap).forEach(([id, group]) => {
        if (!id.startsWith('static_shop_')) return;
        if (group.userData.spinBall) {
          group.userData.spinBall.rotation.y = t * 1.2;
          group.userData.spinBall.rotation.x = t * 0.4;
        }
        if (group.userData.discoLights) {
          group.userData.discoLights.forEach((pl, i) => {
            pl.intensity = 1.4 + Math.sin(t * 2.2 + i * 1.5) * 0.8;
          });
        }
        if (group.userData.lavaBlobs) {
          group.userData.lavaBlobs.forEach((b) => {
            b.mesh.position.y = b.baseY + Math.sin(t * 0.8 + b.phase) * 0.18;
            b.mesh.scale.y = 1 + Math.sin(t * 1.2 + b.phase) * 0.15;
          });
        }
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
    sceneRef.current.removeShopItem = removeShopItem;
    sceneRef.current.removeHomeItem = removeHomeItem;
    sceneRef.current.addWall = addWall;
    sceneRef.current.deleteWall = deleteWall;
    sceneRef.current.buildMode = buildMode;
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
    ref.wallMat.color.set(new THREE.Color(ambientColor).multiplyScalar(0.22));
    ref.floorMat.color.set(new THREE.Color(ambientColor).multiplyScalar(0.16));

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
              <div style={{ position: 'absolute', top: 116, right: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, pointerEvents: 'all', zIndex: 2 }}>
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

          {/* Wall view cycle (Sims-style) */}
          <button
            type="button"
            onClick={() => setWallView((v) => v === 'up' ? 'cut' : v === 'cut' ? 'down' : 'up')}
            style={{
              position: 'absolute', top: isOwner ? 220 : 116, right: 16, zIndex: 2, pointerEvents: 'all',
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

              {/* Room expansion */}
              <div style={{ color: '#4b5563', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16, marginBottom: 10 }}>Room Tier</div>
              {ROOM_TIERS.map((tier) => {
                const isCurrent = roomSize === tier.size;
                const isUnlocked = roomSize >= tier.size;
                const canAfford = roomCoins >= tier.cost;
                const canBuy = isOwner && !isUnlocked && canAfford;
                return (
                  <div
                    key={tier.size}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: isCurrent ? '#0d1a0d' : '#161616', borderRadius: 7, border: `1px solid ${isCurrent ? '#22c55e' : isUnlocked ? '#1a3a1a' : (canAfford ? '#1a3a1a' : '#111')}`, marginBottom: 6, opacity: isUnlocked || canAfford ? 1 : 0.55 }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: isCurrent ? '#22c55e' : '#e2e8f0', fontSize: 11, fontWeight: 700 }}>
                        {tier.label}
                        {isCurrent && <span style={{ color: '#4ade80', fontSize: 9, marginLeft: 6, fontWeight: 800 }}>CURRENT</span>}
                      </div>
                      <div style={{ color: '#4b5563', fontSize: 9, marginTop: 2 }}>{tier.size} × {tier.size} units</div>
                    </div>
                    {isUnlocked ? (
                      <LucideIcons.Check size={14} color="#22c55e" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => buyRoomExpansion(tier.size)}
                        disabled={!canBuy}
                        style={{
                          background: canBuy ? '#22c55e' : '#1a2e1a',
                          color: canBuy ? '#000' : '#374151',
                          border: 'none', borderRadius: 5, fontSize: 9, fontWeight: 800,
                          fontFamily: 'inherit', padding: '5px 9px',
                          cursor: canBuy ? 'pointer' : 'default',
                          whiteSpace: 'nowrap', flexShrink: 0,
                        }}
                      >
                        {tier.cost.toLocaleString()} RC
                      </button>
                    )}
                  </div>
                );
              })}
              <div style={{ marginTop: 6, padding: '8px 10px', background: '#0f0f0f', borderRadius: 6, border: '1px solid #1a2e1a', color: '#374151', fontSize: 9, lineHeight: 1.6 }}>
                Bigger rooms = more space for furniture and sub-room walls. Existing items stay in place.
              </div>
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
              <div style={{ color: '#4b5563', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 16, marginBottom: 10 }}>Furniture Shop</div>
              {SHOP_FURNITURE.map((item) => {
                const Icon = LucideIcons[item.icon] ?? LucideIcons.Box;
                const owned = !!shopOwned[item.id];
                const canAfford = roomCoins >= item.cost;
                const disabled = owned || !canAfford || !isOwner;
                return (
                  <div
                    key={item.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: owned ? '#0d1a0d' : '#161616', borderRadius: 7, border: `1px solid ${owned ? '#1a3a1a' : canAfford ? '#1a3a1a' : '#111'}`, marginBottom: 6, opacity: owned ? 1 : (canAfford ? 1 : 0.55) }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: owned ? '#22c55e22' : '#0f0f0f', border: `1px solid ${owned ? '#22c55e' : '#1f2937'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={13} color={owned ? '#22c55e' : '#4b5563'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 700 }}>{item.label}</div>
                      <div style={{ color: '#4b5563', fontSize: 9, marginTop: 2 }}>{item.desc}</div>
                    </div>
                    {owned ? (
                      <button
                        type="button"
                        onClick={() => removeShopItem(item.id)}
                        disabled={!isOwner}
                        title={`Refund ${Math.floor(item.cost * 0.5).toLocaleString()} RC`}
                        style={{
                          background: '#1a0d0d', border: '1px solid #3a1a1a', borderRadius: 5,
                          color: '#ef4444', fontSize: 9, fontWeight: 800, fontFamily: 'inherit',
                          padding: '5px 9px', cursor: isOwner ? 'pointer' : 'default',
                          whiteSpace: 'nowrap', flexShrink: 0,
                        }}
                      >
                        REMOVE
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => buyShopItem(item.id)}
                        disabled={disabled}
                        style={{
                          background: canAfford ? '#22c55e' : '#1a2e1a',
                          border: 'none', borderRadius: 5,
                          color: canAfford ? '#000' : '#374151',
                          fontSize: 9, fontWeight: 800, fontFamily: 'inherit',
                          padding: '5px 9px', cursor: disabled ? 'default' : 'pointer',
                          whiteSpace: 'nowrap', flexShrink: 0,
                        }}
                      >
                        {item.cost.toLocaleString()} RC
                      </button>
                    )}
                  </div>
                );
              })}

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
                    const owned = !!homeOwned[it.name];
                    const canAfford = roomCoins >= it.price;
                    const disabled = owned || !canAfford || !isOwner;
                    return (
                      <div
                        key={it.name}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, background: owned ? '#0d1a0d' : '#161616', borderRadius: 6, border: `1px solid ${owned ? '#1a3a1a' : '#1a2e1a'}`, opacity: owned ? 1 : (canAfford ? 1 : 0.6) }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <HomeModelThumb name={it.name} size={64} />
                        </div>
                        <div style={{ color: '#e2e8f0', fontSize: 10, fontWeight: 700, lineHeight: 1.2, minHeight: 24 }}>{it.label}</div>
                        {owned ? (
                          <button
                            type="button"
                            onClick={() => removeHomeItem(it.name)}
                            disabled={!isOwner}
                            title={`Refund ${Math.floor(it.price * 0.5).toLocaleString()} RC`}
                            style={{
                              background: '#1a0d0d', border: '1px solid #3a1a1a', borderRadius: 4,
                              color: '#ef4444', fontSize: 9, fontWeight: 800, fontFamily: 'inherit',
                              padding: '4px 6px', cursor: isOwner ? 'pointer' : 'default',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            REMOVE
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => buyHomeItem(it.name)}
                            disabled={disabled}
                            style={{
                              background: canAfford ? '#22c55e' : '#1a2e1a',
                              color: canAfford ? '#000' : '#374151',
                              border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 800,
                              fontFamily: 'inherit', padding: '4px 6px', cursor: disabled ? 'default' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {it.price.toLocaleString()}
                          </button>
                        )}
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
