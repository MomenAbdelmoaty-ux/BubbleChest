import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createRoom, getRoom, joinRoom, rejoinRoom, assignRoles, toPublicRoom, leaveRoom } from './rooms.js';
import { SOCKET_EVENTS } from '../shared/events.js';

const app = express();
app.use(express.static('public'));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

io.on('connection', (socket: Socket) => {
  console.log('A player connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('A player disconnected:', socket.id);
  });

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
      // send the rejoining player their full state back, tagged with their (unchanged) playerId
      socket.emit(SOCKET_EVENTS.ROOM_UPDATE, { ...toPublicRoom(room), yourPlayerId: playerId });
    }
  );

  socket.on(SOCKET_EVENTS.START_GAME, ({ code }: { code: string }) => {
    const room = getRoom(code);
    if (!room) return;

    const result = assignRoles(room);
    if (result && 'error' in result) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      return;
    }

    io.to(room.code).emit(SOCKET_EVENTS.ROLES_ASSIGNED, toPublicRoom(room));
  });

  socket.on(SOCKET_EVENTS.LEAVE_ROOM, ({ code, playerId }: { code: string; playerId: string }) => {
    socket.leave(code);
    const room = leaveRoom(code, playerId);
    if (room) {
      io.to(code).emit(SOCKET_EVENTS.ROOM_UPDATE, toPublicRoom(room));
    }

  });

});

const PORT: number = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});