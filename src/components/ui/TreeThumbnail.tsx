"use client";

import { useEffect, useRef } from "react";

interface ThumbnailNode {
  id: string;
  type: string;
  parent_id: string | null;
  status: string;
}

interface TreeThumbnailProps {
  treeId: string;
  nodes: ThumbnailNode[];
  width?: number;
  height?: number;
  className?: string;
}

// Deterministic hash for stable positions
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Simple pseudo-random from seed
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function TreeThumbnail({ treeId, nodes, width = 160, height = 100, className }: TreeThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // HiDPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const cx = width / 2;
    const cy = height / 2;

    // --- Background ---
    ctx.fillStyle = "#080d1a";
    ctx.fillRect(0, 0, width, height);

    // Subtle vignette
    const vig = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.6);
    vig.addColorStop(0, "rgba(8,20,50,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, width, height);

    // --- Background stars ---
    const starRng = rng(hash(treeId + "stars"));
    const starCount = 40;
    for (let i = 0; i < starCount; i++) {
      const sx = starRng() * width;
      const sy = starRng() * height;
      const sr = starRng() * 0.8 + 0.2;
      const alpha = starRng() * 0.5 + 0.2;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,210,255,${alpha})`;
      ctx.fill();
    }

    const et = (n: ThumbnailNode) => n.type;
    const stellars = nodes.filter((n) => et(n) === "stellar");
    const planets = nodes.filter((n) => et(n) === "planet");

    if (stellars.length === 0) {
      // Empty state: dim nebula cloud hint
      const nebRng = rng(hash(treeId + "neb"));
      const nebX = cx + (nebRng() - 0.5) * 20;
      const nebY = cy + (nebRng() - 0.5) * 10;
      const neb = ctx.createRadialGradient(nebX, nebY, 0, nebX, nebY, 30);
      neb.addColorStop(0, "rgba(80,60,180,0.15)");
      neb.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    // Layout: distribute stellars across canvas with some spread
    const stellarRng = rng(hash(treeId + "lay"));

    // Place stellars
    type StellarPos = { id: string; x: number; y: number };
    const stellarPos: StellarPos[] = [];

    const maxStellars = Math.min(stellars.length, 5);
    const margin = 18;

    for (let i = 0; i < maxStellars; i++) {
      const s = stellars[i];
      // Spread them using a grid-like scatter
      let x: number, y: number;
      if (maxStellars === 1) {
        x = cx;
        y = cy;
      } else {
        // Polar layout: evenly spaced angles, random radii
        const angle = (i / maxStellars) * Math.PI * 2 + stellarRng() * 0.4;
        const maxR = Math.min(cx, cy) * 0.55;
        const r = maxR * (0.3 + stellarRng() * 0.5);
        x = cx + Math.cos(angle) * r;
        y = cy + Math.sin(angle) * r;
        x = Math.max(margin, Math.min(width - margin, x));
        y = Math.max(margin, Math.min(height - margin, y));
      }
      stellarPos.push({ id: s.id, x, y });
    }

    // Draw planets orbiting their stellars
    for (const sp of stellarPos) {
      const myPlanets = planets.filter((p) => p.parent_id === sp.id);
      if (myPlanets.length === 0) continue;

      const maxPlanets = Math.min(myPlanets.length, 6);
      const orbitR = 10 + maxPlanets * 2;

      // Orbit ring (very subtle)
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, orbitR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(100,130,200,0.12)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      for (let j = 0; j < maxPlanets; j++) {
        const p = myPlanets[j];
        const angle = (j / maxPlanets) * Math.PI * 2 + hash(p.id) * 0.1;
        const px = sp.x + Math.cos(angle) * orbitR;
        const py = sp.y + Math.sin(angle) * orbitR;

        // Planet color based on status
        let planetColor: string;
        if (p.status === "completed") planetColor = "rgba(60,220,130,0.9)";
        else if (p.status === "in_progress") planetColor = "rgba(255,180,40,0.9)";
        else planetColor = "rgba(80,100,160,0.7)";

        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = planetColor;
        ctx.fill();
      }
    }

    // Draw stellars on top
    for (let i = 0; i < maxStellars; i++) {
      const s = stellars[i];
      const sp = stellarPos[i];
      const baseR = 3.5;

      // Glow
      const glowR = baseR * 4;
      const glow = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, glowR);

      let glowColor: string;
      if (s.status === "completed") glowColor = "rgba(60,220,130";
      else if (s.status === "in_progress") glowColor = "rgba(255,200,60";
      else glowColor = "rgba(100,160,255";

      glow.addColorStop(0, `${glowColor},0.4)`);
      glow.addColorStop(1, `${glowColor},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, baseR, 0, Math.PI * 2);
      ctx.fillStyle =
        s.status === "completed" ? "#3ddc7c" :
        s.status === "in_progress" ? "#ffc840" : "#a0c0ff";
      ctx.fill();

      // Bright center
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, baseR * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fill();
    }
  }, [treeId, nodes, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className={className}
    />
  );
}
