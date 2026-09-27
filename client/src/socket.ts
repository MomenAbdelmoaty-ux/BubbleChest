// Previously, the socket instance was created directly inside Lobby.tsx.
// It's pulled out into its own module here so PrepPhase.tsx (and any future
// phase component) can import the same shared connection, instead of each
// component accidentally creating its own separate socket.

// ---- NOTE (D2): for production, replace the hardcoded URL with an env var,
// e.g. import.meta.env.VITE_SERVER_URL — not required for local dev ----
import { io, type Socket } from 'socket.io-client';

export const socket: Socket = io('http://localhost:3000');
