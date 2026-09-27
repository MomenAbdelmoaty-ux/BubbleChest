// ==================== SPLIT FROM events.ts (A1) ====================
// All game constants live here. Imported by both client and server.

// ---- Rap-battle beat constants ----
export const BPM = 80;
export const BEAT_STEPS = 8;
export const STEP_MS = 60000 / BPM / 2;
export const LOOP_MS = STEP_MS * BEAT_STEPS;

// ---- Gamemode 2 timing constants ----
export const GAME2_FIRST_FRAME_MS = 120_000;  // 120s for the very first frame
export const GAME2_FRAME_MS = 60_000;         // 60s for all other frames
export const GAME2_CAPTION_MS = 30_000;       // 30s to write a caption
export const GAME2_VOTE_ROUND_MS = 10_000;    // 10s per bracket round
export const GAME2_COMMENT_MS = 45_000;       // 45s to write a comment
export const GAME2_FPS = 16;                  // animation playback framerate
// comment voting duration = playerCount * 15s, computed at runtime

// ---- NEW (A5): grace/buffer constants that replace the old GRACE_PERIOD_MS = 3000 ----
// INPUT_GRACE_MS: extra time after phaseEndsAt where inputs are still accepted
//   before the server transitions. Shown as "Time's up, submitting..." on the client.
// SERVER_BUFFER_MS: lead-in before audio/animation starts so clients can sync up.
// Together they replace every use of the old GRACE_PERIOD_MS.
export const INPUT_GRACE_MS = 2000;
export const SERVER_BUFFER_MS = 2000;
// ---- NEW ABOVE (A5) ----

// ---- NEW (A7): shared gameplay rules — replace scattered hardcoded literals ----
export const MIN_PLAYERS_TO_START = 4;
export const MAX_PLAYERS_RAP_BATTLE = 4;
export const MAX_PLAYERS_GAMEMODE2 = 8;
export const GAME2_TEXT_MAX_LEN = 300;
// ---- NEW ABOVE (A7) ----

// ---- NEW (B8): SAMPLES moved here from audio.ts so the server can derive
// BEAT_ROWS = SAMPLES.length, keeping grid size and audio labels in sync ----
export const SAMPLES: { file: string; label: string }[] = [
  { file: 'kick-big.wav',           label: 'Kick'   },
  { file: 'hihat-808.wav',          label: 'Hihat'  },
  { file: 'snare-808.wav',          label: 'Snare'  },
  { file: 'openhat-acoustic01.wav', label: 'Cymbal' },
];
// ---- NEW ABOVE (B8) ----
