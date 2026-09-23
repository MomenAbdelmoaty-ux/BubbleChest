// ==================== ENTIRE FILE IS NEW ====================
// Previously, the socket instance was created directly inside Lobby.tsx.
// It's pulled out into its own module here so PrepPhase.tsx (and any future
// phase component) can import the same shared connection, instead of each
// component accidentally creating its own separate socket.

import { io, type Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000';

export const socket: Socket = io(SERVER_URL);
