import { useState, useEffect } from 'react';
import { SOCKET_EVENTS, type RoomPublic } from '../../shared/events';
import { socket } from './socket';
import PrepPhase from './PrepPhase';
import PerformancePhase from './PerformancePhase';
import RoundEnd from './RoundEnd';
 
function Lobby() {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [error, setError] = useState('');
 
  // Attempt a silent rejoin on first mount (e.g. after a page refresh)
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
    socket.on(SOCKET_EVENTS.ROOM_UPDATE, (data: RoomPublic & { yourPlayerId?: string }) => {
      console.log('[client] ROOM_UPDATE received:', data);
      setRoom(data);
      if (data.yourPlayerId) {
        setMyPlayerId(data.yourPlayerId);
        sessionStorage.setItem('playerId', data.yourPlayerId);
        sessionStorage.setItem('roomCode', data.code);
      }
    });
 
    socket.on(SOCKET_EVENTS.ROLES_ASSIGNED, (data: RoomPublic) => {
      console.log('[client] ROLES_ASSIGNED received:', data);
      setRoom(data);
    });
 
    socket.on(SOCKET_EVENTS.PREP_UPDATE, (data: RoomPublic) => {
      console.log('[client] PREP_UPDATE received:', data);
      setRoom(data);
    });
 
    socket.on(SOCKET_EVENTS.ERROR, ({ message }: { message: string }) => {
      console.error('[client] ERROR received:', message);
      setError(message);
    });
 
    return () => {
      socket.off(SOCKET_EVENTS.ROOM_UPDATE);
      socket.off(SOCKET_EVENTS.ROLES_ASSIGNED);
      socket.off(SOCKET_EVENTS.PREP_UPDATE);
      socket.off(SOCKET_EVENTS.ERROR);
    };
  }, []);
 
  const handleCreate = () => {
    setError('');
    console.log('[client] emitting CREATE_ROOM:', { name });
    socket.emit(SOCKET_EVENTS.CREATE_ROOM, { name });
  };
 
  const handleJoin = () => {
    setError('');
    console.log('[client] emitting JOIN_ROOM:', { code: joinCode, name });
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { code: joinCode.toUpperCase(), name });
  };
 
  const handleStart = () => {
    // Not a silent failure path — button only renders when room exists
    if (!room) return;
    socket.emit(SOCKET_EVENTS.START_GAME, { code: room.code });
  };
 
  const handleLeave = () => {
    // Not a silent failure path — button only renders when room exists
    if (!room) return;
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { code: room.code, playerId: myPlayerId });
    sessionStorage.removeItem('playerId');
    sessionStorage.removeItem('roomCode');
    setRoom(null);
    setMyPlayerId('');
  };
 
  const me = room?.players.find((p) => p.playerId === myPlayerId);
  const isHost = me?.isHost ?? false;
 
  if (room && room.status === 'prep') {
    return (
      <>
        <PrepPhase room={room} myRole={me?.role ?? null} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </>
    );
  }
 
  if (room && room.status === 'performance') {
    return (
      <>
        <PerformancePhase room={room} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </>
    );
  }
 
  if (room && room.status === 'round-end') {
    return (
      <>
        <RoundEnd room={room} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </>
    );
  }
 
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
        // ---- FIX 3: added style={{ color: '#000' }} to match every other
        // button in the app — Start Game text was previously unreadable ----
        <button onClick={handleStart} disabled={room.players.length !== 4} style={{ color: '#000' }}>
          Start Game ({room.players.length}/4)
        </button>
        // ---- FIX 3 ABOVE ----
      )}
      <button onClick={handleLeave} style={{ color: '#000000' }}>
        Leave Room
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
 
export default Lobby;