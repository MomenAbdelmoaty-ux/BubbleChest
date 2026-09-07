export const SOCKET_EVENTS = {
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  REJOIN_ROOM: 'rejoin_room',
  ROOM_UPDATE: 'room_update',
  START_GAME: 'start_game',
  ROLES_ASSIGNED: 'roles_assigned',
  ERROR: 'room_error',
  LEAVE_ROOM: 'leave_room',
} as const;

export type Role = 'rapper' | 'ghostwriter' | 'producer' | 'record-label';

export interface PlayerPublic {
  playerId: string;
  name: string;
  role: Role | null;
  isHost: boolean;
}

export interface RoomPublic {
  code: string;
  status: 'lobby' | 'prep' | 'grace' | 'performance' | 'round-end';
  players: PlayerPublic[];
}
