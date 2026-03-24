import { create } from "zustand";
import type { SkillNode, NodeStatus, NodeRole } from "@/types/skill-tree";
import type { NodeContent } from "@/types/node-content";
import type { PendingChange } from "@/types/chat";

export interface Node3D {
  id: string;
  data: SkillNode;
  position: [number, number, number]; // initial position (stellars stay here, orbiters animate from here)
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  orbitTilt: number;     // radians tilt of orbital plane
  scale: number;
}

interface HistoryEntry {
  nodes: Node3D[];
}

interface TreeState {
  treeId: string | null;
  nodes: Node3D[];
  pendingChanges: PendingChange[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  focusTargetId: string | null; // node ID to fly camera to (one-shot)
  trackingNodeId: string | null; // node ID camera continuously follows (sticky mode)
  pinnedNodeId: string | null; // node ID whose detail panel is pinned open
  searchHighlightId: string | null; // node ID to pulse-highlight after search (auto-clears)
  history: HistoryEntry[];
  historyIndex: number;

  setTreeId: (id: string) => void;
  setNodes: (nodes: Node3D[]) => void;
  setSelectedNode: (id: string | null) => void;
  setHoveredNode: (id: string | null) => void;
  setFocusTarget: (id: string | null) => void;
  setTrackingNode: (id: string | null) => void;
  setPinnedNode: (id: string | null) => void;
  setSearchHighlight: (id: string | null) => void;

  addNode: (node: SkillNode) => void;
  updateNodeContent: (nodeId: string, content: NodeContent) => void;
  removeNode: (nodeId: string) => void;
  updateNode: (nodeId: string, data: Partial<SkillNode>) => void;
  toggleNodeStatus: (nodeId: string) => void;

  addPendingChange: (change: PendingChange) => void;
  resolvePendingChange: (id: string, accepted: boolean) => void;
  resolveAllPending: (accepted: boolean) => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

const STATUS_CYCLE: NodeStatus[] = ["locked", "in_progress", "completed"];

// --- Orbital Layout Engine ---

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function computeStellarPosition(index: number, total: number): [number, number, number] {
  if (total === 1) return [0, 0, 0];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angle = index * goldenAngle;
  const radius = 12 + index * 6;
  const y = (hashSeed(`stellar-${index}`) % 40 - 20) * 0.1;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
}

export function layoutGalaxy(nodes: SkillNode[]): Node3D[] {
  const stellars = nodes.filter((n) => n.role === "stellar");
  const planets = nodes.filter((n) => n.role === "planet");
  const satellites = nodes.filter((n) => n.role === "satellite");

  const result: Node3D[] = [];
  const positionMap = new Map<string, [number, number, number]>();

  // Stellars
  stellars.forEach((s, i) => {
    const pos = computeStellarPosition(i, stellars.length);
    positionMap.set(s.id, pos);
    result.push({
      id: s.id,
      data: s,
      position: pos,
      orbitRadius: 0,
      orbitAngle: 0,
      orbitSpeed: 0,
      orbitTilt: 0,
      scale: 1.5,
    });
  });

  // Planets
  const planetsByParent = new Map<string, SkillNode[]>();
  planets.forEach((p) => {
    const key = p.parent_id ?? "";
    if (!planetsByParent.has(key)) planetsByParent.set(key, []);
    planetsByParent.get(key)!.push(p);
  });

  planetsByParent.forEach((list, parentId) => {
    const parentPos = positionMap.get(parentId) ?? [0, 0, 0];
    list.forEach((p, i) => {
      const seed = hashSeed(p.id);
      const orbitRadius = 3.5 + i * 2.0 + (seed % 10) * 0.08;
      const orbitAngle = (i / list.length) * Math.PI * 2 + (seed % 100) * 0.01;
      const orbitSpeed = 0.02 + (seed % 40) * 0.0003;
      const orbitTilt = ((seed % 30) - 15) * 0.015; // slight tilt per orbit

      const x = parentPos[0] + Math.cos(orbitAngle) * orbitRadius;
      const z = parentPos[2] + Math.sin(orbitAngle) * orbitRadius;
      const y = parentPos[1];
      positionMap.set(p.id, [x, y, z]);

      const scale = 0.3 + (p.priority / 5) * 0.5;
      result.push({
        id: p.id, data: p, position: [x, y, z],
        orbitRadius, orbitAngle, orbitSpeed, orbitTilt, scale,
      });
    });
  });

  // Satellites
  const satsByParent = new Map<string, SkillNode[]>();
  satellites.forEach((s) => {
    const key = s.parent_id ?? "";
    if (!satsByParent.has(key)) satsByParent.set(key, []);
    satsByParent.get(key)!.push(s);
  });

  satsByParent.forEach((list, parentId) => {
    const parentPos = positionMap.get(parentId) ?? [0, 0, 0];
    list.forEach((s, i) => {
      const seed = hashSeed(s.id);
      const orbitRadius = 0.8 + i * 0.45 + (seed % 10) * 0.04;
      const orbitAngle = (i / list.length) * Math.PI * 2 + (seed % 100) * 0.02;
      const orbitSpeed = 0.05 + (seed % 50) * 0.0006;
      const orbitTilt = ((seed % 40) - 20) * 0.03;

      const x = parentPos[0] + Math.cos(orbitAngle) * orbitRadius;
      const z = parentPos[2] + Math.sin(orbitAngle) * orbitRadius;
      result.push({
        id: s.id, data: s, position: [x, parentPos[1], z],
        orbitRadius, orbitAngle, orbitSpeed, orbitTilt, scale: 0.18,
      });
    });
  });

  return result;
}

export const useTreeStore = create<TreeState>((set, get) => ({
  treeId: null,
  nodes: [],
  pendingChanges: [],
  selectedNodeId: null,
  hoveredNodeId: null,
  focusTargetId: null,
  trackingNodeId: null,
  pinnedNodeId: (typeof window !== "undefined" ? localStorage.getItem("pinnedNodeId") : null),
  searchHighlightId: null,
  history: [],
  historyIndex: -1,

  setTreeId: (id) => set({ treeId: id }),
  setNodes: (nodes) => set({ nodes }),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setTrackingNode: (id) => set({ trackingNodeId: id }),
  setFocusTarget: (id) => set({ focusTargetId: id }),
  setPinnedNode: (id) => {
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem("pinnedNodeId", id);
      else localStorage.removeItem("pinnedNodeId");
    }
    set({ pinnedNodeId: id });
  },
  setSearchHighlight: (id) => {
    set({ searchHighlightId: id });
    if (id) setTimeout(() => set({ searchHighlightId: null }), 2500);
  },

  updateNodeContent: (nodeId, content) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, content } } : n
      ),
    }));
  },

  addNode: (node) => {
    const existing = get().nodes;
    const allData = [...existing.map((n) => n.data), node];
    set({ nodes: layoutGalaxy(allData) });
  },

  removeNode: (nodeId) => {
    const existing = get().nodes;
    const toRemove = new Set<string>();
    toRemove.add(nodeId);
    let changed = true;
    while (changed) {
      changed = false;
      existing.forEach((n) => {
        if (n.data.parent_id && toRemove.has(n.data.parent_id) && !toRemove.has(n.id)) {
          toRemove.add(n.id);
          changed = true;
        }
      });
    }
    const remaining = existing.filter((n) => !toRemove.has(n.id)).map((n) => n.data);
    set({
      nodes: layoutGalaxy(remaining),
      selectedNodeId: toRemove.has(get().selectedNodeId ?? "") ? null : get().selectedNodeId,
    });
  },

  updateNode: (nodeId, data) => {
    const existing = get().nodes;
    const allData = existing.map((n) =>
      n.id === nodeId ? { ...n.data, ...data } : n.data
    );
    if (data.role != null || data.parent_id != null || data.priority != null) {
      set({ nodes: layoutGalaxy(allData) });
    } else {
      set({
        nodes: existing.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        ),
      });
    }
  },

  toggleNodeStatus: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const idx = STATUS_CYCLE.indexOf(n.data.status);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        return { ...n, data: { ...n.data, status: next } };
      }),
    }));
  },

  addPendingChange: (change) => {
    set((state) => ({ pendingChanges: [...state.pendingChanges, change] }));
  },

  resolvePendingChange: (id, accepted) => {
    set((state) => ({
      pendingChanges: state.pendingChanges.map((c) =>
        c.id === id ? { ...c, status: accepted ? "accepted" : "rejected" } : c
      ),
    }));
  },

  resolveAllPending: (accepted) => {
    set((state) => ({
      pendingChanges: state.pendingChanges.map((c) =>
        c.status === "pending" ? { ...c, status: accepted ? "accepted" : "rejected" } : c
      ),
    }));
  },

  pushHistory: () => {
    const { nodes, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: structuredClone(nodes) });
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    set({ nodes: history[historyIndex - 1].nodes, historyIndex: historyIndex - 1 });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    set({ nodes: history[historyIndex + 1].nodes, historyIndex: historyIndex + 1 });
  },
}));
