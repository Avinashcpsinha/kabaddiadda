/**
 * Tiny Web Audio beep utility for the scoring console — raid timer warnings.
 * No external sound files; oscillator-generated tones.
 *
 * Browsers require a user gesture before audio can play. The first call to
 * `prime()` (typically from a button click) creates and unlocks the context.
 */

type Ctx = AudioContext & { resume?: () => Promise<void> };

let ctx: Ctx | null = null;

function ensureCtx(): Ctx | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume?.();
  return ctx;
}

/** Call from a user-gesture handler (button click) to unlock audio. */
export function primeAudio(): void {
  ensureCtx();
}

function beep(frequency: number, durationMs: number, gain = 0.25): void {
  const c = ensureCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gainNode = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gainNode.gain.setValueAtTime(gain, c.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, c.currentTime + durationMs / 1000);
  osc.connect(gainNode);
  gainNode.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + durationMs / 1000);
}

/** Single short mid-pitch tone — used at 15s remaining. */
export function beepWarn(): void {
  beep(440, 180);
}

/** Single short higher-pitch tone — used at 10s remaining. */
export function beepCaution(): void {
  beep(660, 180);
}

/** Two quick high beeps — used at 5s remaining. */
export function beepUrgent(): void {
  beep(880, 120);
  setTimeout(() => beep(880, 120), 200);
}

/** Long low horn — used at time-up. */
export function beepTimeUp(): void {
  beep(220, 700, 0.35);
}
