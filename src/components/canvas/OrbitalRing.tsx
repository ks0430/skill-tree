"use client";

import { useMemo, memo } from "react";
import { Line } from "@react-three/drei";

interface OrbitalRingProps {
  parentPosition: [number, number, number];
  radius: number;
  tilt: number;
  parentType: string;
}

export const OrbitalRing = memo(function OrbitalRing({
  parentPosition,
  radius,
  tilt,
  parentType,
}: OrbitalRingProps) {
  const points = useMemo(() => {
    const segments = 64;
    const pts: [number, number, number][] = [];
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      // Apply tilt: rotate around X axis
      pts.push([x, z * sinT, z * cosT]);
    }
    return pts;
  }, [radius, tilt]);

  const opacity = parentType === "stellar" ? 0.08 : 0.05;

  return (
    <group position={parentPosition}>
      <Line
        points={points}
        color="#ffffff"
        lineWidth={0.5}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </group>
  );
});
