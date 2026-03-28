"use client";

import { Suspense, useMemo, useRef, useEffect, useState, useCallback, startTransition } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { getNodeRender } from "@/types/skill-tree";
import { SkillNode3D, worldPositions } from "./SkillNode3D";
import { OrbitalRing } from "./OrbitalRing";
import { EdgeRenderer } from "./EdgeRenderer";
import { NodeDetailPanel } from "@/components/panel/NodeDetailPanel";
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

const IDLE_TIMEOUT_MS = 5000; // ms before ambient drift kicks in
const AMBIENT_ROTATE_SPEED = 0.3; // slow gentle drift

/** Syncs the orthographic camera frustum from the store's orthoZoom value each frame. */
function OrthoZoomSync() {
  const { camera, size } = useThree();
  const orthoZoom = useTreeStore((s) => s.orthoZoom);

  useFrame(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    const aspect = size.width / size.height;
    const half = orthoZoom;
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
  });

  return null;
}

function CameraController() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const focusTargetId = useTreeStore((s) => s.focusTargetId);
  const trackingNodeId = useTreeStore((s) => s.trackingNodeId);
  const topDownMode = useTreeStore((s) => s.topDownMode);
  const nodes = useTreeStore((s) => s.nodes);
  const setFocusTarget = useTreeStore((s) => s.setFocusTarget);
  const setTrackingNode = useTreeStore((s) => s.setTrackingNode);

  const flyToPos = useRef<THREE.Vector3 | null>(null);
  const flyToLookAt = useRef<THREE.Vector3 | null>(null);
  const isFlying = useRef(false);
  const lastTrackedPos = useRef<THREE.Vector3 | null>(null);
  const isTopDownFlying = useRef(false);
  const lastInteractionTime = useRef<number>(Date.now());

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

  // Track user interaction to reset idle timer
  useEffect(() => {
    function onInteract() {
      lastInteractionTime.current = Date.now();
    }
    const events = ["mousedown", "mousemove", "wheel", "touchstart", "keydown"];
    events.forEach((e) => window.addEventListener(e, onInteract, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onInteract));
  }, []);

  // Top-down mode: snap camera to overhead view when entering
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (topDownMode) {
      // Fly to top-down position
      const target = controls.target.clone();
      flyToPos.current = new THREE.Vector3(target.x, 80, target.z);
      flyToLookAt.current = target.clone();
      isTopDownFlying.current = true;
      isFlying.current = true;
    }
  }, [topDownMode]);

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

    const dist = ZOOM_DISTANCE[node.data.type ?? node.data.role] ?? 6;
    flyToLookAt.current = nodePos.clone();
    flyToPos.current = nodePos.clone().add(new THREE.Vector3(dist * 0.4, dist * 0.5, dist * 0.8));
    isFlying.current = true;
    lastTrackedPos.current = null; // reset so tracking starts fresh after fly-to

    // Enter tracking for all node types
    setTrackingNode(node.id);

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

    // --- Top-down mode: lock rotation, allow pan only (zoom via buttons) ---
    if (topDownMode) {
      // Keep camera directly above target at fixed height
      const target = controls.target;
      camera.position.set(target.x, 80, target.z);
      camera.lookAt(target);
      controls.enableRotate = false;
      controls.enableZoom = false; // zoom is handled by orthoZoom buttons
      controls.enablePan = true;
      controls.update();
      return;
    } else {
      controls.enableRotate = true;
      controls.enableZoom = true;
    }

    // --- Tracking mode: follow node as it orbits ---
    if (trackingNodeId) {
      const storeNode = nodes.find((n) => n.id === trackingNodeId);
      const livePos = worldPositions.get(trackingNodeId);

      const nodeX = livePos?.x ?? storeNode?.position[0] ?? 0;
      const nodeY = livePos?.y ?? storeNode?.position[1] ?? 0;
      const nodeZ = livePos?.z ?? storeNode?.position[2] ?? 0;
      const currentNodePos = new THREE.Vector3(nodeX, nodeY, nodeZ);

      if (lastTrackedPos.current) {
        // Shift camera and target by how much the node moved this frame
        const delta = currentNodePos.clone().sub(lastTrackedPos.current);
        camera.position.add(delta);
        controls.target.add(delta);
      }

      lastTrackedPos.current = currentNodePos.clone();
      controls.autoRotate = false;
      controls.enablePan = false;
    } else {
      lastTrackedPos.current = null;
      // Ambient drift: enable slow auto-rotation when idle
      const idle = Date.now() - lastInteractionTime.current > IDLE_TIMEOUT_MS;
      controls.autoRotate = idle;
      controls.autoRotateSpeed = AMBIENT_ROTATE_SPEED;
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



const STATUS_COLORS: Record<string, string> = {
  completed:   "#22c55e",
  in_progress: "#f59e0b",
  queued:      "#6366f1",
  backlog:     "#1e293b",
};

const BATCH_SIZE = 5;     // nodes per batch

const BATCH_GAP_MS = 100; // ms between batches


function StaggeredNodes({ nodes, nodeMap, onProgress }: {
  nodes: Node3D[];
  nodeMap: Map<string, Node3D>;
  onProgress: (loaded: number, total: number) => void;
}) {
  const treeSchema = useTreeStore((s) => s.treeSchema);
  const stellars = useMemo(() => nodes.filter((n) => {
    const render = treeSchema ? getNodeRender(treeSchema, (n.data.type ?? n.data.role) as string) : ((n.data.type ?? n.data.role) === "stellar" ? "star" : "planet");
    return render === "star";
  }), [nodes, treeSchema]);
  const planets = useMemo(() => nodes.filter((n) => {
    const render = treeSchema ? getNodeRender(treeSchema, (n.data.type ?? n.data.role) as string) : ((n.data.type ?? n.data.role) === "stellar" ? "star" : "planet");
    return render !== "star";
  }), [nodes, treeSchema]);
  const [mountedCount, setMountedCount] = useState(0);

  useEffect(() => {
    setMountedCount(0);
    onProgress(0, planets.length);
  }, [planets.length]);

  useEffect(() => {
    onProgress(mountedCount, planets.length);
    if (mountedCount >= planets.length) return;
    const timer = setTimeout(() => {
      startTransition(() => {
        setMountedCount((c) => Math.min(c + BATCH_SIZE, planets.length));
      });
    }, BATCH_GAP_MS);
    return () => clearTimeout(timer);
  }, [mountedCount, planets.length]);

  return (
    <>
      {stellars.map((node) => (
        <SkillNode3D key={node.id} node={node} parentMap={nodeMap} />
      ))}
      {planets.slice(0, mountedCount).map((node) => (
        <SkillNode3D key={node.id} node={node} parentMap={nodeMap} />
      ))}
    </>
  );
}

function Scene({ onProgress }: { onProgress: (loaded: number, total: number) => void }) {
  const nodes = useTreeStore((s) => s.nodes);
  const topDownMode = useTreeStore((s) => s.topDownMode);

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
      {topDownMode && (
        <>
          <OrthographicCamera makeDefault position={[0, 80, 0]} zoom={1} near={0.1} far={500} />
          <OrthoZoomSync />
        </>
      )}
      <Stars radius={80} depth={50} count={300} factor={3} saturation={0.3} fade speed={0} />

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

      <EdgeRenderer />

      <StaggeredNodes nodes={nodes} nodeMap={orbitalData.nodeMap} onProgress={onProgress} />
    </>
  );
}

export function SkillTreeCanvas() {
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const handleProgress = useCallback((loaded: number, total: number) => {
    if (loaded >= total) setLoadProgress(null);
    else setLoadProgress({ loaded, total });
  }, []);

  const hoveredNodeId = useTreeStore((s) => s.hoveredNodeId);
  const trackingNodeId = useTreeStore((s) => s.trackingNodeId);
  const pinnedNodeId = useTreeStore((s) => s.pinnedNodeId);
  const topDownMode = useTreeStore((s) => s.topDownMode);
  const orthoZoom = useTreeStore((s) => s.orthoZoom);
  const setTrackingNode = useTreeStore((s) => s.setTrackingNode);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const setTopDownMode = useTreeStore((s) => s.setTopDownMode);
  const setOrthoZoom = useTreeStore((s) => s.setOrthoZoom);
  const nodes = useTreeStore((s) => s.nodes);
  const hoveredNode = useMemo(
    () => nodes.find((n) => n.id === hoveredNodeId),
    [nodes, hoveredNodeId]
  );
  const trackingNode = useMemo(
    () => nodes.find((n) => n.id === trackingNodeId),
    [nodes, trackingNodeId]
  );
  const pinnedNode = useMemo(
    () => nodes.find((n) => n.id === pinnedNodeId),
    [nodes, pinnedNodeId]
  );

  // ESC also clears pin; T toggles top-down view
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPinnedNode(null);
      if (e.key === "t" || e.key === "T") {
        const active = (document.activeElement as HTMLElement);
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        setTopDownMode(!topDownMode);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setPinnedNode, setTopDownMode, topDownMode]);

  // Which node to show in detail panel: pinned > hovered
  const detailNode = pinnedNode ?? hoveredNode;

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 15, 30], fov: 60, near: 0.1, far: 300 }}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance", stencil: false, depth: true }}
        dpr={[1, 1]}
        frameloop="always"
        performance={{ min: 0.5 }}
        style={{ background: "#0a0e1a" }}
      >
        <Suspense fallback={null}>
          <Scene onProgress={handleProgress} />
        </Suspense>
        <CameraController />
      </Canvas>
      {/* Node loading progress overlay */}
      {loadProgress && (
        <div style={{
          position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
          zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
          background: "rgba(10,14,26,0.85)", border: "1px solid rgba(148,163,184,0.15)",
          borderRadius: 8, padding: "8px 16px", backdropFilter: "blur(8px)",
        }}>
          <div style={{ fontFamily: "monospace", fontSize: 10, color: "#64748b", letterSpacing: "0.08em" }}>
            LOADING NODES {loadProgress.loaded}/{loadProgress.total}
          </div>
          <div style={{ width: 160, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${Math.round((loadProgress.loaded / loadProgress.total) * 100)}%`,
              background: "linear-gradient(90deg, #6366f1, #818cf8)",
              transition: "width 0.1s ease",
            }} />
          </div>
        </div>
      )}

      {/* Orthographic pan/zoom controls — shown only in top-down mode */}
      {topDownMode && (
        <div className="absolute bottom-12 right-14 z-10 flex flex-col gap-1">
          <button
            onClick={() => setOrthoZoom(orthoZoom - 10)}
            title="Zoom in"
            className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold bg-slate-800/70 border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 transition-colors"
          >
            +
          </button>
          <button
            onClick={() => setOrthoZoom(orthoZoom + 10)}
            title="Zoom out"
            className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold bg-slate-800/70 border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 transition-colors"
          >
            −
          </button>
        </div>
      )}

      {detailNode && (
        <NodeDetailPanel
          node={detailNode}
          pinned={!!pinnedNode}
          onClose={() => setPinnedNode(null)}
        />
      )}
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

      {/* Top-down camera toggle */}
      <button
        onClick={() => setTopDownMode(!topDownMode)}
        title="Toggle top-down view"
        className={`absolute bottom-12 right-4 z-10 w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-colors border ${
          topDownMode
            ? "bg-indigo-600 border-indigo-400 text-white"
            : "bg-slate-800/70 border-slate-600 text-slate-400 hover:text-white hover:border-slate-400"
        }`}
      >
        ⊤
      </button>

      <div className="absolute bottom-4 left-4 text-[10px] text-slate-600 pointer-events-none">
        Click to zoom &amp; pin details · Space to toggle status · / to search · T for top-down · ESC to unpin
      </div>
    </div>
  );
}
