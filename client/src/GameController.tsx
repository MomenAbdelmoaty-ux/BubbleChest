// ---- NEW (C1+C8): top-level router, extracted from Lobby.tsx.
// App.tsx renders <GameController> instead of <Lobby>. ----

import { useState, useEffect } from 'react';
// ---- NEW (A1): imports from split shared files ----
import { SOCKET_EVENTS } from '../../shared/events';
import type { RoomPublic } from '../../shared/types';
// ---- NEW ABOVE (A1) ----
import { socket } from './socket';
import LobbyScreen from './LobbyScreen';
import RapBattle from './RapBattle';
import RoundEnd from './RoundEnd';
import Game2 from './Game2';

export default function GameController() {
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [myPlayerId, setMyPlayerId] = useState('');
  const [error, setError] = useState('');

  // Rejoin on mount if session data is present
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
      // Clear room on leave (null yourPlayerId signals a lobby reset for this client)
      //if (!data.yourPlayerId && !myPlayerId) {
        //setRoom(null);
        //setMyPlayerId('');
      //}
    });

    socket.on(SOCKET_EVENTS.ROLES_ASSIGNED, (data: RoomPublic) => {
      console.log('[client] ROLES_ASSIGNED received:', data);
      setRoom(data);
    });

    socket.on(SOCKET_EVENTS.PREP_UPDATE, (data: RoomPublic) => {
      console.log('[client] PREP_UPDATE received:', data);
      setRoom(data);
    });

    socket.on(SOCKET_EVENTS.GAME2_UPDATE, (data: RoomPublic) => {
      console.log('[client] GAME2_UPDATE received:', data);
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
      socket.off(SOCKET_EVENTS.GAME2_UPDATE);
      socket.off(SOCKET_EVENTS.ERROR);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle leave: when LobbyScreen calls handleLeave, clear local state too
  const handleRoomCleared = () => {
    setRoom(null);
    setMyPlayerId('');
  };

  const me = room?.players.find((p) => p.playerId === myPlayerId);
  const myRole = me?.role ?? null;

  // ---- CHANGED (A4+C2): routing on simplified status + mode + rapBattle.phase ----
  if (room && room.status === 'in-game') {
    if (room.mode === 'rap-battle') {
      return (
        <>
          <RapBattle room={room} myRole={myRole} />
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </>
      );
    }
    if (room.mode === 'gamemode2') {
      return (
        <>
          <Game2 room={room} myPlayerId={myPlayerId} />
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </>
      );
    }
  }

  if (room && room.status === 'round-end') {
    return (
      <>
        <RoundEnd room={room} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </>
    );
  }
  // ---- CHANGED ABOVE (A4+C2) ----

  // lobby status (or null room) — show create/join UI
  return (
    // ---- CHANGED: pass onRoomCleared so LobbyScreen can signal a leave ----
    <LobbyScreen
      room={room}
      myPlayerId={myPlayerId}
      error={error}
      onRoomCleared={handleRoomCleared}
    />
    // ---- CHANGED ABOVE ----
  );
}
// ---- NEW ABOVE (C1+C8) ----
