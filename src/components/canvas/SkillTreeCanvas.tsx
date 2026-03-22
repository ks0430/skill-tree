"use client";

import { Suspense, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { SkillNode3D } from "./SkillNode3D";
import { OrbitalRing } from "./OrbitalRing";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { SearchPanel } from "./SearchPanel";

const sharedGeo = {
  planet: new THREE.SphereGeometry(0.6, 24, 24),
  clouds: new THREE.SphereGeometry(0.63, 24, 24),
  atmosphere: new THREE.SphereGeometry(0.7, 16, 16),
  corona: new THREE.SphereGeometry(0.9, 12, 12),
  ring: new THREE.RingGeometry(0.8, 1.3, 32),
  statusRing: new THREE.RingGeometry(0.72, 0.76, 24),
};
export { sharedGeo };

// Smoothly fly camera to a target node
function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const focusTargetId = useTreeStore((s) => s.focusTargetId);
  const nodes = useTreeStore((s) => s.nodes);
  const setFocusTarget = useTreeStore((s) => s.setFocusTarget);

  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLookAt = useRef<THREE.Vector3 | null>(null);
  const isAnimating = useRef(false);

  // Zoom distance based on role
  const ZOOM_DISTANCE: Record<string, number> = {
    stellar: 12,
    planet: 4,
    satellite: 2,
  };

  useEffect(() => {
    if (!focusTargetId) return;
    const node = nodes.find((n) => n.id === focusTargetId);
    if (!node) return;

    // Use the node's live world position if orbiting, otherwise initial position
    const { worldPositions } = require("./SkillNode3D");
    const livePos = worldPositions.get(node.id);
    const nodePos = livePos
      ? new THREE.Vector3(livePos.x, livePos.y, livePos.z)
      : new THREE.Vector3(...node.position);

    const dist = ZOOM_DISTANCE[node.data.role] ?? 6;

    // Position camera offset from node (slightly above and to the side)
    const offset = new THREE.Vector3(dist * 0.4, dist * 0.5, dist * 0.8);
    targetPos.current = nodePos.clone().add(offset);
    targetLookAt.current = nodePos.clone();
    isAnimating.current = true;

    const timer = setTimeout(() => setFocusTarget(null), 100);
    return () => clearTimeout(timer);
  }, [focusTargetId, nodes, setFocusTarget]);

  useFrame(() => {
    if (!isAnimating.current) return;
    if (!targetPos.current || !targetLookAt.current) return;

    // Lerp camera position
    camera.position.lerp(targetPos.current, 0.05);

    // Lerp orbit controls target (look-at point)
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, 0.05);
      controlsRef.current.update();
    }

    // Stop when close enough
    if (camera.position.distanceTo(targetPos.current) < 0.1) {
      isAnimating.current = false;
      targetPos.current = null;
      targetLookAt.current = null;
    }
  });

  return <OrbitControls
    ref={controlsRef}
    enableDamping
    dampingFactor={0.05}
    rotateSpeed={0.5}
    zoomSpeed={0.8}
    minDistance={1}
    maxDistance={120}
    enablePan
    panSpeed={0.5}
  />;
}

function Scene() {
  const nodes = useTreeStore((s) => s.nodes);

  const orbitalData = useMemo(() => {
    const nodeMap = new Map<string, Node3D>();
    nodes.forEach((n) => nodeMap.set(n.id, n));

    // Deduplicate orbital rings: one ring per unique (parent, radius) pair
    const ringSet = new Map<string, { parentId: string; radius: number; tilt: number }>();
    nodes.forEach((n) => {
      if (n.data.parent_id && n.orbitRadius > 0) {
        // Round radius to avoid near-duplicates
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

      {/* Deduplicated orbital rings */}
      {orbitalData.rings.map((ring) => {
        const parent = orbitalData.nodeMap.get(ring.parentId);
        if (!parent) return null;
        return (
          <OrbitalRing
            key={`orbit-${ring.parentId}-${Math.round(ring.radius * 10)}`}
            parentPosition={parent.position}
            radius={ring.radius}
            tilt={ring.tilt}
            parentRole={parent.data.role}
          />
        );
      })}

      {/* Render order: stellars first (so they're behind), then planets, then satellites */}
      {nodes.map((node) => (
        <SkillNode3D key={node.id} node={node} parentMap={orbitalData.nodeMap} />
      ))}
    </>
  );
}

export function SkillTreeCanvas() {
  const hoveredNodeId = useTreeStore((s) => s.hoveredNodeId);
  const nodes = useTreeStore((s) => s.nodes);
  const hoveredNode = useMemo(
    () => nodes.find((n) => n.id === hoveredNodeId),
    [nodes, hoveredNodeId]
  );

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
        <CameraController />
      </Canvas>

      {hoveredNode && <NodeDetailPanel node={hoveredNode} />}
      <SearchPanel />

      <div className="absolute bottom-4 left-4 text-[10px] text-slate-600 pointer-events-none">
        Click node to zoom · Double-click to change status · Scroll to zoom · / to search
      </div>
    </div>
  );
}
