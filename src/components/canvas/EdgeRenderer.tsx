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

/** Edge types that should render a directional arrowhead at the target end. */
const DIRECTIONAL_TYPES = new Set<string>(["depends_on", "blocks"]);

/** Shared cone geometry for arrowheads (reused across all arrows). */
const ARROWHEAD_GEO = new THREE.ConeGeometry(0.07, 0.28, 8);

/** Collect the full prerequisite/blocker path for a given node. */
function collectPrereqPath(
  hoveredId: string,
  edges: SkillEdge[]
): Set<string> {
  const path = new Set<string>();

  // depends_on ancestors: follow source → target chain upward
  const depQueue = [hoveredId];
  while (depQueue.length > 0) {
    const current = depQueue.shift()!;
    for (const e of edges) {
      if (e.type === "depends_on" && e.source_id === current && !path.has(e.target_id)) {
        path.add(e.target_id);
        depQueue.push(e.target_id);
      }
    }
  }

  // blocks descendants: follow source → target forward
  const blocksQueue = [hoveredId];
  while (blocksQueue.length > 0) {
    const current = blocksQueue.shift()!;
    for (const e of edges) {
      if (e.type === "blocks" && e.source_id === current && !path.has(e.target_id)) {
        path.add(e.target_id);
        blocksQueue.push(e.target_id);
      }
    }
  }

  // Also include nodes that point INTO the hovered node (things that depend on / block it)
  for (const e of edges) {
    if ((e.type === "depends_on" || e.type === "blocks") && e.target_id === hoveredId) {
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

/**
 * Renders a single edge: a line from source→target plus, for directional edge types
 * (depends_on, blocks), a small cone arrowhead pointing at the target node.
 */
function SingleEdgeLine({ edge, isHighlighted, anyHovered }: SingleEdgeLineProps) {
  const positionsRef = useRef(new Float32Array(6)); // 2 points × 3 coords
  const isDirectional = DIRECTIONAL_TYPES.has(edge.type);

  const { lineObj, geometry, arrowMesh } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positionsRef.current, 3));
    const mat = new THREE.LineBasicMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const obj = new THREE.Line(geo, mat);

    let arrow: THREE.Mesh | null = null;
    if (isDirectional) {
      const arrowMat = new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      // Cone default points up (+Y); we'll rotate it to face the edge direction each frame
      arrow = new THREE.Mesh(ARROWHEAD_GEO, arrowMat);
    }

    return { lineObj: obj, geometry: geo, arrowMesh: arrow };
  }, [isDirectional]);

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

    // Update arrowhead position and orientation
    if (arrowMesh) {
      const arrowMat = arrowMesh.material as THREE.MeshBasicMaterial;
      arrowMat.color.set(targetColor);
      arrowMat.opacity = mat.opacity;

      // Place arrowhead 85% of the way along the edge (near target, not overlapping node)
      arrowMesh.position.set(
        src.x + (tgt.x - src.x) * 0.85,
        src.y + (tgt.y - src.y) * 0.85,
        src.z + (tgt.z - src.z) * 0.85,
      );

      // Rotate cone to point from source → target
      // THREE.ConeGeometry points up (+Y by default); align +Y with edge direction
      const dir = new THREE.Vector3(tgt.x - src.x, tgt.y - src.y, tgt.z - src.z).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      arrowMesh.quaternion.setFromUnitVectors(up, dir);
    }
  });

  return (
    <>
      <primitive object={lineObj} />
      {arrowMesh && <primitive object={arrowMesh} />}
    </>
  );
}

/** Renders all edges in the tree with glowing lines, highlights prerequisite path on hover.
 *  depends_on and blocks edges include directional arrowhead cones at the target end. */
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
