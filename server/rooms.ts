import { randomUUID } from 'node:crypto';
import type { Role, RoomPublic } from '../shared/events.js';

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
}

const rooms = new Map<string, Room>();

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
  return { room, playerId };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
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

  player.socketId = newSocketId;
  return { room, playerId };
}

export function assignRoles(room: Room): { error: string } | void {
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
}

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
  };
}

export function leaveRoom(roomCode: string, playerId: string): Room | undefined {
  const room = getRoom(roomCode);
  if (!room) return undefined;

  delete room.players[playerId];

  // if the room is now empty, remove it entirely so it doesn't linger forever
  if (Object.keys(room.players).length === 0) {
    rooms.delete(roomCode);
    return undefined;
  }

  // if the host left, promote the next player in line
  if (room.hostId === playerId) {
    const remainingIds = Object.keys(room.players);
    room.hostId = remainingIds[0]!;
  }

  return room;
}
