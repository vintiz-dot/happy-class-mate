// Web Audio synthesised chime. No bundled asset, no network call.
// One context is reused across the app to avoid the per-tab limit.

type Ctx = AudioContext | null;
let ctx: Ctx = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  // Mobile browsers suspend the context until a user gesture.
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/**
 * Soft two-tone bell — "C5" then "G4" with exponential decay. Resonant
 * but not jarring; tested to be audible in a classroom without being
 * unpleasant when triggered repeatedly.
 */
export function playChime(): void {
  const c = getCtx();
  if (!c) return;

  const now = c.currentTime;
  const tones = [
    { freq: 523.25, start: 0, duration: 1.4 }, // C5
    { freq: 783.99, start: 0.12, duration: 1.6 }, // G5
  ];

  const master = c.createGain();
  master.gain.value = 0.0001;
  master.connect(c.destination);

  for (const t of tones) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = t.freq;

    // Quick attack, slow exponential release for a bell tone.
    const startTime = now + t.start;
    const endTime = startTime + t.duration;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.4, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

    osc.connect(gain);
    gain.connect(master);
    osc.start(startTime);
    osc.stop(endTime + 0.05);
  }

  // Master envelope so consecutive plays don't clip.
  master.gain.exponentialRampToValueAtTime(0.6, now + 0.05);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
}

/**
 * Lightweight click for spinner stops. Intentionally distinct from the
 * chime so it's never confused with the focus signal.
 */
export function playClick(): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "triangle";
  osc.frequency.value = 1200;
  const now = c.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}
