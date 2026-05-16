// Sci-Fi Essentials Kit — OBJ pack catalog, loader, thumbnail renderer.
// Models live in /public/models/home/<name>.{obj,mtl} with PBR textures in /Textures.

import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// Names whose materials should glow in the dark — keyed by lowercase prop name.
// Value is { color: hex, intensity: number }.
const EMISSIVE_HINTS = {
  prop_healthpack:      { color: 0x22ff66, intensity: 1.4 },
  prop_healthpack_tube: { color: 0x22ff66, intensity: 1.6 },
  prop_keycard:         { color: 0x4cc9ff, intensity: 1.2 },
  prop_grenade:         { color: 0xff4422, intensity: 0.8 },
  prop_mine:            { color: 0xff2266, intensity: 1.0 },
  prop_satellitedish:   { color: 0x66ccff, intensity: 0.5 },
  prop_syringe:         { color: 0xb066ff, intensity: 1.0 },
  prop_mug:             { color: 0x66ddff, intensity: 0.3 },
};

// ── Catalog ───────────────────────────────────────────────────────────────

export const HOME_PACK = [
  // Furniture — desks, chairs, shelves, lockers
  { name: 'Prop_Chair',            label: 'Crew Chair',         category: 'Furniture', price: 1800 },
  { name: 'Prop_Desk_Small',       label: 'Console (S)',        category: 'Furniture', price: 3200 },
  { name: 'Prop_Desk_Medium',      label: 'Console (M)',        category: 'Furniture', price: 5500 },
  { name: 'Prop_Desk_L',           label: 'Command Console',    category: 'Furniture', price: 12000 },
  { name: 'Prop_Locker',           label: 'Crew Locker',        category: 'Furniture', price: 4500 },
  { name: 'Prop_Shelves_ThinShort',label: 'Thin Shelf (S)',     category: 'Furniture', price: 2200 },
  { name: 'Prop_Shelves_ThinTall', label: 'Thin Shelf (T)',     category: 'Furniture', price: 3000 },
  { name: 'Prop_Shelves_WideShort',label: 'Wide Shelf (S)',     category: 'Furniture', price: 2800 },
  { name: 'Prop_Shelves_WideTall', label: 'Wide Shelf (T)',     category: 'Furniture', price: 3800 },
  { name: 'Prop_Chest',            label: 'Cargo Chest',        category: 'Furniture', price: 8500 },

  // Storage — crates
  { name: 'Prop_Crate',            label: 'Crate',              category: 'Storage',   price: 1200 },
  { name: 'Prop_Crate_Large',      label: 'Large Crate',        category: 'Storage',   price: 2400 },
  { name: 'Prop_Crate_Tarp',       label: 'Tarp Crate',         category: 'Storage',   price: 1600 },
  { name: 'Prop_Crate_Tarp_Large', label: 'Large Tarp Crate',   category: 'Storage',   price: 3200 },

  // Loot — glowy sci-fi gizmos
  { name: 'Prop_HealthPack',       label: 'Med Pack',           category: 'Loot',      price: 900 },
  { name: 'Prop_HealthPack_Tube',  label: 'Stim Tube',          category: 'Loot',      price: 600 },
  { name: 'Prop_KeyCard',          label: 'Key Card',           category: 'Loot',      price: 1500 },
  { name: 'Prop_Grenade',          label: 'Grenade',            category: 'Loot',      price: 1200 },
  { name: 'Prop_Mine',             label: 'Proximity Mine',     category: 'Loot',      price: 1800 },
  { name: 'Prop_Syringe',          label: 'Syringe',            category: 'Loot',      price: 700 },
  { name: 'Prop_Mug',              label: 'Crew Mug',           category: 'Loot',      price: 400 },

  // Exterior
  { name: 'Prop_SatelliteDish',    label: 'Satellite Dish',     category: 'Exterior',  price: 18000 },
];

export const HOME_PACK_CATEGORIES = ['All', ...Array.from(new Set(HOME_PACK.map((m) => m.category)))];

const BY_NAME = new Map(HOME_PACK.map((m) => [m.name, m]));
export const findHomeModel = (name) => BY_NAME.get(name);

// ── Loader (cached) ───────────────────────────────────────────────────────

const loadCache = new Map(); // name → Promise<Group> (template)
const thumbCache = new Map(); // name → dataURL

const textureLoader = new THREE.TextureLoader();
const emissiveCache = new Map(); // base color filename → emissive THREE.Texture or null

function tryLoadEmissiveFor(baseColorMap) {
  if (!baseColorMap || !baseColorMap.image || !baseColorMap.image.src) return null;
  const src = baseColorMap.image.src;
  // T_*_BaseColor.png → T_*_Emissive.png in same Textures folder
  const m = src.match(/^(.*\/)([^/]*?)_BaseColor\.(png|jpg|jpeg)$/i);
  if (!m) return null;
  const emissiveUrl = `${m[1]}${m[2]}_Emissive.${m[3]}`;
  if (emissiveCache.has(emissiveUrl)) return emissiveCache.get(emissiveUrl);
  const tex = textureLoader.load(
    emissiveUrl,
    undefined,
    undefined,
    () => { emissiveCache.set(emissiveUrl, null); },
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  emissiveCache.set(emissiveUrl, tex);
  return tex;
}

function normalizeModel(group, name) {
  const box = new THREE.Box3().setFromObject(group);
  if (!isFinite(box.min.x)) return group;
  const center = box.getCenter(new THREE.Vector3());
  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= box.min.y;
  const hint = EMISSIVE_HINTS[name.toLowerCase()] || null;
  group.traverse((c) => {
    if (c.isMesh && c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      const newMats = mats.map((m) => {
        if (m.isMeshStandardMaterial) return m;
        const baseColor = m.map || null;
        const normalMap = m.normalMap || m.bumpMap || null;
        const sm = new THREE.MeshStandardMaterial({
          color: baseColor ? new THREE.Color(0xffffff) : (m.color ? m.color.clone() : new THREE.Color(0xcccccc)),
          map: baseColor,
          normalMap,
          roughness: 0.65,
          metalness: 0.25,
          emissive: hint ? new THREE.Color(hint.color) : new THREE.Color(0x000000),
          emissiveIntensity: hint ? hint.intensity : 0,
        });
        if (baseColor && baseColor.colorSpace !== THREE.SRGBColorSpace) {
          baseColor.colorSpace = THREE.SRGBColorSpace;
        }
        if (hint) {
          const emap = tryLoadEmissiveFor(baseColor);
          if (emap) sm.emissiveMap = emap;
        }
        return sm;
      });
      c.material = Array.isArray(c.material) ? newMats : newMats[0];
    }
  });
  group.scale.setScalar(1.5);
  return group;
}

export function loadHomeModel(name) {
  if (!loadCache.has(name)) {
    const promise = new Promise((resolve, reject) => {
      const mtl = new MTLLoader();
      mtl.setPath('/models/home/');
      mtl.load(
        `${name}.mtl`,
        (mats) => {
          mats.preload();
          const obj = new OBJLoader();
          obj.setMaterials(mats);
          obj.setPath('/models/home/');
          obj.load(
            `${name}.obj`,
            (group) => resolve(normalizeModel(group, name)),
            undefined,
            reject,
          );
        },
        undefined,
        reject,
      );
    });
    loadCache.set(name, promise);
  }
  // Return a clone of the cached template so each placement is its own group.
  return loadCache.get(name).then((tpl) => {
    const clone = tpl.clone(true);
    // Clone materials too so per-instance tinting doesn't bleed
    clone.traverse((c) => {
      if (c.isMesh && c.material) {
        c.material = Array.isArray(c.material) ? c.material.map((m) => m.clone()) : c.material.clone();
      }
    });
    return clone;
  });
}

// ── Thumbnail renderer ────────────────────────────────────────────────────
// Renders a model into a small offscreen canvas, returns a dataURL. Cached.

let thumbRenderer = null;
let thumbScene = null;
let thumbCamera = null;
const THUMB_SIZE = 96;

function ensureThumbRig() {
  if (thumbRenderer) return;
  thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  thumbRenderer.setSize(THUMB_SIZE, THUMB_SIZE);
  thumbRenderer.setClearColor(0x0a0a0a, 0);

  thumbScene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x1a2e1a, 1.0);
  thumbScene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 3, 2.5);
  thumbScene.add(key);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
  fill.position.set(-2, 1, -1);
  thumbScene.add(fill);

  thumbCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
}

export async function getHomeModelThumbnail(name) {
  if (thumbCache.has(name)) return thumbCache.get(name);
  ensureThumbRig();
  const model = await loadHomeModel(name);
  thumbScene.add(model);
  // Frame the model
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 2.4;
  thumbCamera.position.set(center.x + dist * 0.7, center.y + dist * 0.6, center.z + dist * 0.9);
  thumbCamera.lookAt(center);
  thumbRenderer.render(thumbScene, thumbCamera);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  thumbScene.remove(model);
  thumbCache.set(name, url);
  return url;
}
