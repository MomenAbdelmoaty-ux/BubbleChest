// ---- CHANGED (A1+B8): BEAT_STEPS, STEP_MS, LOOP_MS from shared/constants;
// SAMPLES now imported from shared/constants instead of declared here ----
import { BEAT_STEPS, STEP_MS, LOOP_MS, SAMPLES } from '../../shared/constants';
// ---- CHANGED ABOVE (A1+B8) ----

// ---- CHANGED (B8): SAMPLES no longer declared here; imported from shared/constants ----
// The original local declaration has been removed so the server and client
// always agree on which rows/instruments exist.
export { SAMPLES };
// ---- CHANGED ABOVE (B8) ----

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

const bufferCache = new Map<string, AudioBuffer>();

async function loadSample(ctx: AudioContext, filename: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(filename);
  if (cached) return cached;

  try {
    const response = await fetch(`/sounds/${filename}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    bufferCache.set(filename, audioBuffer);
    console.log(`[audio] loaded sample: ${filename}`);
    return audioBuffer;
  } catch (err) {
    console.warn(`[audio] failed to load sample "${filename}":`, err);
    return null;
  }
}

function playBuffer(ctx: AudioContext, buffer: AudioBuffer, whenSeconds: number): void {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(whenSeconds);
}

export async function playOnce(rowIndex: number): Promise<void> {
  const ctx = getAudioContext();
  await ctx.resume();
  const sample = SAMPLES[rowIndex];
  if (!sample) return;
  const buffer = await loadSample(ctx, sample.file);
  if (!buffer) return;
  playBuffer(ctx, buffer, ctx.currentTime + 0.01);
  console.log(`[audio] preview hit: ${sample.label}`);
}

export async function previewLoop(beatGrid: boolean[][]): Promise<void> {
  const ctx = getAudioContext();
  await ctx.resume();

  const buffers = await Promise.all(
    SAMPLES.map(({ file }) => loadSample(ctx, file))
  );

  const startTime = ctx.currentTime + 0.05;

  for (let step = 0; step < BEAT_STEPS; step++) {
    const stepTimeSeconds = startTime + (step * STEP_MS) / 1000;
    beatGrid.forEach((row, rowIndex) => {
      const buffer = buffers[rowIndex];
      if (row[step] && buffer) {
        playBuffer(ctx, buffer, stepTimeSeconds);
      }
    });
  }

  console.log('[audio] previewing one loop');
}

export async function schedulePlayback(
  beatGrid: boolean[][],
  startAtEpochMs: number,
  totalLoops: number
): Promise<void> {
  const ctx = getAudioContext();
  await ctx.resume();

  const buffers = await Promise.all(
    SAMPLES.map(({ file }) => loadSample(ctx, file))
  );

  const msUntilStart = startAtEpochMs - Date.now();
  const ctxStartTime = ctx.currentTime + Math.max(0, msUntilStart) / 1000;

  for (let loop = 0; loop < totalLoops; loop++) {
    for (let step = 0; step < BEAT_STEPS; step++) {
      const stepTimeSeconds = ctxStartTime + (loop * LOOP_MS + step * STEP_MS) / 1000;
      beatGrid.forEach((row, rowIndex) => {
        const buffer = buffers[rowIndex];
        if (row[step] && buffer) {
          playBuffer(ctx, buffer, stepTimeSeconds);
        }
      });
    }
  }

  console.log(`[audio] scheduled ${totalLoops} loops of ${SAMPLES.length} instruments starting at epoch ${startAtEpochMs}`);
}
