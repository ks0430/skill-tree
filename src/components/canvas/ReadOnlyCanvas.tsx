"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { SkillNode3D } from "./SkillNode3D";
import { OrbitalRing } from "./OrbitalRing";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
import { sharedGeo } from "./SkillTreeCanvas";

// Re-export sharedGeo so SkillNode3D still sees it (it's the same object)
export { sharedGeo };

function Scene() {
  const nodes = useTreeStore((s) => s.nodes);

  const orbitalData = useMemo(() => {
    const nodeMap = new Map<string, Node3D>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    const ringSet = new Map<string, { parentId: string; radius: number; tilt: number }>();
    nodes.forEach((n) => {
      if (n.data.parent_id && n.orbitRadius > 0) {
        const rKey = Math.round(n.orbitRadius * 10);
        const key = `${n.data.parent_id}-${rKey}`;
        if (!ringSet.has(key)) {
          ringSet.set(key, { parentId: n.data.parent_id, radius: n.orbitRadius, tilt: n.orbitTilt });
        }
      }
    });

    return { nodeMap, rings: Array.from(ringSet.values()) };
  }, [nodes]);

  return (
    <>
      <Stars radius={80} depth={50} count={800} factor={3} saturation={0.3} fade speed={0} />
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-10, -5, -10]} intensity={0.5} color="#8b9cf6" />
      <pointLight position={[0, -10, 5]} intensity={0.3} color="#ffffff" />

      {orbitalData.rings.map((ring) => {
        const parent = orbitalData.nodeMap.get(ring.parentId);
        if (!parent) return null;
        return (
          <OrbitalRing
            key={`orbit-${ring.parentId}-${Math.round(ring.radius * 10)}`}
            parentPosition={parent.position}
            radius={ring.radius}
            tilt={ring.tilt}
            parentRole={(parent.data.type ?? parent.data.role) as "stellar" | "planet" | "satellite"}
          />
        );
      })}

      {nodes.map((node) => (
        <SkillNode3D key={node.id} node={node} parentMap={orbitalData.nodeMap} readOnly />
      ))}
    </>
  );
}

export function ReadOnlyCanvas() {
  const hoveredNodeId = useTreeStore((s) => s.hoveredNodeId);
  const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const nodes = useTreeStore((s) => s.nodes);

  const hoveredNode = useMemo(() => nodes.find((n) => n.id === hoveredNodeId), [nodes, hoveredNodeId]);
  const pinnedNode = useMemo(() => nodes.find((n) => n.id === pinnedNodeId), [nodes, pinnedNodeId]);
  const detailNode = pinnedNode ?? hoveredNode;

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 15, 30], fov: 60, near: 0.1, far: 300 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", stencil: false, depth: true }}
        dpr={[1, 1.5]}
        frameloop="always"
        style={{ background: "#0a0e1a" }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
          minDistance={1}
          maxDistance={120}
          panSpeed={0.5}
        />
      </Canvas>

      {detailNode && (
        <NodeDetailPanel
          node={detailNode}
          pinned={!!pinnedNode}
          onClose={() => setPinnedNode(null)}
          readOnly
        />
      )}

      <div className="absolute bottom-4 left-4 text-[10px] text-slate-600 pointer-events-none">
        Click to view details · Read-only view
      </div>
    </div>
  );
}
