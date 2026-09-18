export const SOCKET_EVENTS = {
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  REJOIN_ROOM: 'rejoin_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_UPDATE: 'room_update',
  START_GAME: 'start_game',
  ROLES_ASSIGNED: 'roles_assigned',
  // ---- NEW BELOW: prep-phase socket events (topic/couplets/beat submissions,
  // plus a broadcast event to tell everyone a submission came in) ----
  SUBMIT_TOPIC: 'submit_topic',
  SUBMIT_COUPLETS: 'submit_couplets',
  SUBMIT_BEAT: 'submit_beat',
  PREP_UPDATE: 'prep_update',
  // ---- NEW ABOVE ----
  // ---- NEW: return-to-lobby event, fired from the round-end screen ----
  RETURN_TO_LOBBY: 'return_to_lobby',
  // ---- NEW ABOVE ----
  ERROR: 'room_error',
} as const;

// ---- NEW BELOW: shared beat-timing constants — used server-side to compute
// how long the performance phase should last, and client-side to schedule
// both audio playback and the line-carousel timing. Kept in one place so
// server and client can never disagree about the math. ----
export const BPM = 80;
export const BEAT_STEPS = 8;
export const STEP_MS = 60000 / BPM / 2; // eighth-note steps = 375ms at 80 BPM
export const LOOP_MS = STEP_MS * BEAT_STEPS; // one full 8-step loop = 3000ms
// ---- NEW ABOVE ----

export type Role = 'rapper' | 'ghostwriter' | 'producer' | 'record-label';

export interface PlayerPublic {
  playerId: string;
  name: string;
  role: Role | null;
  isHost: boolean;
}

// ---- NEW BELOW: shape of the prep-phase data (topic, couplet endings, beat
// grid, who's submitted, and the deadline timestamp clients count down to) ----
export interface PrepState {
  topic: string;
  coupletEndings: string[];
  beatGrid: boolean[][];
  submitted: { recordLabel: boolean; ghostwriter: boolean; producer: boolean };
  prepEndsAt: number; // epoch ms — client computes its own countdown from this
}
// ---- NEW ABOVE ----

export interface RoomPublic {
  code: string;
  status: 'lobby' | 'prep' | 'grace' | 'performance' | 'round-end';
  players: PlayerPublic[];
  prep?: PrepState;
  performance?: { startAt: number }; // ---- NEW: set once performance phase begins ----
  numCouplets: number;
}
