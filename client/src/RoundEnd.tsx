// ---- CHANGED (A1): SOCKET_EVENTS from events; RoomPublic from types ----
import { SOCKET_EVENTS } from '../../shared/events';
import type { RoomPublic } from '../../shared/types';
// ---- CHANGED ABOVE (A1) ----
import { socket } from './socket';

function RoundEnd({ room }: { room: RoomPublic }) {
  const handleReturnToLobby = () => {
    console.log('[client] emitting RETURN_TO_LOBBY:', { code: room.code });
    socket.emit(SOCKET_EVENTS.RETURN_TO_LOBBY, { code: room.code });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        gap: 24,
      }}
    >
      <h1>Round over!</h1>
      {/* ---- CHANGED (A2+A3): rapBattle.prepState.topic instead of room.prep.topic ---- */}
      <p>Topic: {room.rapBattle?.prepState?.topic ?? ''}</p>
      {/* ---- CHANGED ABOVE (A2+A3) ---- */}
      <button onClick={handleReturnToLobby} style={{ color: '#000', fontSize: 18, padding: '10px 24px' }}>
        Return to Lobby
      </button>
    </div>
  );
}

export default RoundEnd;
