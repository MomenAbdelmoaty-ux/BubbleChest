// ---- NEW (C1): extracted from Lobby.tsx — just the join/create UI, no routing logic ----

import { useState } from 'react';
// ---- NEW (A1): imports from the three split shared files ----
import { SOCKET_EVENTS } from '../../shared/events';
import type { RoomPublic, GameMode } from '../../shared/types';
import {
  MIN_PLAYERS_TO_START, MAX_PLAYERS_RAP_BATTLE, MAX_PLAYERS_GAMEMODE2,
} from '../../shared/constants';
// ---- NEW ABOVE (A1) ----
import { socket } from './socket';
// ---- CHANGED: error now comes from context; localError removed ----
import { useError } from './ErrorContext';
// ---- CHANGED ABOVE ----

interface LobbyScreenProps {
  room: RoomPublic | null;
  myPlayerId: string;
  // ---- CHANGED: error prop removed — read from context instead ----
  onRoomCleared: () => void;
}

export default function LobbyScreen({ room, myPlayerId, onRoomCleared }: LobbyScreenProps) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [selectedMode, setSelectedMode] = useState<GameMode | ''>('');
  // ---- CHANGED: useError replaces both the error prop and localError state ----
  const { error, setError, clearError } = useError();
  // ---- CHANGED ABOVE ----

  const handleCreate = () => {
    // ---- CHANGED: clear any previous error before every server request,
    // then validate locally — if invalid, set error via context and stop ----
    clearError();
    if (!selectedMode) {
      setError('Please choose a gamemode.');
      return;
    }
    // ---- CHANGED ABOVE ----
    console.log('[client] emitting CREATE_ROOM:', { name, mode: selectedMode });
    socket.emit(SOCKET_EVENTS.CREATE_ROOM, { name, mode: selectedMode });
  };

  const handleJoin = () => {
    // ---- CHANGED: clear error before every server request ----
    clearError();
    // ---- CHANGED ABOVE ----
    console.log('[client] emitting JOIN_ROOM:', { code: joinCode, name });
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { code: joinCode.toUpperCase(), name });
  };

  const handleStart = () => {
    if (!room) return;
    // ---- CHANGED: clear error before every server request ----
    clearError();
    // ---- CHANGED ABOVE ----
    socket.emit(SOCKET_EVENTS.START_GAME, { code: room.code });
  };

  const handleLeave = () => {
    if (!room) return;
    clearError();
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { code: room.code, playerId: myPlayerId });
    sessionStorage.removeItem('playerId');
    sessionStorage.removeItem('roomCode');
    onRoomCleared();
  };

  const me = room?.players.find((p) => p.playerId === myPlayerId);
  const isHost = me?.isHost ?? false;

  // No room yet — show create/join form
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
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value as GameMode | '')}
              style={{ color: '#000' }}
            >
              <option value="">Choose gamemode</option>
              <option value="rap-battle">Gamemode 1</option>
              <option value="gamemode2">Gamemode 2</option>
            </select>
            <button onClick={handleCreate} style={{ color: '#000' }}>
              Create Room
            </button>
          </div>
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
      </div>
    );
  }

  // In lobby — show player list and start/leave buttons
  return (
    <div>
      <h1>Room: {room.code}</h1>
      <p>Mode: {room.mode === 'rap-battle' ? 'Gamemode 1' : 'Gamemode 2'}</p>
      <ul>
        {room.players.map((p) => (
          <li key={p.playerId}>
            {p.name} {p.isHost && '(Host)'} {p.role && `— ${p.role}`}
          </li>
        ))}
      </ul>
      {isHost && room.status === 'lobby' && (
        // ---- CHANGED (C3): start button logic branches on mode using A7 constants ----
        <button
          onClick={handleStart}
          disabled={
            room.mode === 'rap-battle'
              ? room.players.length !== MAX_PLAYERS_RAP_BATTLE
              : room.players.length < MIN_PLAYERS_TO_START
          }
          style={{ color: '#000' }}
        >
          {room.mode === 'rap-battle'
            ? `Start Game (${room.players.length}/${MAX_PLAYERS_RAP_BATTLE})`
            : `Start Game (${room.players.length}/${MAX_PLAYERS_GAMEMODE2}, need ${MIN_PLAYERS_TO_START}+)`}
        </button>
        // ---- CHANGED ABOVE (C3) ----
      )}
      <button onClick={handleLeave} style={{ color: '#000000' }}>
        Leave Room
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
// ---- NEW ABOVE (C1) ----
