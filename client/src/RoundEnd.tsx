// ==================== ENTIRE FILE IS NEW ====================
// Shown once room.status becomes 'round-end'. Deliberately minimal — no
// replay option, just a single button that resets the room back to the
// lobby (same players, roles cleared) so the host can start a fresh round
// if they want one.

import { SOCKET_EVENTS, type RoomPublic } from '../../shared/events';
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
      <p>Topic: {room.prep?.topic ?? ''}</p>
      <button onClick={handleReturnToLobby} style={{ color: '#000', fontSize: 18, padding: '10px 24px' }}>
        Return to Lobby
      </button>
    </div>
  );
}

export default RoundEnd;
