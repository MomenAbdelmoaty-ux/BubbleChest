// ==================== SPLIT FROM events.ts (A1) ====================
// All game constants live here. Imported by both client and server.

// ---- Rap-battle beat constants ----
export const BPM = 80;
export const BEAT_STEPS = 8;
export const STEP_MS = 60000 / BPM / 2;
export const LOOP_MS = STEP_MS * BEAT_STEPS;

// ---- Gamemode 2 timing constants ----
export const GAME2_FIRST_FRAME_MS = 180_000;  // 180s for the very first frame
export const GAME2_FRAME_MS = 180_000;         // 180s for all other frames
export const GAME2_CAPTION_MS = 60_000;       // 60s to write a caption
export const GAME2_VOTE_ROUND_MS = 15_000;    // 15s per bracket round
export const GAME2_COMMENT_MS = 60_000;       // 60s to write a comment
export const GAME2_FPS = 8;                  // animation playback framerate
// comment voting duration = playerCount * 15s, computed at runtime

// ---- (A5) grace / buffer — every timed phase runs on this timeline (D = on-screen duration):
//   0 ── D ── D + INPUT_GRACE_MS ── D + INPUT_GRACE_MS + SERVER_BUFFER_MS
//   normal    grace: inputs still     dead window: inputs locked, auto-submits    server
//   play      editable, "Time's up"   already sent and in flight                  transitions
// INPUT_GRACE_MS: extra time after the countdown hits 0 where the player can still edit
//   and manually submit. At the end of it the client auto-submits and locks inputs.
// SERVER_BUFFER_MS: the server waits this long AFTER the input grace before moving on,
//   so auto-submits can arrive first (race-condition guard). Also used as the
//   "Get ready..." lead-in before the rap performance.
// Server timer per phase = D + INPUT_GRACE_MS + SERVER_BUFFER_MS. ----
export const INPUT_GRACE_MS = 2000;
// READING_DELAY_MS: window after the grace phase where the rapper sees the topic
// and "Get ready to rap..." before the carousel and beat start. Shared so the
// server's round-end timer accounts for it.
export const READING_DELAY_MS = 3000;
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
