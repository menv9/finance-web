// Quaternius Ultimate Home Interior — OBJ pack catalog, loader, thumbnail renderer.
// Models live in /public/models/home/<name>.{obj,mtl}. Color-only materials.

import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// ── Catalog ───────────────────────────────────────────────────────────────

// All 123 model filenames (sans extension), grouped by category with a price.
// Prices are tiered roughly by item size/utility.
export const HOME_PACK = [
  // Bathroom (big-ticket plumbing)
  { name: 'Bathroom_Bathtub',          label: 'Bathtub',          category: 'Bathroom', price: 35000 },
  { name: 'Bathroom_Shower1',          label: 'Shower',           category: 'Bathroom', price: 28000 },
  { name: 'Bathroom_Sink',             label: 'Bathroom Sink',    category: 'Bathroom', price: 9000 },
  { name: 'Bathroom_Toilet',           label: 'Toilet',           category: 'Bathroom', price: 7000 },
  { name: 'Bathroom_Toilet2',          label: 'Toilet (Modern)',  category: 'Bathroom', price: 8500 },
  { name: 'Bathroom_Mirror1',          label: 'Mirror',           category: 'Bathroom', price: 4000 },
  { name: 'Bathroom_Mirror2',          label: 'Mirror (Round)',   category: 'Bathroom', price: 4500 },
  { name: 'Bathroom_Towel',            label: 'Towel',            category: 'Bathroom', price: 600 },
  { name: 'Bathroom_ToiletPaper',      label: 'Toilet Paper',     category: 'Bathroom', price: 200 },
  { name: 'Bathroom_ToiletPaperPile',  label: 'TP Pile',          category: 'Bathroom', price: 400 },
  { name: 'Bathroom_WashingMachine',   label: 'Washing Machine',  category: 'Bathroom', price: 22000 },

  // Beds
  { name: 'Bed_Bunk',                  label: 'Bunk Bed',         category: 'Beds',     price: 45000 },
  { name: 'Bed_King',                  label: 'King Bed',         category: 'Beds',     price: 60000 },
  { name: 'Bed_Single',                label: 'Single Bed',       category: 'Beds',     price: 25000 },

  // Seating
  { name: 'Chair_1',                   label: 'Wooden Chair',     category: 'Seating',  price: 1400 },
  { name: 'Chair_2',                   label: 'Lounge Chair',     category: 'Seating',  price: 2200 },
  { name: 'Chair_3',                   label: 'Office Chair',     category: 'Seating',  price: 2800 },
  { name: 'Chair_4',                   label: 'Armchair',         category: 'Seating',  price: 3400 },
  { name: 'Stool',                     label: 'Stool',            category: 'Seating',  price: 800 },
  { name: 'Couch_Small1',              label: 'Small Couch',      category: 'Seating',  price: 6500 },
  { name: 'Couch_Small2',              label: 'Loveseat',         category: 'Seating',  price: 7200 },
  { name: 'Couch_Medium1',             label: 'Mid Couch',        category: 'Seating',  price: 9500 },
  { name: 'Couch_Medium2',             label: 'Mid Couch (alt)',  category: 'Seating',  price: 10500 },
  { name: 'Couch_Large1',              label: 'Long Couch',       category: 'Seating',  price: 14000 },
  { name: 'Couch_Large2',              label: 'Sectional',        category: 'Seating',  price: 16000 },
  { name: 'Couch_Large3',              label: 'Lux Sectional',    category: 'Seating',  price: 18500 },
  { name: 'Couch_L',                   label: 'L-Shape Sofa',     category: 'Seating',  price: 22000 },

  // Tables
  { name: 'Table_RoundLarge',          label: 'Round Table (L)',  category: 'Tables',   price: 9500 },
  { name: 'Table_RoundSmall',          label: 'Round Table (S)',  category: 'Tables',   price: 5500 },
  { name: 'Table_RoundSmall2',         label: 'Side Table',       category: 'Tables',   price: 3800 },
  { name: 'NightStand_1',              label: 'Nightstand',       category: 'Tables',   price: 4200 },
  { name: 'NightStand_2',              label: 'Nightstand (alt)', category: 'Tables',   price: 4400 },
  { name: 'NightStand_3',              label: 'Modern Nightstand',category: 'Tables',   price: 5200 },

  // Storage
  { name: 'Bookshelf',                 label: 'Bookshelf',        category: 'Storage',  price: 6500 },
  { name: 'Shelf_1',                   label: 'Tall Shelf',       category: 'Storage',  price: 4500 },
  { name: 'Shelf_2',                   label: 'Wide Shelf',       category: 'Storage',  price: 5000 },
  { name: 'Shelf_Large',               label: 'Large Shelf',      category: 'Storage',  price: 7500 },
  { name: 'Shelf_Small1',              label: 'Small Shelf',      category: 'Storage',  price: 1800 },
  { name: 'Shelf_Small2',              label: 'Small Shelf (alt)',category: 'Storage',  price: 1900 },
  { name: 'Shelf_Small3',              label: 'Wall Shelf',       category: 'Storage',  price: 2100 },
  { name: 'Drawer_1',                  label: 'Dresser',          category: 'Storage',  price: 6000 },
  { name: 'Drawer_2',                  label: 'Dresser (alt)',    category: 'Storage',  price: 6200 },
  { name: 'Drawer_3',                  label: 'Tall Dresser',     category: 'Storage',  price: 8500 },
  { name: 'Drawer_4',                  label: 'Wide Dresser',     category: 'Storage',  price: 9200 },
  { name: 'Drawer_5',                  label: 'Modern Dresser',   category: 'Storage',  price: 10000 },

  // Lighting
  { name: 'Light_Desk',                label: 'Desk Lamp',        category: 'Lighting', price: 1500 },
  { name: 'Light_Small',               label: 'Small Lamp',       category: 'Lighting', price: 1200 },
  { name: 'Light_Cube',                label: 'Cube Light',       category: 'Lighting', price: 2800 },
  { name: 'Light_Cube2',               label: 'Cube Light (alt)', category: 'Lighting', price: 3000 },
  { name: 'Light_Icosahedron',         label: 'Geo Lamp',         category: 'Lighting', price: 6500 },
  { name: 'Light_Icosahedron2',        label: 'Geo Lamp (alt)',   category: 'Lighting', price: 7000 },
  { name: 'Light_Stand1',              label: 'Standing Lamp',    category: 'Lighting', price: 4200 },
  { name: 'Light_Stand2',              label: 'Standing Lamp (alt)',category: 'Lighting', price: 4400 },
  { name: 'Light_Floor1',              label: 'Floor Lamp',       category: 'Lighting', price: 3800 },
  { name: 'Light_Floor2',              label: 'Floor Lamp (alt)', category: 'Lighting', price: 4000 },
  { name: 'Light_Floor3',              label: 'Tall Floor Lamp',  category: 'Lighting', price: 5200 },
  { name: 'Light_Floor4',              label: 'Designer Lamp',    category: 'Lighting', price: 5800 },
  { name: 'Light_Ceiling1',            label: 'Ceiling Light',    category: 'Lighting', price: 3500 },
  { name: 'Light_Ceiling2',            label: 'Ceiling Light (2)',category: 'Lighting', price: 3700 },
  { name: 'Light_Ceiling3',            label: 'Ceiling Light (3)',category: 'Lighting', price: 3900 },
  { name: 'Light_Ceiling4',            label: 'Ceiling Light (4)',category: 'Lighting', price: 4100 },
  { name: 'Light_Ceiling5',            label: 'Ceiling Light (5)',category: 'Lighting', price: 4300 },
  { name: 'Light_Ceiling6',            label: 'Ceiling Light (6)',category: 'Lighting', price: 4500 },
  { name: 'Light_CeilingSingle',       label: 'Pendant',          category: 'Lighting', price: 2800 },
  { name: 'Light_Chandelier',          label: 'Chandelier',       category: 'Lighting', price: 38000 },

  // Plants
  { name: 'Houseplant_1',              label: 'Houseplant',       category: 'Plants',   price: 2000 },
  { name: 'Houseplant_2',              label: 'Houseplant (2)',   category: 'Plants',   price: 2200 },
  { name: 'Houseplant_3',              label: 'Houseplant (3)',   category: 'Plants',   price: 2500 },
  { name: 'Houseplant_4',              label: 'Houseplant (4)',   category: 'Plants',   price: 2800 },
  { name: 'Houseplant_5',              label: 'Houseplant (5)',   category: 'Plants',   price: 3000 },
  { name: 'Houseplant_6',              label: 'Tall Plant',       category: 'Plants',   price: 4500 },
  { name: 'Houseplant_7',              label: 'Tall Plant (2)',   category: 'Plants',   price: 4800 },
  { name: 'Houseplant_8',              label: 'Tall Plant (3)',   category: 'Plants',   price: 5200 },

  // Kitchen
  { name: 'Kitchen_Fridge',            label: 'Fridge',           category: 'Kitchen',  price: 32000 },
  { name: 'Kitchen_Oven',              label: 'Oven',             category: 'Kitchen',  price: 22000 },
  { name: 'Kitchen_Oven_Large',        label: 'Large Oven',       category: 'Kitchen',  price: 28000 },
  { name: 'Kitchen_Sink',              label: 'Kitchen Sink',     category: 'Kitchen',  price: 12000 },
  { name: 'Kitchen_1Drawers',          label: 'Cabinet (1)',      category: 'Kitchen',  price: 5500 },
  { name: 'Kitchen_2Drawers',          label: 'Cabinet (2)',      category: 'Kitchen',  price: 6800 },
  { name: 'Kitchen_3Drawers',          label: 'Cabinet (3)',      category: 'Kitchen',  price: 8000 },
  { name: 'Kitchen_Cabinet1',          label: 'Wall Cabinet',     category: 'Kitchen',  price: 4500 },
  { name: 'Kitchen_Cabinet2',          label: 'Wall Cabinet (2)', category: 'Kitchen',  price: 4700 },
  { name: 'Kitchen_CabinetSmall',      label: 'Small Cabinet',    category: 'Kitchen',  price: 2800 },
  { name: 'Plate_1',                   label: 'Plate',            category: 'Kitchen',  price: 200 },
  { name: 'Plate_2',                   label: 'Plate (2)',        category: 'Kitchen',  price: 220 },
  { name: 'Plate_3',                   label: 'Plate (3)',        category: 'Kitchen',  price: 240 },
  { name: 'Fork',                      label: 'Fork',             category: 'Kitchen',  price: 100 },
  { name: 'Knife',                     label: 'Knife',            category: 'Kitchen',  price: 100 },
  { name: 'Spoon',                     label: 'Spoon',            category: 'Kitchen',  price: 100 },

  // Decor
  { name: 'Fireplace',                 label: 'Fireplace',        category: 'Decor',    price: 24000 },
  { name: 'Carpet_1',                  label: 'Carpet',           category: 'Decor',    price: 3500 },
  { name: 'Carpet_2',                  label: 'Carpet (2)',       category: 'Decor',    price: 3700 },
  { name: 'Carpet_Round',              label: 'Round Carpet',     category: 'Decor',    price: 4200 },
  { name: 'Curtains_Double',           label: 'Curtains',         category: 'Decor',    price: 4500 },
  { name: 'Curtains_Single',           label: 'Single Curtain',   category: 'Decor',    price: 3200 },
  { name: 'Column_Round1',             label: 'Round Column',     category: 'Decor',    price: 6000 },
  { name: 'Column_Round2',             label: 'Round Column (2)', category: 'Decor',    price: 6200 },
  { name: 'Column_Round3',             label: 'Round Column (3)', category: 'Decor',    price: 6500 },
  { name: 'Column_SquareBig',          label: 'Big Square Column',category: 'Decor',    price: 9000 },
  { name: 'Column_SquareSmall',        label: 'Small Square Column',category: 'Decor', price: 5500 },

  // Doors & Windows
  { name: 'Door_1',                    label: 'Door',             category: 'Doors',    price: 3000 },
  { name: 'Door_2',                    label: 'Door (2)',         category: 'Doors',    price: 3100 },
  { name: 'Door_3',                    label: 'Door (3)',         category: 'Doors',    price: 3200 },
  { name: 'Door_4',                    label: 'Door (4)',         category: 'Doors',    price: 3300 },
  { name: 'Door_5',                    label: 'Door (5)',         category: 'Doors',    price: 3400 },
  { name: 'Door_6',                    label: 'Door (6)',         category: 'Doors',    price: 3500 },
  { name: 'Door_7',                    label: 'Door (7)',         category: 'Doors',    price: 3600 },
  { name: 'Door_8',                    label: 'Door (8)',         category: 'Doors',    price: 3700 },
  { name: 'Door_9',                    label: 'Door (9)',         category: 'Doors',    price: 3800 },
  { name: 'Door_Double',               label: 'Double Door',      category: 'Doors',    price: 6500 },
  { name: 'Window_Large1',             label: 'Large Window',     category: 'Doors',    price: 5500 },
  { name: 'Window_Large2',             label: 'Large Window (2)', category: 'Doors',    price: 5700 },
  { name: 'Window_Small1',             label: 'Small Window',     category: 'Doors',    price: 3500 },
  { name: 'Window_Small2',             label: 'Small Window (2)', category: 'Doors',    price: 3700 },
  { name: 'Window_Small3',             label: 'Small Window (3)', category: 'Doors',    price: 3900 },
  { name: 'Window_Round1',             label: 'Round Window',     category: 'Doors',    price: 6500 },
  { name: 'Window_Round2',             label: 'Round Window (2)', category: 'Doors',    price: 6700 },
  { name: 'Window_Round3',             label: 'Round Window (3)', category: 'Doors',    price: 6900 },

  // Misc
  { name: 'Trashcan_Small1',           label: 'Trashcan',         category: 'Misc',     price: 400 },
  { name: 'Trashcan_Small2',           label: 'Trashcan (alt)',   category: 'Misc',     price: 420 },
  { name: 'Trashcan_Cylindric',        label: 'Round Trashcan',   category: 'Misc',     price: 600 },
  { name: 'Trashcan_Green',            label: 'Recycling Bin',    category: 'Misc',     price: 700 },
  { name: 'Trashcan_Large',            label: 'Dumpster',         category: 'Misc',     price: 1200 },
];

export const HOME_PACK_CATEGORIES = ['All', ...Array.from(new Set(HOME_PACK.map((m) => m.category)))];

const BY_NAME = new Map(HOME_PACK.map((m) => [m.name, m]));
export const findHomeModel = (name) => BY_NAME.get(name);

// ── Loader (cached) ───────────────────────────────────────────────────────

const loadCache = new Map(); // name → Promise<Group> (template)
const thumbCache = new Map(); // name → dataURL

function normalizeModel(group) {
  // Auto-center on X/Z, drop base to y=0
  const box = new THREE.Box3().setFromObject(group);
  if (!isFinite(box.min.x)) return group;
  const center = box.getCenter(new THREE.Vector3());
  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= box.min.y;
  // Convert MeshPhongMaterial (default from MTLLoader) to MeshStandardMaterial
  // for better lighting + glow integration with the room.
  group.traverse((c) => {
    if (c.isMesh && c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      const newMats = mats.map((m) => {
        if (m.isMeshStandardMaterial) return m;
        const sm = new THREE.MeshStandardMaterial({
          color: m.color ? m.color.clone() : new THREE.Color(0xcccccc),
          roughness: 0.7,
          metalness: 0.05,
          emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0x000000),
        });
        return sm;
      });
      c.material = Array.isArray(c.material) ? newMats : newMats[0];
    }
  });
  // Scale to fit a target bounding box of ~1.5 max dimension, then user can scale.
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) {
    const targetMax = 1.6;
    const s = targetMax / maxDim;
    group.scale.setScalar(s);
  }
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
            (group) => resolve(normalizeModel(group)),
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
