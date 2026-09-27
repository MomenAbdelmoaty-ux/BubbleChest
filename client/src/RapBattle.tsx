// ---- NEW (C1): routes rap-battle sub-phases (prep / grace / performance) ----

import type { RoomPublic } from '../../shared/types';
import PrepPhase from './PrepPhase';
import PerformancePhase from './PerformancePhase';

interface RapBattleProps {
  room: RoomPublic;
  myRole: string | null;
}

export default function RapBattle({ room, myRole }: RapBattleProps) {
  // ---- CHANGED (A2+A4): phase lives in rapBattle.phase instead of room.status ----
  const phase = room.rapBattle?.phase;

  switch (phase) {
    case 'prep':
      return <PrepPhase room={room} myRole={myRole} />;
    case 'grace':
    case 'performance':
      // ---- CHANGED (D1): PerformancePhase now handles the grace state itself
      // (shows "Get ready..." while rapBattle.phase === 'grace') ----
      return <PerformancePhase room={room} />;
    default:
      return <p>Loading rap battle...</p>;
  }
}
// ---- NEW ABOVE (C1) ----
