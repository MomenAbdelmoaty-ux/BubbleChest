import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';

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
});

const PORT: number = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});