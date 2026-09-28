import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
// ---- CHANGED (A1): imports split across new shared files ----
// ---- CHANGED (B2): assignRoles → startGame ----
import {
  createRoom, getRoom, joinRoom, rejoinRoom,
  startGame,   // ---- CHANGED (B2) ----
  toPublicRoom, leaveRoom, handleDisconnect,
  submitTopic, submitBeat, submitCouplets,
  returnToLobby, submitFrame, submitCaption, submitVote,
  submitComment, submitCommentVote,
} from './rooms.js';
import { SOCKET_EVENTS } from '../shared/events.js';
import type { GameMode } from '../shared/types.js';
// ---- CHANGED ABOVE (A1) ----

const app = express();
app.use(express.static('../client/dist'));

app.get('*path', (_req, res) => {
  res.sendFile('index.html', { root: '../client/dist' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

// ---- NEW: named broadcast helpers so the same logic isn't repeated inline
// every time rooms.ts needs to push a phase transition to clients.
// broadcastRoomUpdate  → used by rap-battle flow (ROOM_UPDATE event)
// broadcastGame2Update → used by gamemode-2 flow (GAME2_UPDATE event)
// Both follow the same pattern: look up the latest room state and emit it. ----
function broadcastRoomUpdate(roomCode: string): void {
  const room = getRoom(roomCode);
  if (room) io.to(roomCode).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(room));
}

function broadcastGame2Update(roomCode: string): void {
  const room = getRoom(roomCode);
  if (room) io.to(roomCode).emit(SOCKET_EVENTS.GAME2_UPDATE, toPublicRoom(room));
}
// ---- NEW ABOVE ----

io.on('connection', (socket: Socket) => {
  console.log('[server] socket connected:', socket.id);

  socket.on(SOCKET_EVENTS.CREATE_ROOM, ({ name, mode }: { name: string; mode: GameMode }) => {
    const result = createRoom(name, socket.id, mode);
    if ('error' in result) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      return;
    }
    const { room, playerId } = result;
    socket.join(room.code);
    socket.emit(SOCKET_EVENTS.ROOM_UPDATE, { ...toPublicRoom(room), yourPlayerId: playerId });
  });

  socket.on(SOCKET_EVENTS.JOIN_ROOM, ({ code, name }: { code: string; name: string }) => {
    const result = joinRoom(code, name, socket.id);
    if ('error' in result) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      return;
    }
    const { room, playerId } = result;
    socket.join(room.code);
    socket.emit(SOCKET_EVENTS.ROOM_UPDATE, { ...toPublicRoom(room), yourPlayerId: playerId });
    socket.to(room.code).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(room));
  });

  socket.on(
    SOCKET_EVENTS.REJOIN_ROOM,
    ({ playerId, roomCode }: { playerId: string; roomCode: string }) => {
      const result = rejoinRoom(roomCode, playerId, socket.id);
      if ('error' in result) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
        return;
      }
      const { room } = result;
      socket.join(room.code);
      socket.emit(SOCKET_EVENTS.ROOM_UPDATE, { ...toPublicRoom(room), yourPlayerId: playerId });
    }
  );

  socket.on(SOCKET_EVENTS.LEAVE_ROOM, ({ code, playerId }: { code: string; playerId: string }) => {
    socket.leave(code);
    const result = leaveRoom(code, playerId);
    if (result && 'error' in result) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      return;
    }
    if (result) {
      io.to(result.code).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(result));
    }
  });

  socket.on('disconnect', () => {
    // Note: 'disconnect' is Socket.IO's own built-in event — not in SOCKET_EVENTS (D4)
    console.log('[server] socket disconnected:', socket.id);
    handleDisconnect(socket.id, (roomCode, room) => {
      io.to(roomCode).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(room));
    });
  });

  socket.on(SOCKET_EVENTS.START_GAME, ({ code }: { code: string }) => {
    const room = getRoom(code);
    if (!room) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found.' });
      return;
    }

    // ---- CHANGED (B2): startGame replaces assignRoles ----
    // ---- CHANGED (B3): broadcastRoom callback replaces onPhaseChange ----
    // ---- CHANGED: inline callback replaced with broadcastRoomUpdate helper ----
    const result = startGame(room, broadcastRoomUpdate);
    // ---- CHANGED ABOVE (B2+B3) ----

    if (result && 'error' in result) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      return;
    }

    io.to(room.code).emit(SOCKET_EVENTS.ROLES_ASSIGNED, toPublicRoom(room));
  });

  socket.on(SOCKET_EVENTS.SUBMIT_TOPIC, ({ code, topic }: { code: string; topic: string }) => {
    const result = submitTopic(code, topic);
    if ('error' in result) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      return;
    }
    io.to(code).emit(SOCKET_EVENTS.PREP_UPDATE, toPublicRoom(result));
  });

  socket.on(
    SOCKET_EVENTS.SUBMIT_COUPLETS,
    ({ code, coupletEndings }: { code: string; coupletEndings: string[] }) => {
      const result = submitCouplets(code, coupletEndings);
      if ('error' in result) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
        return;
      }
      io.to(code).emit(SOCKET_EVENTS.PREP_UPDATE, toPublicRoom(result));
    }
  );

  socket.on(
    SOCKET_EVENTS.SUBMIT_BEAT,
    ({ code, beatGrid }: { code: string; beatGrid: boolean[][] }) => {
      const result = submitBeat(code, beatGrid);
      if ('error' in result) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
        return;
      }
      io.to(code).emit(SOCKET_EVENTS.PREP_UPDATE, toPublicRoom(result));
    }
  );

  socket.on(SOCKET_EVENTS.RETURN_TO_LOBBY, ({ code }: { code: string }) => {
    const result = returnToLobby(code);
    if ('error' in result) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      return;
    }
    io.to(code).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(result));
  });

  socket.on(
    SOCKET_EVENTS.SUBMIT_FRAME,
    ({ code, playerId, frameBase64 }: { code: string; playerId: string; frameBase64: string }) => {
      console.log(`[server] SUBMIT_FRAME from ${playerId} in room ${code}`);
      // ---- CHANGED: pass broadcastGame2Update so phase transitions triggered by early
      // frame submission (caption, voting, commenting, results) are broadcast to clients ----
      const result = submitFrame(code, playerId, frameBase64, broadcastGame2Update);
      // ---- CHANGED ABOVE ----
      if ('error' in result) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
        return;
      }
      io.to(code).emit(SOCKET_EVENTS.GAME2_UPDATE, toPublicRoom(result));
    }
  );

  socket.on(
    SOCKET_EVENTS.SUBMIT_CAPTION,
    ({ code, playerId, text }: { code: string; playerId: string; text: string }) => {
      console.log(`[server] SUBMIT_CAPTION from ${playerId} in room ${code}`);
      const result = submitCaption(code, playerId, text);
      if ('error' in result) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
        return;
      }
      io.to(code).emit(SOCKET_EVENTS.GAME2_UPDATE, toPublicRoom(result));
    }
  );

  socket.on(
    SOCKET_EVENTS.SUBMIT_VOTE,
    ({ code, playerId, vote }: { code: string; playerId: string; vote: 'A' | 'B' }) => {
      console.log(`[server] SUBMIT_VOTE from ${playerId} in room ${code}: ${vote}`);
      const result = submitVote(code, playerId, vote);
      if ('error' in result) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
        return;
      }
      io.to(code).emit(SOCKET_EVENTS.GAME2_UPDATE, toPublicRoom(result));
    }
  );

  socket.on(
    SOCKET_EVENTS.SUBMIT_COMMENT,
    ({ code, playerId, text }: { code: string; playerId: string; text: string }) => {
      console.log(`[server] SUBMIT_COMMENT from ${playerId} in room ${code}`);
      const result = submitComment(code, playerId, text);
      if ('error' in result) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
        return;
      }
      io.to(code).emit(SOCKET_EVENTS.GAME2_UPDATE, toPublicRoom(result));
    }
  );

  socket.on(
    SOCKET_EVENTS.SUBMIT_COMMENT_VOTE,
    ({ code, voterId, targetPlayerId, vote }: {
      code: string;
      voterId: string;
      targetPlayerId: string;
      vote: 'up' | 'down' | null;
    }) => {
      console.log(`[server] SUBMIT_COMMENT_VOTE from ${voterId} on ${targetPlayerId} in room ${code}: ${vote}`);
      const result = submitCommentVote(code, voterId, targetPlayerId, vote);
      if ('error' in result) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
        return;
      }
      io.to(code).emit(SOCKET_EVENTS.GAME2_UPDATE, toPublicRoom(result));
    }
  );
});

const PORT: number = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
