import { useState, useEffect } from 'react';
// ---- FIX 1: import real shared types (RoomPublic) instead of hand-rolled
// local duplicates — Player/PrepState/RoomPublic interfaces below are gone ----
import { SOCKET_EVENTS, type RoomPublic } from '../../shared/events';
import { socket } from './socket';
import PrepPhase from './PrepPhase';
// ---- FIX 1 ABOVE ----

function Lobby() {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState<RoomPublic | null>(null);
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
    socket.on(SOCKET_EVENTS.ROOM_UPDATE, (data: RoomPublic & { yourPlayerId?: string }) => {
      setRoom(data);
      if (data.yourPlayerId) {
        setMyPlayerId(data.yourPlayerId);
        sessionStorage.setItem('playerId', data.yourPlayerId);
        sessionStorage.setItem('roomCode', data.code);
      }
    });

    socket.on(SOCKET_EVENTS.ROLES_ASSIGNED, (data: RoomPublic) => {
      setRoom(data);
    });

    // ---- NEW: listen for prep-phase submission broadcasts ----
    socket.on(SOCKET_EVENTS.PREP_UPDATE, (data: RoomPublic) => {
      setRoom(data);
    });
    // ---- NEW ABOVE ----

    socket.on(SOCKET_EVENTS.ERROR, ({ message }: { message: string }) => {
      setError(message);
    });

    return () => {
      socket.off(SOCKET_EVENTS.ROOM_UPDATE);
      socket.off(SOCKET_EVENTS.ROLES_ASSIGNED);
      socket.off(SOCKET_EVENTS.PREP_UPDATE); // ---- NEW ----
      socket.off(SOCKET_EVENTS.ERROR);
    };
  }, []);

  const handleCreate = () => {
    setError('');
    
    socket.emit(SOCKET_EVENTS.CREATE_ROOM, { name });
  };

  const handleJoin = () => {
    setError('');
    //if (!name.trim()) return;
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { code: joinCode.toUpperCase(), name });
  };

  const handleStart = () => {
    // Not a silent failure path: this button only ever renders inside
    // `{isHost && room.status === 'lobby' && ...}`, so `room` is always
    // defined here in practice — this guard exists purely so TypeScript can
    // narrow `room`'s type, not to handle a real error case.
    if (!room) return;
    socket.emit(SOCKET_EVENTS.START_GAME, { code: room.code });
  };

  const handleLeave = () => {
    // Same reasoning as handleStart above — this button only renders once a
    // room already exists, so this is a type-narrowing guard, not a real
    // error case that needs surfacing.
    if (!room) return;
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { code: room.code, playerId: myPlayerId });
    sessionStorage.removeItem('playerId');
    sessionStorage.removeItem('roomCode');
    setRoom(null);
    setMyPlayerId('');
  };

  const me = room?.players.find((p) => p.playerId === myPlayerId);
  const isHost = me?.isHost ?? false;

  // ---- FIX: previously returned <PrepPhase /> alone here — any ERROR
  // event received while in prep phase (e.g. a failed submission) would set
  // `error` state, but nothing on screen ever displayed it, since this
  // return happened before the error paragraph below. Wrapped in a
  // Fragment (<>...</>) so both PrepPhase and the error message can be
  // returned together without adding an unnecessary extra <div>. ----
  if (room && room.status !== 'lobby') {
    return (
      <>
        <PrepPhase room={room} myRole={me?.role ?? null} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </>
    );
  }
  // ---- FIX ABOVE ----

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
        <button onClick={handleStart} disabled={room.players.length !== 4}>
          Start Game ({room.players.length}/4)
        </button>
      )}
      <button onClick={handleLeave} style={{ color: '#000000' }}>
        Leave Room
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

export default Lobby;
