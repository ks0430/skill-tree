/**
 * sfx.ts — Lightweight game sound effects using Web Audio API.
 * No external files needed. All sounds are synthesized.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  // Resume if suspended (browsers require user gesture first)
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  gainStart = 0.3,
  gainEnd = 0,
  startDelay = 0,
) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + startDelay);
  gain.gain.setValueAtTime(gainStart, c.currentTime + startDelay);
  gain.gain.exponentialRampToValueAtTime(Math.max(gainEnd, 0.001), c.currentTime + startDelay + duration);
  osc.start(c.currentTime + startDelay);
  osc.stop(c.currentTime + startDelay + duration);
}

/** Drag start — low thud */
export function sfxDragStart() {
  tone(120, 0.08, "square", 0.15, 0.01);
  tone(80,  0.12, "sine",   0.1,  0.01, 0.02);
}

/** Drop / place — satisfying click */
export function sfxDrop() {
  tone(300, 0.04, "square", 0.2, 0.01);
  tone(200, 0.08, "sine",   0.15, 0.01, 0.03);
  tone(400, 0.06, "sine",   0.1,  0.01, 0.05);
}

/** Panel open — soft whoosh up */
export function sfxPanelOpen() {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.12);
  gain.gain.setValueAtTime(0.12, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.15);
}

/** Panel close — soft whoosh down */
export function sfxPanelClose() {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(500, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(150, c.currentTime + 0.1);
  gain.gain.setValueAtTime(0.1, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.12);
}

/** Ticket complete — short victory chime */
export function sfxComplete() {
  tone(440, 0.1, "sine", 0.2, 0.01);
  tone(550, 0.1, "sine", 0.2, 0.01, 0.1);
  tone(660, 0.2, "sine", 0.2, 0.01, 0.2);
}

/** Error / denied */
export function sfxError() {
  tone(200, 0.08, "sawtooth", 0.15, 0.01);
  tone(150, 0.12, "sawtooth", 0.1,  0.01, 0.06);
}
