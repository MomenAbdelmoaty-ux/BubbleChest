import { randomUUID } from 'node:crypto';
// ---- NEW: import shared timing constants (BEAT_STEPS, LOOP_MS) so server
// and client always agree on beat/loop math ----
import type { Role, RoomPublic, PrepState } from '../shared/events.js';
import { BEAT_STEPS, LOOP_MS } from '../shared/events.js';
// ---- NEW ABOVE ----

interface Player {
  playerId: string;
  name: string;
  role: Role | null;
  socketId: string;
}

interface Room {
  code: string;
  mode: 'rap-battle';
  hostId: string;
  status: RoomPublic['status'];
  players: Record<string, Player>;
  settings: {
    prepTimerSeconds: number;
    numCouplets: number;
  };
  prep?: PrepState;
  performance?: { startAt: number }; // ---- NEW: set once performance phase begins ----
}

const rooms = new Map<string, Room>();

// Tracks which room/player each live connection currently represents, so that
// a raw 'disconnect' event (which only gives us a socket.id) can be resolved
// back into "which player, in which room, just disappeared." (pre-existing)
const socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();

// Tracks pending removal timers, keyed by playerId. A disconnect doesn't
// remove a player immediately — it schedules removal a few seconds out, so a
// page refresh (disconnect + near-instant rejoin) doesn't get treated as a
// real departure. rejoinRoom cancels the pending timer if one exists. (pre-existing)
const pendingRemovals = new Map<string, NodeJS.Timeout>();
const REJOIN_GRACE_PERIOD_MS = 10000;

// ---- NEW BELOW: prep-phase timer tracking + beat grid dimensions ----
const prepTimers = new Map<string, NodeJS.Timeout>();
const GRACE_PERIOD_MS = 3000; // the "ding" window after the timer hits zero
const BEAT_ROWS = 4;
// ---- CHANGED: BEAT_STEPS used to be declared here locally — now imported
// from shared/events.ts instead, so client and server can't drift apart ----
// ---- NEW ABOVE ----

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0, I/1 — avoid ambiguity

function generateRoomCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code)); // guard against (rare) collision
  return code;
}

export function createRoom(hostName: string, hostSocketId: string): { room: Room; playerId: string } | { error: string } {
  if (!hostName.trim()) {
    console.log(`[rooms] createRoom rejected: empty name`);
    return { error: 'Name cannot be empty.' };
  }

  const playerId = randomUUID();
  const code = generateRoomCode();

  const room: Room = {
    code,
    mode: 'rap-battle',
    hostId: playerId,
    status: 'lobby',
    players: {
      [playerId]: { playerId, name: hostName, role: null, socketId: hostSocketId },
    },
    settings: {
      prepTimerSeconds: 120,
      numCouplets: 8,
    },
  };

  rooms.set(code, room);
  socketToPlayer.set(hostSocketId, { roomCode: code, playerId });
  console.log(`[rooms] Room ${code} created by "${hostName}" (playerId ${playerId})`);
  return { room, playerId };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.trim().toUpperCase());
}

export function joinRoom(
  code: string,
  name: string,
  socketId: string
): { room: Room; playerId: string } | { error: string } {
  if (!name.trim()) return { error: 'Name cannot be empty.' };
  if (!code.trim()) return { error: 'Room code cannot be empty.' };

  const room = getRoom(code);
  if (!room) {
    console.log(`[rooms] joinRoom failed: "${code}" not found`);
    return { error: 'Room not found.' };
  }
  if (room.status !== 'lobby') {
    console.log(`[rooms] joinRoom failed: room ${code} already in progress (status=${room.status})`);
    return { error: 'Game already in progress.' };
  }
  if (Object.keys(room.players).length >= 4) {
    console.log(`[rooms] joinRoom failed: room ${code} is full`);
    return { error: 'Room is full.' };
  }

  const playerId = randomUUID();
  room.players[playerId] = { playerId, name, role: null, socketId };
  socketToPlayer.set(socketId, { roomCode: room.code, playerId });
  console.log(`[rooms] "${name}" joined room ${code} (playerId ${playerId}) — ${Object.keys(room.players).length}/4 players`);
  return { room, playerId };
}

/**
 * Re-attach an existing player (found via their previously-issued playerId,
 * stored client-side in sessionStorage) to their room after a refresh/reconnect.
 * Updates their socketId to the new connection, since socket.id is never stable
 * across reconnects — playerId is the one thing that persists.
 */
export function rejoinRoom(
  roomCode: string,
  playerId: string,
  newSocketId: string
): { room: Room; playerId: string } | { error: string } {
  const room = getRoom(roomCode);
  if (!room) {
    console.log(`[rooms] rejoinRoom failed: room ${roomCode} no longer exists`);
    return { error: 'Room no longer exists.' };
  }

  const player = room.players[playerId];
  if (!player) {
    console.log(`[rooms] rejoinRoom failed: playerId ${playerId} not found in room ${roomCode}`);
    return { error: 'Player not found in this room.' };
  }

  const pending = pendingRemovals.get(playerId);
  if (pending) {
    clearTimeout(pending);
    pendingRemovals.delete(playerId);
    console.log(`[rooms] rejoinRoom: cancelled pending removal for playerId ${playerId}`);
  }

  player.socketId = newSocketId;
  socketToPlayer.set(newSocketId, { roomCode: room.code, playerId });
  console.log(`[rooms] "${player.name}" rejoined room ${roomCode} (new socketId ${newSocketId})`);
  return { room, playerId };
}

/**
 * Remove a player from a room, whether triggered by an explicit "leave"
 * action or by their connection dropping. Returns the updated room to
 * broadcast; returns { error } if the room genuinely doesn't exist; returns
 * undefined specifically when the room just emptied out and was deleted —
 * that's an expected outcome, not a failure, so it isn't an error.
 */
export function leaveRoom(roomCode: string, playerId: string): Room | { error: string } | undefined {
  const room = getRoom(roomCode);
  if (!room) {
    console.log(`[rooms] leaveRoom failed: room ${roomCode} not found`);
    return { error: 'Room not found.' };
  }

  const leavingName = room.players[playerId]?.name ?? '(unknown)';
  delete room.players[playerId];

  if (Object.keys(room.players).length === 0) {
    rooms.delete(roomCode);
    console.log(`[rooms] "${leavingName}" left room ${roomCode} — room now empty, deleted`);
    return undefined;
  }

  if (room.hostId === playerId) {
    const remainingIds = Object.keys(room.players);
    room.hostId = remainingIds[0]!;
    console.log(`[rooms] host left room ${roomCode} — reassigned host to playerId ${room.hostId}`);
  }

  console.log(`[rooms] "${leavingName}" left room ${roomCode} — ${Object.keys(room.players).length} players remaining`);
  return room;
}

/**
 * Called from the server's 'disconnect' event handler. Doesn't remove the
 * player immediately — schedules removal REJOIN_GRACE_PERIOD_MS from now,
 * so a page refresh isn't treated as a real departure. Calls onKick if the
 * timer actually elapses without a rejoin cancelling it.
 */
export function handleDisconnect(
  socketId: string,
  onKick: (roomCode: string, room: Room) => void
): void {
  const entry = socketToPlayer.get(socketId);
  socketToPlayer.delete(socketId);
  if (!entry) {
    console.log(`[rooms] disconnect: socketId ${socketId} had no tracked player (already cleaned up, or never joined)`);
    return;
  }

  const { roomCode, playerId } = entry;
  console.log(`[rooms] disconnect: playerId ${playerId} in room ${roomCode} — starting ${REJOIN_GRACE_PERIOD_MS}ms grace timer`);

  const timer = setTimeout(() => {
    pendingRemovals.delete(playerId);
    console.log(`[rooms] grace period expired for playerId ${playerId} — removing from room ${roomCode}`);
    const result = leaveRoom(roomCode, playerId);
    if (result && !('error' in result)) {
      onKick(roomCode, result);
    }
  }, REJOIN_GRACE_PERIOD_MS);

  pendingRemovals.set(playerId, timer);
}

export function assignRoles(
  room: Room,
  // ---- CHANGED: renamed from onPrepEnd to onPhaseChange — this same
  // callback now fires at every server-driven phase transition (prep ending,
  // performance starting, performance ending), not just once ----
  onPhaseChange: (roomCode: string) => void
): { error: string } | void {
  const playerIds = Object.keys(room.players);
  if (playerIds.length !== 4) {
    console.log(`[rooms] assignRoles rejected for room ${room.code}: ${playerIds.length}/4 players`);
    return { error: 'Need exactly 4 players to start.' };
  }

  const roles: Role[] = ['record-label', 'ghostwriter', 'producer', 'rapper'];
  // Fisher-Yates shuffle
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j]!, roles[i]!];
  }

  playerIds.forEach((playerId, i) => {
    room.players[playerId]!.role = roles[i]!;
  });

  room.status = 'prep';
  console.log(`[rooms] Room ${room.code}: roles assigned — ${playerIds.map((id, i) => `${room.players[id]!.name}=${roles[i]}`).join(', ')}`);
  startPrepPhase(room, onPhaseChange);
}

// ==================== NEW SECTION BELOW: entire prep-phase system ====================
// Everything from here down (emptyBeatGrid, startPrepPhase, submitTopic,
// submitCouplets, submitBeat) is new — none of it existed before prep phase.

function emptyBeatGrid(): boolean[][] {
  return Array.from({ length: BEAT_ROWS }, () => Array.from({ length: BEAT_STEPS }, () => false));
}

function startPrepPhase(room: Room, onPhaseChange: (roomCode: string) => void): void {
  room.prep = {
    topic: '',
    coupletEndings: [],
    beatGrid: emptyBeatGrid(),
    submitted: { recordLabel: false, ghostwriter: false, producer: false },
    prepEndsAt: Date.now() + room.settings.prepTimerSeconds * 1000,
  };

  const totalMs = room.settings.prepTimerSeconds * 1000 + GRACE_PERIOD_MS;
  console.log(`[rooms] Room ${room.code}: prep phase started, ${totalMs}ms until forced advance`);

  const timer = setTimeout(() => {
    prepTimers.delete(room.code);
    console.log(`[rooms] Room ${room.code}: prep timer elapsed — starting performance phase`);
    startPerformancePhase(room, onPhaseChange);
  }, totalMs);

  prepTimers.set(room.code, timer);
}

// ==================== NEW SECTION BELOW: performance phase + round-end ====================

/**
 * Begins the performance phase: sets status + a startAt timestamp (a few
 * seconds in the future, giving every client's ROOM_UPDATE time to arrive
 * before playback needs to start — the same "shared future timestamp"
 * approach as prepEndsAt, just applied to audio/line-carousel sync instead
 * of a countdown). Schedules the round-end transition to fire automatically
 * once every couplet line has had its turn, regardless of anything else.
 */
function startPerformancePhase(room: Room, onPhaseChange: (roomCode: string) => void): void {
  room.status = 'performance';
  const startAt = Date.now() + 2000; // 2s buffer for broadcasts to land before playback begins
  room.performance = { startAt };

  const numCouplets = room.settings.numCouplets;
  const performanceMs = numCouplets * LOOP_MS;
  console.log(`[rooms] Room ${room.code}: performance phase starts at ${startAt}, running ${performanceMs}ms (${numCouplets} lines x ${LOOP_MS}ms/loop)`);

  onPhaseChange(room.code);

  setTimeout(() => {
    room.status = 'round-end';
    console.log(`[rooms] Room ${room.code}: performance finished — advancing to round-end`);
    onPhaseChange(room.code);
  }, 2000 + performanceMs);
}

/**
 * Resets a room back to the lobby: same players, roles cleared, prep and
 * performance data wiped, ready for a fresh Start Game. Triggered from the
 * round-end screen's "Return to Lobby" button — any player can trigger it.
 */
export function returnToLobby(roomCode: string): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) {
    console.log(`[rooms] returnToLobby failed: room ${roomCode} not found`);
    return { error: 'Room not found.' };
  }

  room.status = 'lobby';
  delete room.prep;
  delete room.performance;
  Object.values(room.players).forEach((p) => {
    p.role = null;
  });

  console.log(`[rooms] Room ${roomCode}: returned to lobby, roles cleared`);
  return room;
}

// ==================== NEW SECTION ABOVE ====================

export function submitTopic(roomCode: string, topic: string): Room | { error: string } {
  const room = getRoom(roomCode);
  // ---- FIX: was `if (!room || !room.prep) return undefined;` — the caller
  // had no way to know WHY it failed, or that it failed at all. Now split
  // into two distinct, real error messages. ----
  if (!room) {
    console.log(`[rooms] submitTopic failed: room ${roomCode} not found`);
    return { error: 'Room not found.' };
  }
  if (!room.prep) {
    console.log(`[rooms] submitTopic failed: room ${roomCode} not in prep phase`);
    return { error: 'Prep phase has not started yet.' };
  }
  // ---- FIX ABOVE ----
  room.prep.topic = topic;
  room.prep.submitted.recordLabel = true;
  console.log(`[rooms] Room ${roomCode}: topic submitted — "${topic}"`);
  return room;
}

export function submitCouplets(roomCode: string, coupletEndings: string[]): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) {
    console.log(`[rooms] submitCouplets failed: room ${roomCode} not found`);
    return { error: 'Room not found.' };
  }
  if (!room.prep) {
    console.log(`[rooms] submitCouplets failed: room ${roomCode} not in prep phase`);
    return { error: 'Prep phase has not started yet.' };
  }
  room.prep.coupletEndings = coupletEndings;
  room.prep.submitted.ghostwriter = true;
  console.log(`[rooms] Room ${roomCode}: couplets submitted — [${coupletEndings.join(', ')}]`);
  return room;
}

export function submitBeat(roomCode: string, beatGrid: boolean[][]): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) {
    console.log(`[rooms] submitBeat failed: room ${roomCode} not found`);
    return { error: 'Room not found.' };
  }
  if (!room.prep) {
    console.log(`[rooms] submitBeat failed: room ${roomCode} not in prep phase`);
    return { error: 'Prep phase has not started yet.' };
  }
  room.prep.beatGrid = beatGrid;
  room.prep.submitted.producer = true;
  console.log(`[rooms] Room ${roomCode}: beat grid submitted`);
  return room;
}

// ==================== NEW SECTION ABOVE ====================

export function toPublicRoom(room: Room): RoomPublic {
  return {
    code: room.code,
    status: room.status,
    players: Object.values(room.players).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      role: p.role,
      isHost: p.playerId === room.hostId,
    })),
    ...(room.prep !== undefined && { prep: room.prep }),
    ...(room.performance !== undefined && { performance: room.performance }), // ---- NEW ----
    numCouplets: room.settings.numCouplets,
  };
}
