"use client";

import { useRef, useState, useMemo, useCallback, useEffect, memo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { useTreeStore, type Node3D } from "@/lib/store/tree-store";
import { createClient } from "@/lib/supabase/client";
import type { NodeStatus } from "@/types/skill-tree";
import {
  pickPlanetType,
  getPlanetConfig,
  generatePlanetTexture,
  generateCloudTexture,
  generateRingTexture,
} from "./planets";
import { sharedGeo } from "./SkillTreeCanvas";

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
}

export const SkillNode3D = memo(function SkillNode3D({ node, parentMap }: SkillNode3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const planetRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { toggleNodeStatus, setHoveredNode, setFocusTarget } = useTreeStore();

  const seed = useMemo(() => idSeed(node.id), [node.id]);
  const planetType = useMemo(() => pickPlanetForRole(node.id, node.data.role), [node.id, node.data.role]);
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

  const supabase = useMemo(() => createClient(), []);

  // Space key toggles status while hovering
  useEffect(() => {
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
  }, [hovered, node.id, node.data.status, node.data.tree_id, toggleNodeStatus, supabase]);

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

  // Click → zoom to this node
  const onClick = useCallback((e: any) => {
    e.stopPropagation();
    setFocusTarget(node.id);
  }, [node.id, setFocusTarget]);

  const ringTilt = useMemo(() => (seed % 40 + 15) * (Math.PI / 180), [seed]);
  const emissiveColor = config.atmosphereColor || "#ffffff";
  const labelSize = node.data.role === "stellar" ? 0.3 : node.data.role === "planet" ? 0.18 : 0.12;
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
        scale={hovered ? node.scale * 1.1 : node.scale}
      >
        {textures.surface ? (
          <meshStandardMaterial
            map={textures.surface}
            emissive={config.emissive ? "#ff8800" : emissiveColor}
            emissiveIntensity={config.emissive ? 1.5 : brightness.emissive}
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
          <meshBasicMaterial color={config.atmosphereColor} transparent opacity={hovered ? 0.3 : brightness.atmosphere} side={THREE.BackSide} depthWrite={false} />
        </mesh>
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
    </group>
  );
});
