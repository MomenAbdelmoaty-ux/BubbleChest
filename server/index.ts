import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
// ---- CHANGED: added returnToLobby to imports ----
import { createRoom, getRoom, joinRoom, rejoinRoom, assignRoles, toPublicRoom, leaveRoom, handleDisconnect, submitTopic, submitBeat, submitCouplets, returnToLobby } from './rooms.js';
// ---- CHANGED ABOVE ----
import { SOCKET_EVENTS } from '../shared/events.js';

const app = express();
app.use(express.static('public'));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

io.on('connection', (socket: Socket) => {
  console.log('[server] socket connected:', socket.id);

  socket.on(SOCKET_EVENTS.CREATE_ROOM, ({ name }: { name: string }) => {
    const result = createRoom(name, socket.id);
    if ('error' in result) {
      console.error(`[server] emitting error to ${socket.id}: ${result.error}`);
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
      console.error(`[server] emitting error to ${socket.id}: ${result.error}`);
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
        console.error(`[server] emitting error to ${socket.id}: ${result.error}`);
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
      console.error(`[server] emitting error to ${socket.id}: ${result.error}`);
      socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      return;
    }
    if (result) {
      io.to(result.code).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(result));
    }
    // if result is undefined the room just emptied out — nobody left to notify
  });

  socket.on('disconnect', () => {
    console.log('[server] socket disconnected:', socket.id);
    handleDisconnect(socket.id, (roomCode, room) => {
      io.to(roomCode).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(room));
    });
  });

  socket.on(SOCKET_EVENTS.START_GAME, ({ code }: { code: string }) => {
    const room = getRoom(code);
    if (!room) {
      console.error(`[server] emitting error to ${socket.id}: Room not found.`);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Room not found.' });
      return;
    }

    const result = assignRoles(room, (roomCode) => {
      const finishedRoom = getRoom(roomCode);
      if (finishedRoom) {
        io.to(roomCode).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(finishedRoom));
      }
    });
    if (result && 'error' in result) {
      console.error(`[server] emitting error to ${socket.id}: ${result.error}`);
      socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      return;
    }

    io.to(room.code).emit(SOCKET_EVENTS.ROLES_ASSIGNED, toPublicRoom(room));
  });

  socket.on(SOCKET_EVENTS.SUBMIT_TOPIC, ({ code, topic }: { code: string; topic: string }) => {
    const result = submitTopic(code, topic);
    if ('error' in result) {
      console.error(`[server] emitting error to ${socket.id}: ${result.error}`);
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
        console.error(`[server] emitting error to ${socket.id}: ${result.error}`);
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
        console.error(`[server] emitting error to ${socket.id}: ${result.error}`);
        socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
        return;
      }
      io.to(code).emit(SOCKET_EVENTS.PREP_UPDATE, toPublicRoom(result));
    }
  );

  // ---- NEW: resets the room back to lobby (same players, roles cleared,
  // prep/performance wiped) so the host can start a fresh round. Any player
  // can trigger this from the round-end screen. ----
  socket.on(SOCKET_EVENTS.RETURN_TO_LOBBY, ({ code }: { code: string }) => {
    const result = returnToLobby(code);
    if ('error' in result) {
      console.error(`[server] emitting error to ${socket.id}: ${result.error}`);
      socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      return;
    }
    io.to(code).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(result));
  });
  // ---- NEW ABOVE ----

});

const PORT: number = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
