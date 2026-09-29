// Previously, the socket instance was created directly inside Lobby.tsx.
// It's pulled out into its own module here so PrepPhase.tsx (and any future
// phase component) can import the same shared connection, instead of each
// component accidentally creating its own separate socket.
 
// ---- CHANGED (D2): connect to whatever origin served this page, instead of a
// hardcoded localhost:3000. This matters for two reasons:
//   1. A page loaded from a public tunnel URL (Cloudflare, ngrok, etc.) trying to
//      reach "localhost" is a public→private request, which browsers block behind
//      a permission prompt (iOS "Local Network", Chrome Private Network Access).
//   2. "localhost" is relative to whoever's browser is loading the page, so on any
//      device other than the one running the server it never points at the right
//      place at all.
// io() with no URL argument defaults to the page's own origin (protocol+host+port),
// so this only works when the same server that serves the built client (Express,
// on port 3000) also runs Socket.IO — which is the case here (see index.ts). If you
// tunnel port 3000, the tunnel forwards both the page and the socket connection to
// the same place, and no permission prompt is needed.
// If instead you're pointing a tunnel at Vite's dev server (5173), same-origin alone
// won't reach the Node server on 3000 — Vite would need a proxy for socket.io, or
// you'd tunnel 3000 directly (with `npm run build` output up to date). ----
import { io, type Socket } from 'socket.io-client';
 
export const socket: Socket = io(import.meta.env.VITE_SERVER_URL || undefined);