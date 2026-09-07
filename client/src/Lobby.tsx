import { useState, useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '../../shared/events';

const socket: Socket = io('http://localhost:3000');

interface Player {
  playerId: string;
  name: string;
  role: string | null;
  isHost: boolean;
}

interface RoomState {
  code: string;
  status: string;
  players: Player[];
}

function Lobby() {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [error, setError] = useState('');

  // Attempt a silent rejoin on first mount (e.g. after a page refresh), using
  // whatever playerId/roomCode were previously saved to sessionStorage.
  useEffect(() => {
    const savedPlayerId = sessionStorage.getItem('playerId');
    const savedRoomCode = sessionStorage.getItem('roomCode');

    if (savedPlayerId && savedRoomCode) {
      socket.emit(SOCKET_EVENTS.REJOIN_ROOM, {
        playerId: savedPlayerId,
        roomCode: savedRoomCode,
      });
    }
  }, []);

  useEffect(() => {
    socket.on(SOCKET_EVENTS.ROOM_UPDATE, (data: RoomState & { yourPlayerId?: string }) => {
      setRoom(data);
      if (data.yourPlayerId) {
        setMyPlayerId(data.yourPlayerId);
        sessionStorage.setItem('playerId', data.yourPlayerId);
        sessionStorage.setItem('roomCode', data.code);
      }
    });

    socket.on(SOCKET_EVENTS.ROLES_ASSIGNED, (data: RoomState) => {
      setRoom(data);
    });

    socket.on(SOCKET_EVENTS.ERROR, ({ message }: { message: string }) => {
      setError(message);
    });

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_UPDATE);
      socket.off(SOCKET_EVENTS.ROLES_ASSIGNED);
      socket.off(SOCKET_EVENTS.ERROR);
    };
  }, []);

  const handleCreate = () => {
    setError('');
    //if (!name.trim()) return;
    socket.emit(SOCKET_EVENTS.CREATE_ROOM, { name });
  };

  const handleJoin = () => {
    setError('');
    //if (!name.trim() || !joinCode.trim()) return;
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { code: joinCode.toUpperCase(), name });
  };

  const handleStart = () => {
    setError('');
    if (!room) return;
    socket.emit(SOCKET_EVENTS.START_GAME, { code: room.code });
  };

  const handleLeave = () => {
    setError('');
    if (!room) return;
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { code: room.code, playerId: myPlayerId });
    sessionStorage.removeItem('playerId');
    sessionStorage.removeItem('roomCode');
    setRoom(null);
    setMyPlayerId('');
  };

  const me = room?.players.find((p) => p.playerId === myPlayerId);
  const isHost = me?.isHost ?? false;

  if (!room) {
    return (
      <div>
        <h1>BubbleChest</h1>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
          <button onClick={handleCreate} style={{ color: '#000000' }}>
            Create Room
          </button>
        </div>
        <div>
          <input
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <button onClick={handleJoin} style={{ color: '#000000' }}>
            Join Room
          </button>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <h1>Room: {room.code}</h1>
      <ul>
        {room.players.map((p) => (
          <li key={p.playerId}>
            {p.name} {p.isHost && '(Host)'} {p.role && `— ${p.role}`}
          </li>
        ))}
      </ul>
      {isHost && room.status === 'lobby' && (
        <button onClick={handleStart} disabled={room.players.length !== 4} style={{ color: '#000000' }}>
          Start Game ({room.players.length}/4)
        </button>
      )}
      <div><button onClick={handleLeave} style={{ color: '#000000' }} >Leave Room</button></div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default Lobby;
