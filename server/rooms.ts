import { randomUUID } from 'node:crypto';
// ---- NEW: PrepState import added alongside the existing Role/RoomPublic imports ----
import type { Role, RoomPublic, PrepState } from '../shared/events.js';

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
  prep?: PrepState; // ---- NEW: holds topic/couplets/beat once prep phase starts ----
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
const BEAT_STEPS = 8;
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
  if (!hostName.trim()) return { error: 'Name cannot be empty.' };

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
  if (!room) return { error: 'Room not found.' };
  if (room.status !== 'lobby') return { error: 'Game already in progress.' };
  if (Object.keys(room.players).length >= 4) return { error: 'Room is full.' };

  const playerId = randomUUID();
  room.players[playerId] = { playerId, name, role: null, socketId };
  socketToPlayer.set(socketId, { roomCode: room.code, playerId });
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
  if (!room) return { error: 'Room no longer exists.' };

  const player = room.players[playerId];
  if (!player) return { error: 'Player not found in this room.' };

  const pending = pendingRemovals.get(playerId);
  if (pending) {
    clearTimeout(pending);
    pendingRemovals.delete(playerId);
  }

  player.socketId = newSocketId;
  socketToPlayer.set(newSocketId, { roomCode: room.code, playerId });
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
  // ---- FIX: was `if (!room) return undefined;` — silently indistinguishable
  // from "room emptied out." Now a genuine error, since the caller asked to
  // leave a room that doesn't exist at all. ----
  if (!room) return { error: 'Room not found.' };
  // ---- FIX ABOVE ----

  delete room.players[playerId];

  if (Object.keys(room.players).length === 0) {
    rooms.delete(roomCode);
    return undefined; // normal outcome: nobody left in the room to notify
  }

  if (room.hostId === playerId) {
    const remainingIds = Object.keys(room.players);
    room.hostId = remainingIds[0]!;
  }

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
  // Genuinely no one to notify here — this connection is already gone, so
  // there's no error to surface to anyone; silently returning is correct.
  if (!entry) return;

  const { roomCode, playerId } = entry;

  const timer = setTimeout(() => {
    pendingRemovals.delete(playerId);
    const result = leaveRoom(roomCode, playerId);
    // ---- FIX: leaveRoom can now return a Room, an {error}, or undefined —
    // only broadcast when it's an actual Room; the other two cases have
    // nothing to broadcast for the same reason as above (no live players left,
    // or the room was already gone). ----
    if (result && !('error' in result)) {
      onKick(roomCode, result);
    }
    // ---- FIX ABOVE ----
  }, REJOIN_GRACE_PERIOD_MS);

  pendingRemovals.set(playerId, timer);
}

export function assignRoles(
  room: Room,
  // ---- NEW: extra parameter, called once the prep timer + grace period elapse ----
  onPrepEnd: (roomCode: string) => void
): { error: string } | void {
  const playerIds = Object.keys(room.players);
  if (playerIds.length !== 4) return { error: 'Need exactly 4 players to start.' };

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
  // ---- NEW: kick off the prep phase (timer + initial empty prep state) ----
  startPrepPhase(room, onPrepEnd);
  // ---- NEW ABOVE ----
}

// ==================== NEW SECTION BELOW: entire prep-phase system ====================
// Everything from here down (emptyBeatGrid, startPrepPhase, submitTopic,
// submitCouplets, submitBeat) is new — none of it existed before prep phase.

function emptyBeatGrid(): boolean[][] {
  return Array.from({ length: BEAT_ROWS }, () => Array.from({ length: BEAT_STEPS }, () => false));
}

function startPrepPhase(room: Room, onPrepEnd: (roomCode: string) => void): void {
  room.prep = {
    topic: '',
    coupletEndings: [],
    beatGrid: emptyBeatGrid(),
    submitted: { recordLabel: false, ghostwriter: false, producer: false },
    prepEndsAt: Date.now() + room.settings.prepTimerSeconds * 1000,
  };

  const totalMs = room.settings.prepTimerSeconds * 1000 + GRACE_PERIOD_MS;
  const timer = setTimeout(() => {
    prepTimers.delete(room.code);
    room.status = 'performance';
    onPrepEnd(room.code);
  }, totalMs);

  prepTimers.set(room.code, timer);
}

export function submitTopic(roomCode: string, topic: string): Room | { error: string } {
  const room = getRoom(roomCode);
  // ---- FIX: was `if (!room || !room.prep) return undefined;` — the caller
  // had no way to know WHY it failed, or that it failed at all. Now split
  // into two distinct, real error messages. ----
  if (!room) return { error: 'Room not found.' };
  if (!room.prep) return { error: 'Prep phase has not started yet.' };
  // ---- FIX ABOVE ----
  room.prep.topic = topic;
  room.prep.submitted.recordLabel = true;
  return room;
}

export function submitCouplets(roomCode: string, coupletEndings: string[]): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (!room.prep) return { error: 'Prep phase has not started yet.' };
  room.prep.coupletEndings = coupletEndings;
  room.prep.submitted.ghostwriter = true;
  return room;
}

export function submitBeat(roomCode: string, beatGrid: boolean[][]): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (!room.prep) return { error: 'Prep phase has not started yet.' };
  room.prep.beatGrid = beatGrid;
  room.prep.submitted.producer = true;
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
    ...(room.prep !== undefined && {
      prep: room.prep,
    }),
    // ---- NEW: include prep state in the broadcast-safe room ----
    numCouplets: room.settings.numCouplets, // ---- NEW: expose the real setting, was previously guessed client-side ----
  };
}
