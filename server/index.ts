import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createRoom, getRoom, joinRoom, rejoinRoom, assignRoles, toPublicRoom, leaveRoom, handleDisconnect, submitTopic, submitBeat, submitCouplets } from './rooms.js';
import { SOCKET_EVENTS } from '../shared/events.js';

const app = express();
app.use(express.static('public'));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

io.on('connection', (socket: Socket) => {
  console.log('A player connected:', socket.id);

  // This is the block that goes inside your existing io.on('connection', (socket) => { ... })
// in server/index.ts. Add these imports at the top of that file:
//
// import { createRoom, getRoom, joinRoom, rejoinRoom, leaveRoom, handleDisconnect, assignRoles, submitTopic, submitCouplets, submitBeat, toPublicRoom } from './rooms.js';
// import { SOCKET_EVENTS } from '../shared/events.js';

socket.on(SOCKET_EVENTS.CREATE_ROOM, ({ name }: { name: string }) => {
  const result = createRoom(name, socket.id);
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
  // ---- FIX: leaveRoom now returns Room | {error} | undefined instead of
  // just Room | undefined. Previously a missing room was silently ignored;
  // now it's surfaced as a real error to whoever tried to leave. ----
  if (result && 'error' in result) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
    return;
  }
  if (result) {
    io.to(result.code).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(result));
  }
  // if result is undefined here, the room just emptied out — nobody left to
  // notify, which is a normal outcome, not an error.
  // ---- FIX ABOVE ----
});

socket.on('disconnect', () => {
  handleDisconnect(socket.id, (roomCode, room) => {
    io.to(roomCode).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(room));
  });
});

socket.on(SOCKET_EVENTS.START_GAME, ({ code }: { code: string }) => {
  const room = getRoom(code);
  // ---- FIX: was `if (!room) return;` — the host clicking Start Game for a
  // room that's somehow gone (e.g. it emptied out and got deleted) got no
  // feedback at all. Now emits a real error instead of doing nothing. ----
  if (!room) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found.' });
    return;
  }
  // ---- FIX ABOVE ----

  const result = assignRoles(room, (roomCode) => {
    const finishedRoom = getRoom(roomCode);
    if (finishedRoom) {
      io.to(roomCode).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(finishedRoom));
    }
  });
  if (result && 'error' in result) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
    return;
  }

  io.to(room.code).emit(SOCKET_EVENTS.ROLES_ASSIGNED, toPublicRoom(room));
});

// Prep-phase submission handlers. Each stores the data via rooms.ts, then
// broadcasts the updated room to everyone in it (so "Submitted ✓" indicators
// and the countdown stay in sync across all 4 tabs).

socket.on(SOCKET_EVENTS.SUBMIT_TOPIC, ({ code, topic }: { code: string; topic: string }) => {
  const result = submitTopic(code, topic);
  // ---- FIX: was `if (room) { broadcast }` with no else — a failed
  // submission (room not found, or prep hasn't started) vanished with zero
  // feedback to the player who tried to submit. ----
  if ('error' in result) {
    socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
    return;
  }
  io.to(code).emit(SOCKET_EVENTS.PREP_UPDATE, toPublicRoom(result));
  // ---- FIX ABOVE ----
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



});

const PORT: number = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});