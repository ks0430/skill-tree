"use client";

import { Suspense, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { SkillNode3D, worldPositions } from "./SkillNode3D";
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

const ZOOM_DISTANCE: Record<string, number> = {
  stellar: 12,
  planet: 4,
  satellite: 2,
};

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const focusTargetId = useTreeStore((s) => s.focusTargetId);
  const trackingNodeId = useTreeStore((s) => s.trackingNodeId);
  const nodes = useTreeStore((s) => s.nodes);
  const setFocusTarget = useTreeStore((s) => s.setFocusTarget);
  const setTrackingNode = useTreeStore((s) => s.setTrackingNode);

  const flyToPos = useRef<THREE.Vector3 | null>(null);
  const flyToLookAt = useRef<THREE.Vector3 | null>(null);
  const isFlying = useRef(false);

  // ESC exits tracking mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && trackingNodeId) {
        setTrackingNode(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [trackingNodeId, setTrackingNode]);

  // Fly-to triggered by focusTargetId
  useEffect(() => {
    if (!focusTargetId) return;
    const node = nodes.find((n) => n.id === focusTargetId);
    if (!node) return;

    // Get position — prefer live animated position, fall back to initial
    const livePos = worldPositions.get(node.id);
    const nodePos = livePos
      ? new THREE.Vector3(livePos.x, livePos.y, livePos.z)
      : new THREE.Vector3(...node.position);

    const dist = ZOOM_DISTANCE[node.data.role] ?? 6;
    flyToLookAt.current = nodePos.clone();
    flyToPos.current = nodePos.clone().add(new THREE.Vector3(dist * 0.4, dist * 0.5, dist * 0.8));
    isFlying.current = true;

    // Stellar → enter tracking, otherwise clear tracking
    setTrackingNode(node.data.role === "stellar" ? node.id : null);

    const timer = setTimeout(() => setFocusTarget(null), 150);
    return () => clearTimeout(timer);
  }, [focusTargetId, nodes, setFocusTarget, setTrackingNode]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    // --- Fly-to animation (fast lerp) ---
    if (isFlying.current && flyToPos.current && flyToLookAt.current) {
      camera.position.lerp(flyToPos.current, 0.12);
      controls.target.lerp(flyToLookAt.current, 0.12);

      if (camera.position.distanceTo(flyToPos.current) < 0.2) {
        // Snap exactly
        camera.position.copy(flyToPos.current);
        controls.target.copy(flyToLookAt.current);
        isFlying.current = false;
        flyToPos.current = null;
        flyToLookAt.current = null;
      }
      controls.update();
      return;
    }

    // --- Tracking mode: lock on star + auto-orbit around it ---
    if (trackingNodeId) {
      const storeNode = nodes.find((n) => n.id === trackingNodeId);
      const livePos = worldPositions.get(trackingNodeId);

      // Get the star's current world position
      const starX = livePos?.x ?? storeNode?.position[0] ?? 0;
      const starY = livePos?.y ?? storeNode?.position[1] ?? 0;
      const starZ = livePos?.z ?? storeNode?.position[2] ?? 0;

      // Auto-orbit: camera circles the star in XZ plane
      const time = performance.now() * 0.0003; // slow orbit
      const orbitDist = camera.position.distanceTo(controls.target) || 12;
      const camHeight = camera.position.y - controls.target.y;

      // Set orbit center to the star
      controls.target.set(starX, starY, starZ);
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.5;
    } else {
      controls.autoRotate = false;
      controls.enablePan = true;
    }

    controls.update();
  });

  return <OrbitControls
    ref={controlsRef}
    enableDamping
    dampingFactor={0.05}
    rotateSpeed={0.5}
    zoomSpeed={0.8}
    minDistance={1}
    maxDistance={120}
    panSpeed={0.5}
  />;
}

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
            parentRole={parent.data.role}
          />
        );
      })}

      {nodes.map((node) => (
        <SkillNode3D key={node.id} node={node} parentMap={orbitalData.nodeMap} />
      ))}
    </>
  );
}

export function SkillTreeCanvas() {
  const hoveredNodeId = useTreeStore((s) => s.hoveredNodeId);
  const trackingNodeId = useTreeStore((s) => s.trackingNodeId);
  const setTrackingNode = useTreeStore((s) => s.setTrackingNode);
  const nodes = useTreeStore((s) => s.nodes);
  const hoveredNode = useMemo(
    () => nodes.find((n) => n.id === hoveredNodeId),
    [nodes, hoveredNodeId]
  );
  const trackingNode = useMemo(
    () => nodes.find((n) => n.id === trackingNodeId),
    [nodes, trackingNodeId]
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

      {/* Tracking mode indicator */}
      {trackingNode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 glass rounded-lg px-4 py-2 text-xs text-slate-300 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Tracking: {trackingNode.data.label}
          <button
            onClick={() => setTrackingNode(null)}
            className="text-slate-500 hover:text-white transition-colors ml-1"
          >
            ESC to exit
          </button>
        </div>
      )}

      <div className="absolute bottom-4 left-4 text-[10px] text-slate-600 pointer-events-none">
        Click to zoom · Press Space while hovering to toggle status · / to search
      </div>
    </div>
  );
}
