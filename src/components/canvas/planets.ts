// High-detail procedural planet generator

const TEX_SIZE = 512;

// --- Noise ---

function hash(x: number, y: number, seed: number): number {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  // Quintic interpolation for smoother results
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

  const n00 = hash(ix, iy, seed);
  const n10 = hash(ix + 1, iy, seed);
  const n01 = hash(ix, iy + 1, seed);
  const n11 = hash(ix + 1, iy + 1, seed);

  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}

function fbm(x: number, y: number, seed: number, octaves: number, lacunarity = 2.0, gain = 0.5): number {
  let value = 0, amplitude = 1, frequency = 1, maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, y * frequency, seed + i * 137) * amplitude;
    maxVal += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return value / maxVal;
}

// Domain-warped fbm for more organic look
function warpedFbm(x: number, y: number, seed: number, octaves: number): number {
  const qx = fbm(x, y, seed, 4);
  const qy = fbm(x + 5.2, y + 1.3, seed + 50, 4);
  return fbm(x + qx * 2, y + qy * 2, seed + 100, octaves);
}

// Ridged noise for mountains
function ridgedFbm(x: number, y: number, seed: number, octaves: number): number {
  let value = 0, amplitude = 1, frequency = 1, maxVal = 0;
  for (let i = 0; i < octaves; i++) {
    let n = smoothNoise(x * frequency, y * frequency, seed + i * 97);
    n = 1 - Math.abs(n * 2 - 1); // Ridge
    n = n * n; // Sharpen
    value += n * amplitude;
    maxVal += amplitude;
    amplitude *= 0.5;
    frequency *= 2.2;
  }
  return value / maxVal;
}

// --- Helpers ---

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function lerpC(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): [number, number, number] {
  const ct = Math.max(0, Math.min(1, t));
  return [lerp(c1[0], c2[0], ct), lerp(c1[1], c2[1], ct), lerp(c1[2], c2[2], ct)];
}

function clamp(v: number, lo = 0, hi = 255): number {
  return Math.max(lo, Math.min(hi, v));
}

// Spherical UV → 3D coords for seamless wrapping
function sphereCoords(u: number, v: number, scale: number): [number, number, number] {
  const theta = u * Math.PI * 2;
  const phi = v * Math.PI;
  return [
    Math.sin(phi) * Math.cos(theta) * scale,
    Math.sin(phi) * Math.sin(theta) * scale,
    Math.cos(phi) * scale,
  ];
}

// --- Planet types ---

export type PlanetType =
  | "earth" | "mars" | "jupiter" | "ice" | "sun"
  | "purple" | "ocean" | "desert" | "volcanic" | "moon";

export interface PlanetConfig {
  type: PlanetType;
  hasAtmosphere: boolean;
  atmosphereColor: string;
  hasRings: boolean;
  ringColor: string;
  hasClouds: boolean;
  emissive: boolean;
  rotationSpeed: number;
}

const CONFIGS: Record<PlanetType, Omit<PlanetConfig, "type">> = {
  earth:    { hasAtmosphere: true,  atmosphereColor: "#4da6ff", hasRings: false, ringColor: "",        hasClouds: true,  emissive: false, rotationSpeed: 0.08 },
  mars:     { hasAtmosphere: true,  atmosphereColor: "#d4836a", hasRings: false, ringColor: "",        hasClouds: false, emissive: false, rotationSpeed: 0.07 },
  jupiter:  { hasAtmosphere: true,  atmosphereColor: "#d4a574", hasRings: true,  ringColor: "#c4956a", hasClouds: false, emissive: false, rotationSpeed: 0.12 },
  ice:      { hasAtmosphere: true,  atmosphereColor: "#a0d4ff", hasRings: true,  ringColor: "#88bbdd", hasClouds: false, emissive: false, rotationSpeed: 0.05 },
  sun:      { hasAtmosphere: true,  atmosphereColor: "#ffaa33", hasRings: false, ringColor: "",        hasClouds: false, emissive: true,  rotationSpeed: 0.03 },
  purple:   { hasAtmosphere: true,  atmosphereColor: "#9966ff", hasRings: false, ringColor: "",        hasClouds: true,  emissive: false, rotationSpeed: 0.06 },
  ocean:    { hasAtmosphere: true,  atmosphereColor: "#3388ff", hasRings: false, ringColor: "",        hasClouds: true,  emissive: false, rotationSpeed: 0.09 },
  desert:   { hasAtmosphere: true,  atmosphereColor: "#ddaa66", hasRings: false, ringColor: "",        hasClouds: false, emissive: false, rotationSpeed: 0.06 },
  volcanic: { hasAtmosphere: true,  atmosphereColor: "#ff4422", hasRings: false, ringColor: "",        hasClouds: false, emissive: false, rotationSpeed: 0.04 },
  moon:     { hasAtmosphere: false, atmosphereColor: "",        hasRings: false, ringColor: "",        hasClouds: false, emissive: false, rotationSpeed: 0.03 },
};

export function getPlanetConfig(type: PlanetType): PlanetConfig {
  return { type, ...CONFIGS[type] };
}

export function pickPlanetType(id: string): PlanetType {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  const types: PlanetType[] = ["earth", "mars", "jupiter", "ice", "sun", "purple", "ocean", "desert", "volcanic", "moon"];
  return types[Math.abs(h) % types.length];
}

// --- Texture generation ---

type Painter = (nx: number, ny: number, nz: number, u: number, v: number, seed: number) => [number, number, number];

function renderTexture(seed: number, scale: number, painter: Painter): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(TEX_SIZE, TEX_SIZE);
  const d = img.data;

  for (let py = 0; py < TEX_SIZE; py++) {
    const v = py / TEX_SIZE;
    for (let px = 0; px < TEX_SIZE; px++) {
      const u = px / TEX_SIZE;
      const [nx, ny, nz] = sphereCoords(u, v, scale);
      const [r, g, b] = painter(nx, ny, nz, u, v, seed);
      const i = (py * TEX_SIZE + px) * 4;
      d[i] = clamp(r);
      d[i + 1] = clamp(g);
      d[i + 2] = clamp(b);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ============ EARTH ============
const paintEarth: Painter = (nx, ny, nz, u, v, seed) => {
  const continent = warpedFbm(nx + 10, ny + 10, seed, 7);
  const mountain = ridgedFbm(nx * 1.5, nz * 1.5, seed + 30, 6);
  const detail = fbm(nx * 8, ny * 8, seed + 60, 4) * 0.1;
  const latitude = Math.abs(v - 0.5) * 2; // 0 at equator, 1 at poles

  // Ice caps
  const iceLine = 0.88 - continent * 0.08;
  if (latitude > iceLine) {
    const iceBlend = (latitude - iceLine) / (1 - iceLine);
    const ice: [number, number, number] = [230 + detail * 200, 240 + detail * 100, 255];
    const iceEdge: [number, number, number] = [200, 220, 245];
    return lerpC(iceEdge, ice, iceBlend);
  }

  // Sea level threshold (varies by warp)
  const seaLevel = 0.48;
  if (continent < seaLevel) {
    const depth = continent / seaLevel;
    const abyss: [number, number, number] = [8, 18, 65];
    const deep: [number, number, number] = [12, 40, 120];
    const mid: [number, number, number] = [20, 70, 165];
    const shallow: [number, number, number] = [40, 120, 195];
    const shore: [number, number, number] = [70, 150, 200];

    if (depth < 0.3) return lerpC(abyss, deep, depth / 0.3);
    if (depth < 0.6) return lerpC(deep, mid, (depth - 0.3) / 0.3);
    if (depth < 0.85) return lerpC(mid, shallow, (depth - 0.6) / 0.25);
    return lerpC(shallow, shore, (depth - 0.85) / 0.15);
  }

  // Land
  const elevation = (continent - seaLevel) / (1 - seaLevel);
  const mtn = mountain * elevation;

  const beach: [number, number, number] = [194, 178, 128];
  const lowland: [number, number, number] = [34 + detail * 100, 120 + detail * 80, 28];
  const forest: [number, number, number] = [20 + detail * 60, 90 + detail * 50, 15];
  const highland: [number, number, number] = [100, 85, 55];
  const rock: [number, number, number] = [130, 115, 85];
  const snow: [number, number, number] = [235, 240, 250];

  // Tropical vs temperate coloring
  const tropical = Math.max(0, 1 - latitude * 2.5);
  const tropicalForest: [number, number, number] = [15, 100, 20];

  if (elevation < 0.03) return lerpC(beach, lowland, elevation / 0.03);
  if (elevation < 0.25) {
    const base = lerpC(lowland, forest, (elevation - 0.03) / 0.22);
    return lerpC(base, tropicalForest, tropical * 0.5);
  }
  if (elevation < 0.5) return lerpC(forest, highland, (elevation - 0.25) / 0.25 + mtn * 0.3);
  if (elevation < 0.75) return lerpC(highland, rock, (elevation - 0.5) / 0.25 + mtn * 0.4);
  return lerpC(rock, snow, (elevation - 0.75) / 0.25 + mtn * 0.3);
};

// ============ MARS ============
const paintMars: Painter = (nx, ny, nz, u, v, seed) => {
  const terrain = warpedFbm(nx + 5, ny + 5, seed, 7);
  const craters = ridgedFbm(nx * 3, nz * 3, seed + 20, 5);
  const dust = fbm(nx * 6, ny * 6, seed + 40, 4);
  const latitude = Math.abs(v - 0.5) * 2;

  // Polar ice
  if (latitude > 0.92) {
    const t = (latitude - 0.92) / 0.08;
    return lerpC([200, 180, 160], [230, 220, 210], t);
  }

  const valles: [number, number, number] = [90, 35, 15];
  const lowland: [number, number, number] = [160, 75, 40];
  const midland: [number, number, number] = [190, 110, 65];
  const highland: [number, number, number] = [210, 150, 100];
  const peak: [number, number, number] = [185, 135, 95];
  const darkDust: [number, number, number] = [110, 50, 25];

  let c: [number, number, number];
  if (terrain < 0.3) c = lerpC(valles, lowland, terrain / 0.3);
  else if (terrain < 0.5) c = lerpC(lowland, midland, (terrain - 0.3) / 0.2);
  else if (terrain < 0.7) c = lerpC(midland, highland, (terrain - 0.5) / 0.2);
  else c = lerpC(highland, peak, (terrain - 0.7) / 0.3);

  // Crater shadows
  const craterMark = craters > 0.7 ? (craters - 0.7) / 0.3 : 0;
  c = lerpC(c, darkDust, craterMark * 0.5);

  // Dust storms (subtle variation)
  c = lerpC(c, [180, 130, 80], dust * 0.15);
  return c;
};

// ============ JUPITER ============
const paintJupiter: Painter = (nx, ny, nz, u, v, seed) => {
  const bandBase = v * 14;
  const warp = fbm(nx * 2, ny * 2, seed, 5) * 1.5;
  const band = Math.sin(bandBase + warp) * 0.5 + 0.5;
  const turbulence = warpedFbm(nx * 3, ny * 3, seed + 20, 6);
  const detail = fbm(nx * 10, ny * 10, seed + 50, 3);

  const cream: [number, number, number] = [225, 195, 155];
  const tan: [number, number, number] = [200, 155, 105];
  const brown: [number, number, number] = [165, 110, 65];
  const darkBrown: [number, number, number] = [130, 80, 45];
  const rust: [number, number, number] = [180, 95, 50];

  let c: [number, number, number];
  if (band < 0.25) c = lerpC(darkBrown, brown, band / 0.25);
  else if (band < 0.45) c = lerpC(brown, tan, (band - 0.25) / 0.2);
  else if (band < 0.6) c = lerpC(tan, cream, (band - 0.45) / 0.15);
  else if (band < 0.8) c = lerpC(cream, tan, (band - 0.6) / 0.2);
  else c = lerpC(tan, rust, (band - 0.8) / 0.2);

  // Great Red Spot-ish feature
  const spotU = u - 0.3, spotV = v - 0.45;
  const spotDist = Math.sqrt(spotU * spotU * 4 + spotV * spotV * 16);
  if (spotDist < 0.15) {
    const swirl = fbm(nx * 5 + turbulence * 2, ny * 5, seed + 80, 4);
    const spotColor: [number, number, number] = [200, 80, 40];
    c = lerpC(c, spotColor, (1 - spotDist / 0.15) * 0.7 * (0.5 + swirl * 0.5));
  }

  c = lerpC(c, [c[0] + 15, c[1] + 10, c[2]], detail * 0.3);
  return c;
};

// ============ ICE ============
const paintIce: Painter = (nx, ny, nz, u, v, seed) => {
  const terrain = warpedFbm(nx + 3, ny + 3, seed, 7);
  const cracks = ridgedFbm(nx * 4, nz * 4, seed + 15, 5);
  const frost = fbm(nx * 7, ny * 7, seed + 30, 4);

  const deepIce: [number, number, number] = [60, 100, 170];
  const midIce: [number, number, number] = [120, 170, 220];
  const surface: [number, number, number] = [190, 215, 240];
  const snow: [number, number, number] = [235, 242, 252];
  const glacier: [number, number, number] = [170, 200, 235];
  const crackColor: [number, number, number] = [40, 80, 150];

  let c: [number, number, number];
  if (terrain < 0.3) c = lerpC(deepIce, midIce, terrain / 0.3);
  else if (terrain < 0.55) c = lerpC(midIce, glacier, (terrain - 0.3) / 0.25);
  else if (terrain < 0.75) c = lerpC(glacier, surface, (terrain - 0.55) / 0.2);
  else c = lerpC(surface, snow, (terrain - 0.75) / 0.25);

  // Crevasse lines
  if (cracks > 0.75) c = lerpC(c, crackColor, (cracks - 0.75) / 0.25 * 0.6);

  c = lerpC(c, snow, frost * 0.15);
  return c;
};

// ============ SUN ============
const paintSun: Painter = (nx, ny, nz, u, v, seed) => {
  const granulation = warpedFbm(nx * 3, ny * 3, seed, 6);
  const spots = fbm(nx * 1.5, nz * 1.5, seed + 20, 4);
  const flare = ridgedFbm(nx * 2, ny * 2, seed + 40, 5);

  const core: [number, number, number] = [255, 250, 200];
  const hot: [number, number, number] = [255, 210, 80];
  const mid: [number, number, number] = [255, 160, 30];
  const cool: [number, number, number] = [230, 100, 15];
  const spot: [number, number, number] = [150, 50, 10];

  let c: [number, number, number];
  if (granulation < 0.3) c = lerpC(cool, mid, granulation / 0.3);
  else if (granulation < 0.6) c = lerpC(mid, hot, (granulation - 0.3) / 0.3);
  else c = lerpC(hot, core, (granulation - 0.6) / 0.4);

  // Sunspots
  if (spots < 0.2) c = lerpC(c, spot, (0.2 - spots) / 0.2 * 0.8);

  // Flare brightening
  c = lerpC(c, core, flare * 0.2);
  return c;
};

// ============ PURPLE ============
const paintPurple: Painter = (nx, ny, nz, u, v, seed) => {
  const terrain = warpedFbm(nx + 7, ny + 7, seed, 7);
  const crystal = ridgedFbm(nx * 3, nz * 3, seed + 10, 5);
  const glow = fbm(nx * 5, ny * 5, seed + 50, 3);

  const abyss: [number, number, number] = [25, 8, 60];
  const deep: [number, number, number] = [60, 20, 120];
  const mid: [number, number, number] = [110, 50, 180];
  const light: [number, number, number] = [160, 100, 220];
  const bright: [number, number, number] = [200, 160, 245];
  const crystalC: [number, number, number] = [220, 180, 255];

  let c: [number, number, number];
  if (terrain < 0.3) c = lerpC(abyss, deep, terrain / 0.3);
  else if (terrain < 0.5) c = lerpC(deep, mid, (terrain - 0.3) / 0.2);
  else if (terrain < 0.7) c = lerpC(mid, light, (terrain - 0.5) / 0.2);
  else c = lerpC(light, bright, (terrain - 0.7) / 0.3);

  if (crystal > 0.72) c = lerpC(c, crystalC, (crystal - 0.72) / 0.28 * 0.6);
  c[0] = clamp(c[0] + glow * 20);
  c[1] = clamp(c[1] + glow * 10);
  return c;
};

// ============ OCEAN ============
const paintOcean: Painter = (nx, ny, nz, u, v, seed) => {
  const waves = warpedFbm(nx + 2, ny + 2, seed, 7);
  const depth = fbm(nx * 2, nz * 2, seed + 20, 6);
  const foam = ridgedFbm(nx * 6, ny * 6, seed + 40, 4);
  const latitude = Math.abs(v - 0.5) * 2;

  const abyss: [number, number, number] = [5, 12, 55];
  const deep: [number, number, number] = [10, 35, 110];
  const mid: [number, number, number] = [20, 75, 160];
  const shallow: [number, number, number] = [45, 130, 200];
  const surface: [number, number, number] = [80, 170, 220];
  const foamC: [number, number, number] = [200, 230, 245];

  let c: [number, number, number];
  const d = waves * 0.6 + depth * 0.4;
  if (d < 0.25) c = lerpC(abyss, deep, d / 0.25);
  else if (d < 0.5) c = lerpC(deep, mid, (d - 0.25) / 0.25);
  else if (d < 0.75) c = lerpC(mid, shallow, (d - 0.5) / 0.25);
  else c = lerpC(shallow, surface, (d - 0.75) / 0.25);

  // Tiny islands
  if (waves > 0.82) {
    const island: [number, number, number] = [40, 110, 35];
    c = lerpC(c, island, (waves - 0.82) / 0.18);
  }

  if (foam > 0.8) c = lerpC(c, foamC, (foam - 0.8) / 0.2 * 0.3);

  // Polar ice
  if (latitude > 0.85) c = lerpC(c, [220, 235, 250], (latitude - 0.85) / 0.15);
  return c;
};

// ============ DESERT ============
const paintDesert: Painter = (nx, ny, nz, u, v, seed) => {
  const dunes = warpedFbm(nx + 4, ny + 4, seed, 7);
  const wind = fbm(nx * 8 + dunes * 2, ny * 2, seed + 30, 4);
  const rock = ridgedFbm(nx * 3, nz * 3, seed + 50, 5);

  const shadow: [number, number, number] = [130, 80, 30];
  const dark: [number, number, number] = [175, 120, 55];
  const sand: [number, number, number] = [215, 175, 110];
  const light: [number, number, number] = [240, 210, 155];
  const bright: [number, number, number] = [250, 230, 185];
  const rockC: [number, number, number] = [145, 100, 55];

  // Wind ripples on dune surface
  const ripple = Math.sin(wind * Math.PI * 20) * 0.03;

  let c: [number, number, number];
  const h = dunes + ripple;
  if (h < 0.3) c = lerpC(shadow, dark, h / 0.3);
  else if (h < 0.5) c = lerpC(dark, sand, (h - 0.3) / 0.2);
  else if (h < 0.7) c = lerpC(sand, light, (h - 0.5) / 0.2);
  else c = lerpC(light, bright, (h - 0.7) / 0.3);

  // Rocky outcrops
  if (rock > 0.7) c = lerpC(c, rockC, (rock - 0.7) / 0.3 * 0.6);
  return c;
};

// ============ VOLCANIC ============
const paintVolcanic: Painter = (nx, ny, nz, u, v, seed) => {
  const terrain = warpedFbm(nx + 6, ny + 6, seed, 7);
  const lavaFlow = ridgedFbm(nx * 3, nz * 3, seed + 15, 6);
  const ash = fbm(nx * 5, ny * 5, seed + 40, 4);

  const obsidian: [number, number, number] = [20, 15, 15];
  const darkRock: [number, number, number] = [50, 35, 30];
  const rock: [number, number, number] = [75, 55, 45];
  const hotRock: [number, number, number] = [120, 50, 20];
  const lava: [number, number, number] = [255, 100, 15];
  const brightLava: [number, number, number] = [255, 200, 60];

  let c: [number, number, number];
  if (terrain < 0.35) c = lerpC(obsidian, darkRock, terrain / 0.35);
  else if (terrain < 0.6) c = lerpC(darkRock, rock, (terrain - 0.35) / 0.25);
  else c = lerpC(rock, hotRock, (terrain - 0.6) / 0.4);

  // Lava in crevices
  if (lavaFlow > 0.65) {
    const lavaT = (lavaFlow - 0.65) / 0.35;
    c = lerpC(c, lava, lavaT * 0.8);
    if (lavaT > 0.6) c = lerpC(c, brightLava, (lavaT - 0.6) / 0.4);
  }

  c = lerpC(c, [c[0] - 10, c[1] - 10, c[2] - 10], ash * 0.2);
  return c;
};

// ============ MOON ============
const paintMoon: Painter = (nx, ny, nz, u, v, seed) => {
  const terrain = fbm(nx + 1, ny + 1, seed, 7);
  const craters = ridgedFbm(nx * 4, nz * 4, seed + 10, 6);
  const smallCraters = ridgedFbm(nx * 10, ny * 10, seed + 30, 4);
  const regolith = fbm(nx * 8, ny * 8, seed + 50, 3);

  const darkMare: [number, number, number] = [60, 60, 65];
  const mare: [number, number, number] = [90, 90, 95];
  const highland: [number, number, number] = [155, 155, 160];
  const bright: [number, number, number] = [195, 195, 200];
  const craterFloor: [number, number, number] = [50, 50, 55];
  const craterRim: [number, number, number] = [180, 180, 185];

  let c: [number, number, number];
  if (terrain < 0.4) c = lerpC(darkMare, mare, terrain / 0.4);
  else if (terrain < 0.6) c = lerpC(mare, highland, (terrain - 0.4) / 0.2);
  else c = lerpC(highland, bright, (terrain - 0.6) / 0.4);

  // Large craters
  if (craters > 0.75) {
    const rim = (craters - 0.75) / 0.25;
    c = rim > 0.5 ? lerpC(c, craterRim, (rim - 0.5) * 1.2) : lerpC(c, craterFloor, rim * 1.5);
  }

  // Small craters
  if (smallCraters > 0.8) c = lerpC(c, craterFloor, (smallCraters - 0.8) / 0.2 * 0.4);

  // Regolith variation
  const r = regolith * 10 - 5;
  c = [clamp(c[0] + r), clamp(c[1] + r), clamp(c[2] + r)];
  return c;
};

const PAINTERS: Record<PlanetType, Painter> = {
  earth: paintEarth, mars: paintMars, jupiter: paintJupiter, ice: paintIce,
  sun: paintSun, purple: paintPurple, ocean: paintOcean, desert: paintDesert,
  volcanic: paintVolcanic, moon: paintMoon,
};

const SCALES: Record<PlanetType, number> = {
  earth: 4, mars: 4, jupiter: 2.5, ice: 4, sun: 3,
  purple: 4, ocean: 3.5, desert: 4, volcanic: 4, moon: 4,
};

// --- Public API ---

const cache = new Map<string, HTMLCanvasElement>();

export function generatePlanetTexture(type: PlanetType, seed: number): HTMLCanvasElement {
  const key = `planet-${type}-${seed}`;
  if (cache.has(key)) return cache.get(key)!;
  const canvas = renderTexture(seed, SCALES[type], PAINTERS[type]);
  cache.set(key, canvas);
  return canvas;
}

export function generateCloudTexture(seed: number): HTMLCanvasElement {
  const key = `clouds-${seed}`;
  if (cache.has(key)) return cache.get(key)!;

  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(TEX_SIZE, TEX_SIZE);
  const d = img.data;

  for (let py = 0; py < TEX_SIZE; py++) {
    const v = py / TEX_SIZE;
    for (let px = 0; px < TEX_SIZE; px++) {
      const u = px / TEX_SIZE;
      const [nx, ny, nz] = sphereCoords(u, v, 3.5);
      const n1 = warpedFbm(nx, ny, seed + 200, 6);
      const n2 = fbm(nx * 3, nz * 3, seed + 250, 4);
      const combined = n1 * 0.7 + n2 * 0.3;

      // Wispy cloud shapes
      const threshold = 0.45;
      const alpha = combined > threshold
        ? Math.min(220, ((combined - threshold) / (1 - threshold)) * 280)
        : 0;

      const i = (py * TEX_SIZE + px) * 4;
      d[i] = 255;
      d[i + 1] = 252;
      d[i + 2] = 248;
      d[i + 3] = alpha;
    }
  }

  ctx.putImageData(img, 0, 0);
  cache.set(key, canvas);
  return canvas;
}

export function generateRingTexture(color: string, seed: number): HTMLCanvasElement {
  const key = `ring-${seed}`;
  if (cache.has(key)) return cache.get(key)!;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;

  const tmp = document.createElement("canvas").getContext("2d")!;
  tmp.fillStyle = color;
  const hex = tmp.fillStyle;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const img = ctx.createImageData(512, 1);
  const d = img.data;

  for (let x = 0; x < 512; x++) {
    const t = x / 512;
    const n1 = smoothNoise(t * 30, seed, seed + 300);
    const n2 = smoothNoise(t * 60, seed + 10, seed + 400);
    const band = Math.sin(t * Math.PI * 12 + n1 * 5) * 0.5 + 0.5;
    const gap = Math.sin(t * Math.PI * 30 + n2 * 3) * 0.5 + 0.5;
    const alpha = band > 0.25 && gap > 0.2
      ? band * (1 - Math.abs(t - 0.5) * 2) * 200
      : 0;

    const variation = (n1 - 0.5) * 30;
    const i = x * 4;
    d[i] = clamp(r + variation);
    d[i + 1] = clamp(g + variation);
    d[i + 2] = clamp(b + variation * 0.5);
    d[i + 3] = clamp(alpha);
  }

  ctx.putImageData(img, 0, 0);
  cache.set(key, canvas);
  return canvas;
}
