// ---- NEW (C1+C8): top-level router, extracted from Lobby.tsx.
// App.tsx renders <GameController> instead of <Lobby>. ----

import { useState, useEffect } from 'react';
// ---- NEW (A1): imports from split shared files ----
import { SOCKET_EVENTS } from '../../shared/events';
import type { RoomPublic } from '../../shared/types';
// ---- NEW ABOVE (A1) ----
import { socket } from './socket';
import { useError } from './ErrorContext';
import LobbyScreen from './LobbyScreen';
import RapBattle from './RapBattle';
import RoundEnd from './RoundEnd';
import Game2 from './Game2';

// ---- NEW: single source of error display — rendered once at the bottom of every screen ----
function ErrorBanner() {
  const { error } = useError();
  if (!error) return null;
  return <p style={{ color: 'red' }}>{error}</p>;
}
// ---- NEW ABOVE ----

export default function GameController() {
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [myPlayerId, setMyPlayerId] = useState('');
  const { setError } = useError();

  // ---- CHANGED: rejoin on every successful connection, not just page mount.
  // socket.io-client auto-reconnects on its own after a dropped connection (common
  // over a flaky tunnel), handing out a brand-new socket id each time. The server
  // has no way to know that new socket belongs to an existing player unless we tell
  // it again — otherwise the new socket never rejoins the Socket.IO room (so it stops
  // receiving broadcasts, looking "stuck") and the disconnect's pending-removal timer
  // is never cancelled (so the player gets silently kicked ~10s later even though
  // they're still connected and interacting). 'connect' fires for the first
  // connection AND every reconnect, so one listener covers both cases. ----
  useEffect(() => {
    const rejoinIfSaved = () => {
      const savedPlayerId = sessionStorage.getItem('playerId');
      const savedRoomCode = sessionStorage.getItem('roomCode');
      if (savedPlayerId && savedRoomCode) {
        console.log('[client] (re)connected — attempting rejoin:', savedRoomCode);
        socket.emit(SOCKET_EVENTS.REJOIN_ROOM, {
          playerId: savedPlayerId,
          roomCode: savedRoomCode,
        });
      }
    };
    socket.on('connect', rejoinIfSaved);
    return () => {
      socket.off('connect', rejoinIfSaved);
    };
  }, []);
  // ---- CHANGED ABOVE ----

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
          <ErrorBanner />
        </>
      );
    }
    if (room.mode === 'gamemode2') {
      return (
        <>
          <Game2 room={room} myPlayerId={myPlayerId} />
          <ErrorBanner />
        </>
      );
    }
  }

  if (room && room.status === 'round-end') {
    return (
      <>
        <RoundEnd room={room} />
        <ErrorBanner />
      </>
    );
  }
  // ---- CHANGED ABOVE (A4+C2) ----

  return (
    <>
      <LobbyScreen
        room={room}
        myPlayerId={myPlayerId}
        onRoomCleared={handleRoomCleared}
      />
      <ErrorBanner />
    </>
  );
}
// ---- NEW ABOVE (C1+C8) ----
