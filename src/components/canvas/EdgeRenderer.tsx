"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTreeStore } from "@/lib/store/tree-store";
import { worldPositions } from "./SkillNode3D";
import type { SkillEdge } from "@/types/skill-tree";

// Colour palette per edge type
const EDGE_COLORS: Record<string, string> = {
  depends_on: "#a78bfa",  // violet — prerequisite chain
  blocks:     "#f87171",  // red — blockers
  related:    "#60a5fa",  // blue — general relation
  references: "#34d399",  // green — references
  parent:     "#94a3b8",  // slate — parent hierarchy (subtle)
};

const EDGE_COLORS_HOVER: Record<string, string> = {
  depends_on: "#c4b5fd",
  blocks:     "#fca5a5",
  related:    "#93c5fd",
  references: "#6ee7b7",
  parent:     "#cbd5e1",
};

const DEFAULT_COLOR       = "#60a5fa";
const DEFAULT_COLOR_HOVER = "#93c5fd";

/** Collect the full prerequisite path (depends_on ancestors) for a given node. */
function collectPrereqPath(
  hoveredId: string,
  edges: SkillEdge[]
): Set<string> {
  // Build reverse depends_on map: for each node, which nodes does it depend on?
  const path = new Set<string>();
  const queue = [hoveredId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const e of edges) {
      if (e.type === "depends_on" && e.source_id === current && !path.has(e.target_id)) {
        path.add(e.target_id);
        queue.push(e.target_id);
      }
    }
  }
  // Also include edges that point INTO this node (things that depend ON the hovered node)
  for (const e of edges) {
    if (e.type === "depends_on" && e.target_id === hoveredId) {
      path.add(e.source_id);
    }
  }
  return path;
}

interface SingleEdgeLineProps {
  edge: SkillEdge;
  isHighlighted: boolean;
  anyHovered: boolean;
}

function SingleEdgeLine({ edge, isHighlighted, anyHovered }: SingleEdgeLineProps) {
  const positionsRef = useRef(new Float32Array(6)); // 2 points × 3 coords

  const { lineObj, geometry } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positionsRef.current, 3));
    const mat = new THREE.LineBasicMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const obj = new THREE.Line(geo, mat);
    return { lineObj: obj, geometry: geo };
  }, []);

  useFrame(() => {
    const src = worldPositions.get(edge.source_id);
    const tgt = worldPositions.get(edge.target_id);
    if (!src || !tgt) return;

    const buf = positionsRef.current;
    buf[0] = src.x; buf[1] = src.y; buf[2] = src.z;
    buf[3] = tgt.x; buf[4] = tgt.y; buf[5] = tgt.z;
    geometry.attributes.position.needsUpdate = true;

    // Update material colour and opacity smoothly
    const mat = lineObj.material as THREE.LineBasicMaterial;
    const targetColor = isHighlighted
      ? (EDGE_COLORS_HOVER[edge.type] ?? DEFAULT_COLOR_HOVER)
      : (EDGE_COLORS[edge.type] ?? DEFAULT_COLOR);
    mat.color.set(targetColor);
    const targetOpacity = anyHovered ? (isHighlighted ? 0.9 : 0.08) : 0.35;
    mat.opacity += (targetOpacity - mat.opacity) * 0.12;
  });

  return <primitive object={lineObj} />;
}

/** Renders all edges in the tree with glowing lines, highlights prerequisite path on hover. */
export function EdgeRenderer() {
  const edges = useTreeStore((s) => s.edges);
  const hoveredNodeId = useTreeStore((s) => s.hoveredNodeId);

  // Filter edges — skip parent-type edges since the orbital rings already show hierarchy
  const visibleEdges = useMemo(
    () => edges.filter((e) => e.type !== "parent"),
    [edges]
  );

  const prereqPath = useMemo(
    () => hoveredNodeId ? collectPrereqPath(hoveredNodeId, visibleEdges) : new Set<string>(),
    [hoveredNodeId, visibleEdges]
  );

  const anyHovered = !!hoveredNodeId;

  return (
    <>
      {visibleEdges.map((edge) => {
        const isHighlighted =
          anyHovered &&
          (edge.source_id === hoveredNodeId ||
            edge.target_id === hoveredNodeId ||
            prereqPath.has(edge.source_id) ||
            prereqPath.has(edge.target_id));

        return (
          <SingleEdgeLine
            key={edge.id}
            edge={edge}
            isHighlighted={isHighlighted}
            anyHovered={anyHovered}
          />
        );
      })}
    </>
  );
}
