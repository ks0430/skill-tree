/**
 * Force-directed layout engine
 *
 * Spring physics + Coulomb repulsion simulation for the Weight Graph view.
 *
 * Algorithm:
 *   - Nodes repel each other (Coulomb / inverse-square law).
 *   - Edges attract connected node pairs (Hooke spring law).
 *   - Edge weight scales spring strength: heavier edges pull harder.
 *   - Simulation runs for a fixed number of iterations (non-animated, returns
 *     stable positions) but the WeightGraph component can also call
 *     `stepForce` incrementally for animated settlement.
 */

export interface ForceNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Degree = number of connected edges (used for node sizing). */
  degree: number;
}

export interface ForceEdge {
  source: string;
  target: string;
  weight: number; // 0–1 (or higher); 1 = default spring strength
}

export interface ForceConfig {
  /** Canvas area (layout will be centred in this box). */
  width: number;
  height: number;
  /** Ideal spring length between connected nodes (pixels). */
  springLength?: number;
  /** Spring constant — stiffness of edge-attraction. */
  springK?: number;
  /** Repulsion constant — strength of node-repulsion. */
  repulsionK?: number;
  /** Velocity damping per tick (0 → no damping, 1 → instant stop). */
  damping?: number;
  /** Number of simulation steps to run on `computeForceLayout`. */
  iterations?: number;
  /** Minimum distance to avoid division-by-zero in repulsion. */
  minDist?: number;
}

const DEFAULTS: Required<Omit<ForceConfig, "width" | "height">> = {
  springLength: 180,
  springK: 0.04,
  repulsionK: 8000,
  damping: 0.8,
  iterations: 200,
  minDist: 30,
};

// ─── Single simulation tick ────────────────────────────────────────────────────

/**
 * Apply one tick of force simulation to `nodes` in-place.
 * Returns the maximum velocity magnitude (useful for detecting convergence).
 */
export function stepForce(
  nodes: ForceNode[],
  edges: ForceEdge[],
  cfg: Required<Omit<ForceConfig, "width" | "height">>
): number {
  const { springLength, springK, repulsionK, damping, minDist } = cfg;

  // Build id → index map for O(1) lookup
  const idx = new Map<string, number>(nodes.map((n, i) => [n.id, i]));

  // Reset forces
  const fx = new Float64Array(nodes.length);
  const fy = new Float64Array(nodes.length);

  // ── Repulsion: every pair of nodes pushes apart ──────────────────────────
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), minDist);
      const force = repulsionK / (dist * dist);
      const ux = dx / dist;
      const uy = dy / dist;

      fx[i] += force * ux;
      fy[i] += force * uy;
      fx[j] -= force * ux;
      fy[j] -= force * uy;
    }
  }

  // ── Spring attraction: edges pull endpoints toward each other ─────────────
  for (const e of edges) {
    const si = idx.get(e.source);
    const ti = idx.get(e.target);
    if (si === undefined || ti === undefined) continue;

    const dx = nodes[ti].x - nodes[si].x;
    const dy = nodes[ti].y - nodes[si].y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), minDist);
    // Weighted spring: force = k * weight * (dist - springLength)
    const displacement = dist - springLength;
    const force = springK * (e.weight > 0 ? e.weight : 1) * displacement;
    const ux = dx / dist;
    const uy = dy / dist;

    fx[si] += force * ux;
    fy[si] += force * uy;
    fx[ti] -= force * ux;
    fy[ti] -= force * uy;
  }

  // ── Integrate: update velocity + position ────────────────────────────────
  let maxV = 0;
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].vx = (nodes[i].vx + fx[i]) * damping;
    nodes[i].vy = (nodes[i].vy + fy[i]) * damping;
    nodes[i].x += nodes[i].vx;
    nodes[i].y += nodes[i].vy;
    const v = Math.sqrt(nodes[i].vx ** 2 + nodes[i].vy ** 2);
    if (v > maxV) maxV = v;
  }

  return maxV;
}

// ─── Full layout (batch mode) ─────────────────────────────────────────────────

/**
 * Run the force simulation to near-convergence and return positioned nodes.
 *
 * Nodes are seeded with a random jitter around the canvas centre so the
 * simulation can escape degenerate symmetric configurations.
 */
export function computeForceLayout(
  nodeIds: string[],
  edges: ForceEdge[],
  config: ForceConfig
): ForceNode[] {
  const cfg = { ...DEFAULTS, ...config } as Required<Omit<ForceConfig, "width" | "height">> & ForceConfig;
  const { width, height, iterations, minDist } = cfg as Required<ForceConfig>;
  const cx = width / 2;
  const cy = height / 2;

  // Degree map
  const degreeMap = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  for (const e of edges) {
    degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
  }

  // Seed positions: evenly distributed on a circle + small random jitter
  const n = nodeIds.length;
  const seed = 42; // deterministic-ish via simple LCG
  let rng = seed;
  const nextRand = () => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff;
    return (rng >>> 0) / 0xffffffff;
  };

  const radius = Math.min(width, height) * 0.35;
  const nodes: ForceNode[] = nodeIds.map((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(n, 1);
    return {
      id,
      x: cx + radius * Math.cos(angle) + (nextRand() - 0.5) * 40,
      y: cy + radius * Math.sin(angle) + (nextRand() - 0.5) * 40,
      vx: 0,
      vy: 0,
      degree: degreeMap.get(id) ?? 0,
    };
  });

  // Run iterations
  const stepCfg = {
    springLength: cfg.springLength,
    springK: cfg.springK,
    repulsionK: cfg.repulsionK,
    damping: cfg.damping,
    iterations,
    minDist,
  };

  for (let i = 0; i < iterations; i++) {
    const maxV = stepForce(nodes, edges, stepCfg);
    if (maxV < 0.05) break; // converged early
  }

  // Centre the layout in the canvas
  const mx = nodes.reduce((s, n) => s + n.x, 0) / Math.max(n, 1);
  const my = nodes.reduce((s, n) => s + n.y, 0) / Math.max(n, 1);
  const shift = { x: cx - mx, y: cy - my };
  nodes.forEach((nd) => {
    nd.x += shift.x;
    nd.y += shift.y;
  });

  return nodes;
}
