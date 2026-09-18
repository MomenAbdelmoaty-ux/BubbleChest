import { BEAT_STEPS, STEP_MS, LOOP_MS } from '../../shared/events';

export const SAMPLES: { file: string; label: string }[] = [
  { file: 'kick-big.wav',           label: 'Kick'   },
  { file: 'hihat-808.wav',          label: 'Hihat'  },
  { file: 'snare-808.wav',          label: 'Snare'  },
  { file: 'openhat-acoustic01.wav', label: 'Cymbal' },
];

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}
// ---- NEW: tracks all source nodes scheduled by previewLoop so they can
// be stopped early (e.g. when Preview is pressed again, or prep phase ends) ----
const activePreviewSources: AudioBufferSourceNode[] = [];

export function stopPreview(): void {
  const ctx = audioCtx;
  if (!ctx) return;
  console.log(activePreviewSources.length);
  activePreviewSources.forEach((source) => {
    try {
      source.stop();
    } catch {
      // stop() throws if the source already finished — safe to ignore
    }
  });
  activePreviewSources.length = 0; // clear the array in place
  console.log('[audio] preview stopped');
}
// ---- NEW ABOVE ----

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

function playBuffer(ctx: AudioContext, buffer: AudioBuffer, whenSeconds: number, trackIn?: AudioBufferSourceNode[]): void {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(whenSeconds);
  if (trackIn) trackIn.push(source);
}

// ---- NEW: plays a single instrument hit immediately, used when the
// Producer toggles a cell from false to true so they get instant audio
// feedback about what that instrument sounds like. ----
export async function playOnce(rowIndex: number): Promise<void> {
  const ctx = getAudioContext();
  await ctx.resume();
  const sample = SAMPLES[rowIndex];
  if (!sample) return;
  const buffer = await loadSample(ctx, sample.file);
  if (!buffer) return;
  playBuffer(ctx, buffer, ctx.currentTime + 0.01); // tiny offset to avoid click artifacts
  console.log(`[audio] preview hit: ${sample.label}`);
}
// ---- NEW ABOVE ----

// ---- NEW: plays exactly one full loop of the current grid state immediately.
// Called by the Producer's "Preview" button. Any grid changes made WHILE the
// preview is playing don't affect the already-scheduled audio — they just
// update the grid state for the next time Preview or Submit is called. ----
export async function previewLoop(beatGrid: boolean[][]): Promise<void> {
  stopPreview();
  const ctx = getAudioContext();
  await ctx.resume();

  const buffers = await Promise.all(
    SAMPLES.map(({ file }) => loadSample(ctx, file))
  );

  const startTime = ctx.currentTime + 0.05; // tiny buffer so first hits don't clip

  for (let step = 0; step < BEAT_STEPS; step++) {
    const stepTimeSeconds = startTime + (step * STEP_MS) / 1000;
    beatGrid.forEach((row, rowIndex) => {
      const buffer = buffers[rowIndex];
      if (row[step] && buffer) {
        playBuffer(ctx, buffer, stepTimeSeconds, activePreviewSources);
      }
    });
  }

  console.log('[audio] previewing one loop');
}
// ---- NEW ABOVE ----

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
