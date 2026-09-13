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
  ERROR: 'room_error',
} as const;

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
  numCouplets: number; // ---- NEW: exposes room.settings.numCouplets to clients ----
}