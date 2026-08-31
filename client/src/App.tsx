import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:3000');

function App() {
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState('');

  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      setSocketId(socket.id ?? '');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  return (
    <div>
      <h1>BubbleChest</h1>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      {connected && <p>Socket ID: {socketId}</p>}
    </div>
  );
}

export default App;