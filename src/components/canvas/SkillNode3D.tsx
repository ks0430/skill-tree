"use client";

import { useRef, useState, useMemo, useCallback, useEffect, memo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { createClient } from "@/lib/supabase/client";
import type { NodeStatus } from "@/types/skill-tree";

// ---------------------------------------------------------------------------
// UnlockParticles — burst that plays once when a node goes locked→in_progress
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 48;

interface UnlockParticlesProps {
  nodeScale: number;
  playing: boolean;
  onDone: () => void;
}

function UnlockParticles({ nodeScale, playing, onDone }: UnlockParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const startTimeRef = useRef<number | null>(null);
  const DURATION = 1.4; // seconds

  // Pre-compute per-particle velocity directions (unit sphere)
  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3); // unit direction vectors
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Start at node centre
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
      // Random direction on unit sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      vel[i * 3] = Math.sin(phi) * Math.cos(theta);
      vel[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
      vel[i * 3 + 2] = Math.cos(phi);
    }
    return { positions: pos, velocities: vel };
  }, []);

  const geoRef = useRef<THREE.BufferGeometry>(null);

  useEffect(() => {
    if (!geoRef.current) return;
    const posArr = new Float32Array(PARTICLE_COUNT * 3); // all zeros — at node centre
    geoRef.current.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current || !geoRef.current || !playing) return;

    if (startTimeRef.current === null) startTimeRef.current = clock.elapsedTime;
    const elapsed = clock.elapsedTime - startTimeRef.current;
    const t = Math.min(elapsed / DURATION, 1);

    // Update positions outward
    if (!geoRef.current.attributes.position) return;
    const posAttr = geoRef.current.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const speed = nodeScale * 3.5;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      posArr[i * 3]     = velocities[i * 3]     * speed * t;
      posArr[i * 3 + 1] = velocities[i * 3 + 1] * speed * t;
      posArr[i * 3 + 2] = velocities[i * 3 + 2] * speed * t;
    }
    posAttr.needsUpdate = true;

    // Fade out opacity
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, 1 - t);

    if (t >= 1) {
      startTimeRef.current = null;
      onDone();
    }
  });

  if (!playing) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geoRef} />
      <pointsMaterial
        size={nodeScale * 0.07}
        color="#ffcc44"
        transparent
        opacity={1}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
import {
  pickPlanetType,
  getPlanetConfig,
  generatePlanetTexture,
  generateCloudTexture,
  generateRingTexture,
} from "./planets";
import { sharedGeo } from "./SkillTreeCanvas";

function progressRingColor(progress: number): string {
  if (progress >= 1) return "#00ff88";
  if (progress >= 0.5) return "#ffdd00";
  return "#ff6644";
}

const STATUS_BRIGHTNESS: Record<
  NodeStatus,
  { opacity: number; emissive: number; atmosphere: number; cloudOpacity: number; ringOpacity: number; labelAlpha: number }
> = {
  locked:      { opacity: 0.3,  emissive: 0.0,  atmosphere: 0.02, cloudOpacity: 0.1,  ringOpacity: 0.1,  labelAlpha: 0.4 },
  in_progress: { opacity: 0.85, emissive: 0.25, atmosphere: 0.12, cloudOpacity: 0.5,  ringOpacity: 0.5,  labelAlpha: 0.85 },
  completed:   { opacity: 1.0,  emissive: 0.5,  atmosphere: 0.2,  cloudOpacity: 0.7,  ringOpacity: 0.7,  labelAlpha: 1.0 },
};

const STATUS_CYCLE: NodeStatus[] = ["locked", "in_progress", "completed"];

function idSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickPlanetForRole(id: string, role: string) {
  if (role === "stellar") return "sun";
  if (role === "satellite") return "moon";
  return pickPlanetType(id);
}

// Global ref map so children can read parent's animated world position
const worldPositions = new Map<string, THREE.Vector3>();
export { worldPositions };

interface SkillNode3DProps {
  node: Node3D;
  parentMap: Map<string, Node3D>;
  readOnly?: boolean;
}

export const SkillNode3D = memo(function SkillNode3D({ node, parentMap, readOnly = false }: SkillNode3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const planetRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [unlockBurst, setUnlockBurst] = useState(false);
  const prevStatusRef = useRef<NodeStatus>(node.data.status);
  const toggleNodeStatus = useTreeStore((s) => s.toggleNodeStatus);
  const setHoveredNode = useTreeStore((s) => s.setHoveredNode);
  const setFocusTarget = useTreeStore((s) => s.setFocusTarget);
  const setPinnedNode = useTreeStore((s) => s.setPinnedNode);
  const isPinned = useTreeStore((s) => s.pinnedNodeId === node.id);
  const isSearchHighlight = useTreeStore((s) => s.searchHighlightId === node.id);
  const highlightStartRef = useRef<number | null>(null);
  const pulseRingRef = useRef<THREE.Mesh>(null);
  const statusGlowRef = useRef<THREE.Mesh>(null);

  const seed = useMemo(() => idSeed(node.id), [node.id]);
  const planetType = useMemo(() => pickPlanetForRole(node.id, node.data.type ?? node.data.role), [node.id, node.data.type, node.data.role]);
  const config = useMemo(() => getPlanetConfig(planetType), [planetType]);
  const brightness = STATUS_BRIGHTNESS[node.data.status];
  const parent = node.data.parent_id ? parentMap.get(node.data.parent_id) : null;

  interface Textures { surface?: THREE.CanvasTexture; clouds?: THREE.CanvasTexture; ring?: THREE.CanvasTexture; }
  const textures = useMemo<Textures>(() => {
    if (typeof window === "undefined") return {};
    const surface = new THREE.CanvasTexture(generatePlanetTexture(planetType, seed));
    surface.colorSpace = THREE.SRGBColorSpace;
    const result: Textures = { surface };
    if (config.hasClouds) {
      const c = new THREE.CanvasTexture(generateCloudTexture(seed));
      c.colorSpace = THREE.SRGBColorSpace;
      result.clouds = c;
    }
    if (config.hasRings) {
      result.ring = new THREE.CanvasTexture(generateRingTexture(config.ringColor, seed));
    }
    return result;
  }, [planetType, seed, config]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (planetRef.current) planetRef.current.rotation.y = t * config.rotationSpeed;
    if (cloudsRef.current) cloudsRef.current.rotation.y = t * config.rotationSpeed * 1.3;
    if (atmosphereRef.current) atmosphereRef.current.scale.setScalar(hovered ? 1.25 : 1.15);

    // Status glow: locked=none, in_progress=amber pulse, completed=green steady
    if (statusGlowRef.current) {
      const mat = statusGlowRef.current.material as THREE.MeshBasicMaterial;
      if (node.data.status === "completed") {
        mat.color.set("#00ff88");
        mat.opacity = 0.18 + Math.sin(t * 1.2) * 0.04;
        statusGlowRef.current.visible = true;
      } else if (node.data.status === "in_progress") {
        mat.color.set("#ffaa22");
        mat.opacity = 0.12 + Math.abs(Math.sin(t * 2.5)) * 0.22;
        statusGlowRef.current.visible = true;
      } else {
        statusGlowRef.current.visible = false;
      }
    }

    // Search highlight pulse: expand + fade ring over 2.5s
    if (pulseRingRef.current) {
      if (isSearchHighlight) {
        if (highlightStartRef.current === null) highlightStartRef.current = t;
        const elapsed = t - highlightStartRef.current;
        const duration = 2.5;
        const progress = Math.min(elapsed / duration, 1);
        // Pulse expands from 1x to 3x node scale, fades out
        const scale = node.scale * (1 + progress * 2);
        pulseRingRef.current.scale.setScalar(scale);
        const mat = pulseRingRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.7 * (1 - progress);
        pulseRingRef.current.visible = true;
      } else {
        highlightStartRef.current = null;
        pulseRingRef.current.visible = false;
      }
    }

    // Orbital motion — read parent's ANIMATED position from the global map
    if (groupRef.current && parent && node.orbitRadius > 0) {
      const parentWorldPos = worldPositions.get(parent.id);
      const px = parentWorldPos ? parentWorldPos.x : parent.position[0];
      const py = parentWorldPos ? parentWorldPos.y : parent.position[1];
      const pz = parentWorldPos ? parentWorldPos.z : parent.position[2];

      const angle = node.orbitAngle + t * node.orbitSpeed;
      const cosT = Math.cos(node.orbitTilt);
      const sinT = Math.sin(node.orbitTilt);

      // Orbit in XZ plane, tilted by orbitTilt around X axis
      const ox = Math.cos(angle) * node.orbitRadius;
      const oz = Math.sin(angle) * node.orbitRadius;

      groupRef.current.position.x = px + ox;
      groupRef.current.position.y = py + oz * sinT;
      groupRef.current.position.z = pz + oz * cosT;
    }

    // Write our world position so children can track us
    if (groupRef.current) {
      if (!worldPositions.has(node.id)) worldPositions.set(node.id, new THREE.Vector3());
      worldPositions.get(node.id)!.copy(groupRef.current.position);
    }
  });

  // Detect locked → in_progress transition and fire particle burst
  useEffect(() => {
    if (prevStatusRef.current === "locked" && node.data.status === "in_progress") {
      setUnlockBurst(true);
    }
    prevStatusRef.current = node.data.status;
  }, [node.data.status]);

  const supabase = useMemo(() => createClient(), []);

  // Space key toggles status while hovering (disabled in readOnly mode)
  useEffect(() => {
    if (readOnly) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && hovered) {
        e.preventDefault();
        const current = node.data.status;
        const idx = STATUS_CYCLE.indexOf(current);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        toggleNodeStatus(node.id);
        supabase.from("skill_nodes").update({ status: next }).eq("id", node.id).eq("tree_id", node.data.tree_id).then();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readOnly, hovered, node.id, node.data.status, node.data.tree_id, toggleNodeStatus, supabase]);

  const onPointerEnter = useCallback((e: any) => {
    e.stopPropagation();
    setHovered(true);
    setHoveredNode(node.id);
    document.body.style.cursor = "pointer";
  }, [node.id, setHoveredNode]);

  const onPointerLeave = useCallback(() => {
    setHovered(false);
    setHoveredNode(null);
    document.body.style.cursor = "auto";
  }, [setHoveredNode]);

  // Click → cycle status (locked → in_progress → completed) + persist to Supabase
  // In readOnly mode: only focus/pin, no status change
  const onClick = useCallback((e: any) => {
    e.stopPropagation();
    if (!readOnly) {
      const current = node.data.status;
      const idx = STATUS_CYCLE.indexOf(current);
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      toggleNodeStatus(node.id);
      supabase.from("skill_nodes").update({ status: next }).eq("id", node.id).eq("tree_id", node.data.tree_id).then();
    }
    setFocusTarget(node.id);
    setPinnedNode(isPinned ? null : node.id);
  }, [readOnly, node.id, node.data.status, node.data.tree_id, toggleNodeStatus, supabase, setFocusTarget, setPinnedNode, isPinned]);

  // Checklist progress
  const { checklistTotal, checklistDone } = useMemo(() => {
    const content = node.data.content;
    if (!content) return { checklistTotal: 0, checklistDone: 0 };
    let total = 0;
    let done = 0;
    for (const block of content.blocks) {
      if (block.type === "checklist") {
        total += block.items.length;
        done += block.items.filter((i) => i.checked).length;
      }
    }
    return { checklistTotal: total, checklistDone: done };
  }, [node.data.content]);

  const checklistProgress = checklistTotal > 0 ? checklistDone / checklistTotal : -1;

  const progressArcGeoRef = useRef<THREE.RingGeometry | null>(null);
  const progressArcGeo = useMemo(() => {
    progressArcGeoRef.current?.dispose();
    if (checklistProgress < 0) return null;
    const thetaLength = Math.max(0.001, checklistProgress * Math.PI * 2);
    const geo = new THREE.RingGeometry(0.68, 0.73, 64, 1, -Math.PI / 2, thetaLength);
    progressArcGeoRef.current = geo;
    return geo;
  }, [checklistProgress]);

  useEffect(() => () => { progressArcGeoRef.current?.dispose(); }, []);

  const ringTilt = useMemo(() => (seed % 40 + 15) * (Math.PI / 180), [seed]);
  const emissiveColor = config.atmosphereColor || "#ffffff";
  const effectiveType = node.data.type ?? node.data.role;
  const labelSize = effectiveType === "stellar" ? 0.3 : effectiveType === "planet" ? 0.18 : 0.12;
  const labelOffset = node.scale * -1.3;

  return (
    <group ref={groupRef} position={node.position}>
      {/* Invisible hit mesh — fixed size so hover scale-up doesn't cause shake */}
      <mesh
        geometry={sharedGeo.planet}
        scale={node.scale * 1.2}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
        visible={false}
      />
      <mesh
        ref={planetRef}
        geometry={sharedGeo.planet}
        scale={node.scale}
      >
        {textures.surface ? (
          <meshStandardMaterial
            map={textures.surface}
            emissive={config.emissive ? "#ff8800" : emissiveColor}
            emissiveIntensity={config.emissive ? 1.5 : hovered ? brightness.emissive + 0.4 : brightness.emissive}
            emissiveMap={config.emissive ? textures.surface : undefined}
            roughness={config.emissive ? 1 : 0.7}
            metalness={config.emissive ? 0 : 0.1}
            transparent
            opacity={brightness.opacity}
          />
        ) : (
          <meshStandardMaterial color="#333" />
        )}
      </mesh>

      {config.hasClouds && textures.clouds && (
        <mesh ref={cloudsRef} geometry={sharedGeo.clouds} scale={node.scale}>
          <meshStandardMaterial map={textures.clouds} transparent opacity={brightness.cloudOpacity} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {config.hasAtmosphere && (
        <mesh ref={atmosphereRef} geometry={sharedGeo.atmosphere} scale={node.scale}>
          <meshBasicMaterial color={config.atmosphereColor} transparent opacity={hovered ? 0.45 : brightness.atmosphere} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}

      {/* Hover glow ring — stable outline, no size change */}
      {hovered && (
        <mesh geometry={sharedGeo.atmosphere} scale={node.scale * 1.15}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.08} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}

      {/* Status glow: locked=none, in_progress=amber pulse, completed=green steady */}
      <mesh ref={statusGlowRef} geometry={sharedGeo.atmosphere} scale={node.scale * 1.35} visible={false}>
        <meshBasicMaterial color="#00ff88" transparent opacity={0} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* Search highlight pulse ring — expands and fades outward */}
      <mesh ref={pulseRingRef} geometry={sharedGeo.atmosphere} visible={false}>
        <meshBasicMaterial color="#88ddff" transparent opacity={0} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* Checklist progress ring */}
      {checklistProgress >= 0 && (
        <Billboard>
          {/* Background track */}
          <mesh geometry={sharedGeo.statusRing} scale={node.scale}>
            <meshBasicMaterial color="#ffffff" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {/* Progress arc */}
          {progressArcGeo && (
            <mesh geometry={progressArcGeo} scale={node.scale}>
              <meshBasicMaterial color={progressRingColor(checklistProgress)} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          )}
        </Billboard>
      )}

      {config.hasRings && textures.ring && (
        <mesh geometry={sharedGeo.ring} rotation={[ringTilt, 0, 0]} scale={node.scale}>
          <meshBasicMaterial map={textures.ring} transparent opacity={brightness.ringOpacity} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {config.emissive && (
        <mesh geometry={sharedGeo.corona} scale={node.scale}>
          <meshBasicMaterial color="#ffaa33" transparent opacity={brightness.emissive * 0.3} side={THREE.BackSide} depthWrite={false} />
        </mesh>
      )}

      <Billboard position={[0, labelOffset, 0]}>
        <Text
          fontSize={labelSize}
          color={`rgba(255,255,255,${brightness.labelAlpha})`}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#0a0e1a"
          maxWidth={5}
        >
          {node.data.label}
        </Text>
      </Billboard>

      {/* Unlock particle burst — plays once on locked → in_progress */}
      <UnlockParticles
        nodeScale={node.scale}
        playing={unlockBurst}
        onDone={() => setUnlockBurst(false)}
      />
    </group>
  );
});
