import { randomUUID } from 'node:crypto';
// ---- CHANGED (A1): imports split across the three new shared files ----
import type {
  Role, RoomPublic, PrepState, Game2State, Game2DrawState,
  Game2CaptionState, Game2VoteState, Game2CommentState,
  BracketMatchup, GameMode, RapBattleState,
} from '../shared/types.js';
import {
  BEAT_STEPS, LOOP_MS,
  GAME2_FIRST_FRAME_MS, GAME2_FRAME_MS, GAME2_CAPTION_MS,
  GAME2_VOTE_ROUND_MS, GAME2_COMMENT_MS,
  // ---- NEW (A5): replace GRACE_PERIOD_MS with the two named constants ----
  INPUT_GRACE_MS, SERVER_BUFFER_MS, READING_DELAY_MS,
  // ---- NEW (A7): shared gameplay rule constants ----
  MIN_PLAYERS_TO_START, MAX_PLAYERS_RAP_BATTLE, MAX_PLAYERS_GAMEMODE2, GAME2_TEXT_MAX_LEN,
  // ---- NEW (B8): SAMPLES moved to shared so server can derive BEAT_ROWS ----
  SAMPLES,
} from '../shared/constants.js';
// ---- CHANGED ABOVE (A1) ----

interface Player {
  playerId: string;
  name: string;
  role: Role | null;
  socketId: string;
}

interface Room {
  code: string;
  mode: GameMode;
  hostId: string;
  // ---- CHANGED (A4): simplified status; sub-phase lives in rapBattle/game2State ----
  status: RoomPublic['status'];
  // ---- CHANGED ABOVE (A4) ----
  players: Record<string, Player>;
  settings: {
    prepTimerSeconds: number;
    numCouplets: number;
  };
  // ---- CHANGED (A2+A3): replaced prep/performance with rapBattle container ----
  rapBattle?: RapBattleState;
  // ---- CHANGED ABOVE (A2+A3) ----
  // ---- CHANGED (A3): renamed from game2 to game2State ----
  game2State?: Game2State;
  // ---- CHANGED ABOVE (A3) ----
}

const rooms = new Map<string, Room>();
const socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();
const pendingRemovals = new Map<string, NodeJS.Timeout>();

// ---- CHANGED (B4): rapBattleTimers replaces the old prepTimers map,
// and covers both prep and performance timers under one unified helper ----
const rapBattleTimers = new Map<string, NodeJS.Timeout>();
// ---- CHANGED ABOVE (B4) ----

const game2Timers = new Map<string, NodeJS.Timeout>();

const REJOIN_GRACE_PERIOD_MS = 10000;
// ---- CHANGED (A5): GRACE_PERIOD_MS = 3000 removed; replaced by INPUT_GRACE_MS + SERVER_BUFFER_MS ----

// ---- CHANGED (B8): BEAT_ROWS derives from SAMPLES.length instead of hardcoding 4 ----
const BEAT_ROWS = SAMPLES.length;
// ---- CHANGED ABOVE (B8) ----

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

export function createRoom(hostName: string, hostSocketId: string, mode: GameMode): { room: Room; playerId: string } | { error: string } {
  if (!hostName.trim()) {
    console.log(`[rooms] createRoom rejected: empty name`);
    return { error: 'Name cannot be empty.' };
  }

  const playerId = randomUUID();
  const code = generateRoomCode();

  const room: Room = {
    code,
    mode,
    hostId: playerId,
    status: 'lobby',
    players: {
      [playerId]: { playerId, name: hostName, role: null, socketId: hostSocketId },
    },
    settings: {
      prepTimerSeconds: 120,
      numCouplets: 8,
    },
  };

  rooms.set(code, room);
  socketToPlayer.set(hostSocketId, { roomCode: code, playerId });
  console.log(`[rooms] Room ${code} created by "${hostName}" (playerId ${playerId}) mode=${mode}`);
  return { room, playerId };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.trim().toUpperCase());
}

export function joinRoom(
  code: string,
  name: string,
  socketId: string
): { room: Room; playerId: string } | { error: string } {
  if (!name.trim()) return { error: 'Name cannot be empty.' };
  if (!code.trim()) return { error: 'Room code cannot be empty.' };

  const room = getRoom(code);
  if (!room) return { error: 'Room not found.' };
  if (room.status !== 'lobby') return { error: 'Game already in progress.' };
  // ---- CHANGED (B1): max players now branches on mode using A7 constants ----
  const maxPlayers = room.mode === 'rap-battle' ? MAX_PLAYERS_RAP_BATTLE : MAX_PLAYERS_GAMEMODE2;
  if (Object.keys(room.players).length >= maxPlayers) return { error: 'Room is full.' };
  // ---- CHANGED ABOVE (B1) ----

  const playerId = randomUUID();
  room.players[playerId] = { playerId, name, role: null, socketId };
  socketToPlayer.set(socketId, { roomCode: room.code, playerId });
  console.log(`[rooms] "${name}" joined room ${code} (playerId ${playerId}) — ${Object.keys(room.players).length}/${maxPlayers} players`);
  return { room, playerId };
}

export function rejoinRoom(
  roomCode: string,
  playerId: string,
  newSocketId: string
): { room: Room; playerId: string } | { error: string } {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room no longer exists.' };

  const player = room.players[playerId];
  if (!player) return { error: 'Player not found in this room.' };

  const pending = pendingRemovals.get(playerId);
  if (pending) {
    clearTimeout(pending);
    pendingRemovals.delete(playerId);
    console.log(`[rooms] rejoinRoom: cancelled pending removal for playerId ${playerId}`);
  }

  player.socketId = newSocketId;
  socketToPlayer.set(newSocketId, { roomCode: room.code, playerId });
  console.log(`[rooms] "${player.name}" rejoined room ${roomCode} (new socketId ${newSocketId})`);
  return { room, playerId };
}

export function leaveRoom(roomCode: string, playerId: string): Room | { error: string } | undefined {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found.' };

  const leavingName = room.players[playerId]?.name ?? '(unknown)';
  delete room.players[playerId];

  if (Object.keys(room.players).length === 0) {
    rooms.delete(roomCode);
    console.log(`[rooms] "${leavingName}" left room ${roomCode} — room now empty, deleted`);
    return undefined;
  }

  if (room.hostId === playerId) {
    const remainingIds = Object.keys(room.players);
    room.hostId = remainingIds[0]!;
    console.log(`[rooms] host left room ${roomCode} — reassigned host to playerId ${room.hostId}`);
  }

  console.log(`[rooms] "${leavingName}" left room ${roomCode} — ${Object.keys(room.players).length} players remaining`);
  return room;
}

export function handleDisconnect(
  socketId: string,
  onKick: (roomCode: string, room: Room) => void
): void {
  const entry = socketToPlayer.get(socketId);
  socketToPlayer.delete(socketId);
  if (!entry) return;

  const { roomCode, playerId } = entry;
  console.log(`[rooms] disconnect: playerId ${playerId} in room ${roomCode} — starting ${REJOIN_GRACE_PERIOD_MS}ms grace timer`);

  const timer = setTimeout(() => {
    pendingRemovals.delete(playerId);
    const result = leaveRoom(roomCode, playerId);
    if (result && !('error' in result)) {
      onKick(roomCode, result);
    }
  }, REJOIN_GRACE_PERIOD_MS);

  pendingRemovals.set(playerId, timer);
}

// ---- CHANGED (B2): renamed from assignRoles → startGame; also uses MIN_PLAYERS_TO_START (A7) ----
export function startGame(
  room: Room,
  broadcastRoom: (roomCode: string) => void  // ---- CHANGED (B3): parameter renamed ----
): { error: string } | void {
  const playerIds = Object.keys(room.players);
  // ---- CHANGED (A7): use shared constant instead of hardcoded 4 ----
  if (playerIds.length < MIN_PLAYERS_TO_START) {
    return { error: `Need at least ${MIN_PLAYERS_TO_START} players to start.` };
  }

  if (room.mode === 'rap-battle') {
    // ---- CHANGED (B2): rap-battle also checks max via shared constant ----
    if (playerIds.length > MAX_PLAYERS_RAP_BATTLE) {
      return { error: `Rap battle supports at most ${MAX_PLAYERS_RAP_BATTLE} players.` };
    }
    const roles: Role[] = ['record-label', 'ghostwriter', 'producer', 'rapper'];
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j]!, roles[i]!];
    }
    playerIds.forEach((playerId, i) => {
      room.players[playerId]!.role = roles[i % roles.length]!;
    });
    console.log(`[rooms] Room ${room.code}: roles assigned`);
    // ---- CHANGED (A4): status becomes 'in-game'; phase tracked inside rapBattle ----
    room.status = 'in-game';
    // ---- CHANGED ABOVE (A4) ----
    startPrepPhase(room, broadcastRoom);
  } else {
    // ---- CHANGED (A4): 'game2' status → 'in-game'; phase tracked in game2State ----
    room.status = 'in-game';
    // ---- CHANGED ABOVE (A4) ----
    console.log(`[rooms] Room ${room.code}: starting gamemode 2`);
    startGame2Drawing(room, broadcastRoom);
  }
}
// ---- CHANGED ABOVE (B2) ----

// ==================== RAP BATTLE PHASE LOGIC ====================

function emptyBeatGrid(): boolean[][] {
  return Array.from({ length: BEAT_ROWS }, () => Array.from({ length: BEAT_STEPS }, () => false));
}

// ---- NEW (B4): scheduleRapBattleTimer mirrors scheduleGame2Timer —
// cancels any active timer for this room before setting a new one ----
function scheduleRapBattleTimer(roomCode: string, ms: number, fn: () => void): void {
  const existing = rapBattleTimers.get(roomCode);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    rapBattleTimers.delete(roomCode);
    fn();
  }, ms);
  rapBattleTimers.set(roomCode, timer);
}
// ---- NEW ABOVE (B4) ----

// ---- CHANGED (B3): broadcastRoom parameter renamed from onPhaseChange ----
// ---- CHANGED (A2+A3): sets rapBattle.phase = 'prep' and rapBattle.prepState ----
function startPrepPhase(room: Room, broadcastRoom: (roomCode: string) => void): void {
  const prepState: PrepState = {
    topic: '',
    coupletEndings: [],
    beatGrid: emptyBeatGrid(),
    submitted: { recordLabel: false, ghostwriter: false, producer: false },
    prepEndsAt: Date.now() + room.settings.prepTimerSeconds * 1000,
  };
  // ---- CHANGED (A2): state now lives in rapBattle.prepState ----
  room.rapBattle = { phase: 'prep', prepState };
  // ---- CHANGED ABOVE (A2) ----

  // ---- CHANGED (A5): totalMs now uses INPUT_GRACE_MS + SERVER_BUFFER_MS ----
  const totalMs = room.settings.prepTimerSeconds * 1000 + INPUT_GRACE_MS + SERVER_BUFFER_MS;
  // ---- CHANGED ABOVE (A5) ----

  broadcastRoom(room.code);

  // ---- CHANGED (B4): use scheduleRapBattleTimer instead of raw setTimeout ----
  scheduleRapBattleTimer(room.code, totalMs, () => {
    startPerformancePhase(room, broadcastRoom);
  });
  // ---- CHANGED ABOVE (B4) ----
}

// ---- CHANGED (B3): broadcastRoom parameter renamed from onPhaseChange ----
// ---- CHANGED (D1+A4+A2+A3): uses SERVER_BUFFER_MS, sets rapBattle phase ----
function startPerformancePhase(room: Room, broadcastRoom: (roomCode: string) => void): void {
  // ---- CHANGED (D1): SERVER_BUFFER_MS replaces the first hardcoded 2000 ----
  const startAt = Date.now() + SERVER_BUFFER_MS;
  // ---- CHANGED ABOVE (D1) ----

  // ---- CHANGED (A2+D1): grace phase during the SERVER_BUFFER_MS lead-in window ----
  room.rapBattle = { ...room.rapBattle, phase: 'grace', performanceState: { startAt } };
  // ---- CHANGED ABOVE (A2+D1) ----

  const numCouplets = room.settings.numCouplets;
  const performanceMs = READING_DELAY_MS + numCouplets * LOOP_MS;
  console.log(`[rooms] Room ${room.code}: performance phase starts at ${startAt} (grace window: ${SERVER_BUFFER_MS}ms)`);

  broadcastRoom(room.code);

  // Flip from grace → performance once the lead-in window expires
  scheduleRapBattleTimer(room.code, SERVER_BUFFER_MS, () => {
    if (room.rapBattle) {
      room.rapBattle = { ...room.rapBattle, phase: 'performance' };
    }
    broadcastRoom(room.code);

    // ---- CHANGED (D1): SERVER_BUFFER_MS replaces the second hardcoded 2000;
    // the inner timer now just waits performanceMs (no extra SERVER_BUFFER_MS
    // added here since we already waited it above) ----
    scheduleRapBattleTimer(room.code, performanceMs, () => {
      // ---- CHANGED (A4): status → 'round-end' (was already 'round-end', no change here) ----
      room.status = 'round-end';
      console.log(`[rooms] Room ${room.code}: performance finished — advancing to round-end`);
      broadcastRoom(room.code);
    });
    // ---- CHANGED ABOVE (D1) ----
  });
}

export function returnToLobby(roomCode: string): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found.' };

  // Cancel any active game2 timer
  const g2timer = game2Timers.get(roomCode);
  if (g2timer) {
    clearTimeout(g2timer);
    game2Timers.delete(roomCode);
  }

  // ---- CHANGED (B4): also cancel any active rap-battle timer ----
  const rbTimer = rapBattleTimers.get(roomCode);
  if (rbTimer) {
    clearTimeout(rbTimer);
    rapBattleTimers.delete(roomCode);
  }
  // ---- CHANGED ABOVE (B4) ----

  room.status = 'lobby';
  // ---- CHANGED (A2+A3): delete rapBattle and game2State instead of prep/performance/game2 ----
  delete room.rapBattle;
  delete room.game2State;
  // ---- CHANGED ABOVE (A2+A3) ----
  Object.values(room.players).forEach((p) => { p.role = null; });

  console.log(`[rooms] Room ${roomCode}: returned to lobby`);
  return room;
}

export function submitTopic(roomCode: string, topic: string): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found.' };
  // ---- CHANGED (A2+A3): reads rapBattle.prepState instead of room.prep ----
  if (!room.rapBattle?.prepState) return { error: 'Prep phase has not started yet.' };
  room.rapBattle.prepState.topic = topic;
  room.rapBattle.prepState.submitted.recordLabel = true;
  // ---- CHANGED ABOVE (A2+A3) ----
  console.log(`[rooms] Room ${roomCode}: topic submitted — "${topic}"`);
  return room;
}

export function submitCouplets(roomCode: string, coupletEndings: string[]): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found.' };
  // ---- CHANGED (A2+A3): reads rapBattle.prepState ----
  if (!room.rapBattle?.prepState) return { error: 'Prep phase has not started yet.' };
  room.rapBattle.prepState.coupletEndings = coupletEndings;
  room.rapBattle.prepState.submitted.ghostwriter = true;
  // ---- CHANGED ABOVE (A2+A3) ----
  return room;
}

export function submitBeat(roomCode: string, beatGrid: boolean[][]): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found.' };
  // ---- CHANGED (A2+A3): reads rapBattle.prepState ----
  if (!room.rapBattle?.prepState) return { error: 'Prep phase has not started yet.' };
  room.rapBattle.prepState.beatGrid = beatGrid;
  room.rapBattle.prepState.submitted.producer = true;
  // ---- CHANGED ABOVE (A2+A3) ----
  return room;
}

// ==================== GAMEMODE 2 LOGIC ====================

// ---- Helper to schedule a game2 phase timer, cancelling any previous one ----
function scheduleGame2Timer(roomCode: string, ms: number, fn: () => void): void {
  const existing = game2Timers.get(roomCode);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    game2Timers.delete(roomCode);
    fn();
  }, ms);
  game2Timers.set(roomCode, timer);
}

// ---- CHANGED (B6): three drawing laps per player instead of two ----
function buildTurnOrder(playerIds: string[]): string[] {
  return [...playerIds, ...playerIds, ...playerIds];
}
// ---- CHANGED ABOVE (B6) ----

// ---- CHANGED (B3): broadcastRoom parameter renamed from onPhaseChange ----
// ---- CHANGED (A3): sets game2State (was game2) ----
function startGame2Drawing(room: Room, broadcastRoom: (roomCode: string) => void): void {
  const playerIds = Object.keys(room.players);
  const turnOrder = buildTurnOrder(playerIds);

  // ---- CHANGED (A3): game2State.drawState (was game2.draw) ----
  room.game2State = {
    phase: 'drawing',
    drawState: {
      frames: [],
      currentDrawerIndex: 0,
      turnOrder,
      phaseEndsAt: Date.now() + GAME2_FIRST_FRAME_MS,
    },
  };
  // ---- CHANGED ABOVE (A3) ----

  console.log(`[rooms] Room ${room.code}: game2 drawing phase started, ${turnOrder.length} turns total`);
  broadcastRoom(room.code);

  // ---- CHANGED (A5): INPUT_GRACE_MS + SERVER_BUFFER_MS replaces GRACE_PERIOD_MS ----
  scheduleGame2Timer(room.code, GAME2_FIRST_FRAME_MS + INPUT_GRACE_MS + SERVER_BUFFER_MS, () => {
    autoAdvanceFrame(room, broadcastRoom);
  });
  // ---- CHANGED ABOVE (A5) ----
}

// ---- CHANGED (B3): broadcastRoom parameter renamed ----
function autoAdvanceFrame(room: Room, broadcastRoom: (roomCode: string) => void): void {
  // ---- CHANGED (A3): game2State.drawState (was game2.draw) ----
  const draw = room.game2State?.drawState;
  // ---- CHANGED ABOVE (A3) ----
  if (!draw) return;

  if (draw.frames.length <= draw.currentDrawerIndex) {
    draw.frames.push('');
    console.log(`[rooms] Room ${room.code}: frame ${draw.currentDrawerIndex} auto-submitted as blank`);
  }

  const nextIndex = draw.currentDrawerIndex + 1;

  if (nextIndex >= draw.turnOrder.length) {
    console.log(`[rooms] Room ${room.code}: all frames done, moving to caption phase`);
    startGame2Caption(room, broadcastRoom);
    return;
  }

  draw.currentDrawerIndex = nextIndex;
  draw.phaseEndsAt = Date.now() + GAME2_FRAME_MS;

  console.log(`[rooms] Room ${room.code}: advancing to frame ${nextIndex} (drawer: ${draw.turnOrder[nextIndex]})`);
  broadcastRoom(room.code);

  // ---- CHANGED (A5): INPUT_GRACE_MS + SERVER_BUFFER_MS replaces GRACE_PERIOD_MS ----
  scheduleGame2Timer(room.code, GAME2_FRAME_MS + INPUT_GRACE_MS + SERVER_BUFFER_MS, () => {
    autoAdvanceFrame(room, broadcastRoom);
  });
  // ---- CHANGED ABOVE (A5) ----
}

// ---- CHANGED: broadcastRoom added so autoAdvanceFrame → startGame2Caption can broadcast
// phase transitions (caption, voting, commenting, results) that are triggered by early
// frame submission. Previously () => {} was passed, silently swallowing all downstream
// phase-change broadcasts — the root cause of clients being stuck on 'caption' forever. ----
export function submitFrame(
  roomCode: string,
  playerId: string,
  frameBase64: string,
  broadcastRoom: (roomCode: string) => void,
): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found.' };
  // ---- CHANGED (A3): game2State.drawState (was game2.draw) ----
  const draw = room.game2State?.drawState;
  // ---- CHANGED ABOVE (A3) ----
  if (!draw) return { error: 'Not in drawing phase.' };

  if (draw.turnOrder[draw.currentDrawerIndex] !== playerId) {
    return { error: 'Not your turn to draw.' };
  }

  draw.frames[draw.currentDrawerIndex] = frameBase64;
  console.log(`[rooms] Room ${roomCode}: frame ${draw.currentDrawerIndex} submitted by ${playerId}`);

  // ---- CHANGED: pass real broadcastRoom so all downstream phase transitions are emitted ----
  autoAdvanceFrame(room, broadcastRoom);
  // ---- CHANGED ABOVE ----
  return room;
}
// ---- CHANGED ABOVE ----

// ---- CHANGED (B3): broadcastRoom parameter renamed ----
// ---- CHANGED (A3): game2State.captionState (was game2.caption) ----
function startGame2Caption(room: Room, broadcastRoom: (roomCode: string) => void): void {
  if (!room.game2State) return;

  room.game2State.phase = 'caption';
  room.game2State.captionState = {
    captions: {},
    phaseEndsAt: Date.now() + GAME2_CAPTION_MS,
  };

  console.log(`[rooms] Room ${room.code}: caption phase started`);
  broadcastRoom(room.code);

  // ---- CHANGED (A5): INPUT_GRACE_MS + SERVER_BUFFER_MS replaces GRACE_PERIOD_MS ----
  scheduleGame2Timer(room.code, GAME2_CAPTION_MS + INPUT_GRACE_MS + SERVER_BUFFER_MS, () => {
    startGame2Voting(room, broadcastRoom);
  });
  // ---- CHANGED ABOVE (A5) ----
}

export function submitCaption(roomCode: string, playerId: string, text: string): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found.' };
  // ---- CHANGED (A3): game2State.captionState ----
  const caption = room.game2State?.captionState;
  // ---- CHANGED ABOVE (A3) ----
  if (!caption) return { error: 'Not in caption phase.' };

  // ---- CHANGED (B9): GAME2_TEXT_MAX_LEN replaces hardcoded 300 ----
  caption.captions[playerId] = text.slice(0, GAME2_TEXT_MAX_LEN);
  // ---- CHANGED ABOVE (B9) ----
  console.log(`[rooms] Room ${roomCode}: caption from ${playerId}: "${text}"`);
  return room;
}

// ---- CHANGED (A6): BracketMatchup now uses winner: string | null ----
function buildBracket(captions: Record<string, string>): BracketMatchup[][] {
  const entries = Object.entries(captions).map(([playerId, text]) => ({ playerId, text }));

  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j]!, entries[i]!];
  }

  const now = Date.now();
  const matchups: BracketMatchup[] = [];
  const byePlayers: Array<{ playerId: string; text: string }> = [];

  for (let i = 0; i + 1 < entries.length; i += 2) {
    matchups.push({
      captionA: entries[i]!,
      captionB: entries[i + 1]!,
      votes: {},
      // ---- CHANGED (A6): null until tallied ----
      winner: null,
      // ---- CHANGED ABOVE (A6) ----
      phaseEndsAt: now + GAME2_VOTE_ROUND_MS,
    });
  }

  if (entries.length % 2 === 1) {
    byePlayers.push(entries[entries.length - 1]!);
  }

  // ---- CHANGED (A6): bye matchups use winner: string (auto-promoted), not winners array ----
  const byeMatchups: BracketMatchup[] = byePlayers.map((p) => ({
    captionA: p,
    captionB: { playerId: '', text: '(bye)' },
    votes: {},
    winner: p.playerId,
    phaseEndsAt: now,
  }));
  // ---- CHANGED ABOVE (A6) ----

  return [[...matchups, ...byeMatchups]];
}

// ---- CHANGED (B3): broadcastRoom parameter renamed ----
// ---- CHANGED (A3): game2State.voteState (was game2.vote) ----
function startGame2Voting(room: Room, broadcastRoom: (roomCode: string) => void): void {
  if (!room.game2State) return;

  const captions = room.game2State.captionState?.captions ?? {};
  const rounds = buildBracket(captions);

  room.game2State.phase = 'voting';
  room.game2State.voteState = {
    rounds,
    currentRound: 0,
    currentMatchup: 0,
    // ---- CHANGED (A6): finalWinner is singular string (random tiebreak) ----
    finalWinner: '',
    // ---- CHANGED ABOVE (A6) ----
  };

  console.log(`[rooms] Room ${room.code}: voting phase started, ${rounds[0]?.length ?? 0} first-round matchups`);
  broadcastRoom(room.code);

  scheduleNextMatchupTimer(room, broadcastRoom);
}
// ---- CHANGED ABOVE (A3) ----

function scheduleNextMatchupTimer(room: Room, broadcastRoom: (roomCode: string) => void): void {
  // ---- CHANGED (A3): game2State.voteState (was game2.vote) ----
  const vote = room.game2State?.voteState;
  // ---- CHANGED ABOVE (A3) ----
  if (!vote) return;

  const currentMatchups = vote.rounds[vote.currentRound];
  if (!currentMatchups) return;

  const matchup = currentMatchups[vote.currentMatchup];
  if (!matchup) return;

  // Skip bye matchups immediately
  if (matchup.captionB.playerId === '') {
    advanceMatchup(room, broadcastRoom);
    return;
  }

  // ---- CHANGED (A5): INPUT_GRACE_MS + SERVER_BUFFER_MS replaces GRACE_PERIOD_MS ----
  scheduleGame2Timer(room.code, GAME2_VOTE_ROUND_MS + INPUT_GRACE_MS + SERVER_BUFFER_MS, () => {
    tallyMatchupAndAdvance(room, broadcastRoom);
  });
  // ---- CHANGED ABOVE (A5) ----
}

// ---- CHANGED (A6): winner is singular; random tiebreak instead of both-advance ----
function tallyMatchupAndAdvance(room: Room, broadcastRoom: (roomCode: string) => void): void {
  // ---- CHANGED (A3): game2State.voteState ----
  const vote = room.game2State?.voteState;
  // ---- CHANGED ABOVE (A3) ----
  if (!vote) return;

  const matchup = vote.rounds[vote.currentRound]?.[vote.currentMatchup];
  if (!matchup) return;

  let votesA = 0;
  let votesB = 0;
  Object.values(matchup.votes).forEach((v) => {
    if (v === 'A') votesA++;
    else votesB++;
  });

  if (votesA > votesB) {
    // ---- CHANGED (A6): singular winner field ----
    matchup.winner = matchup.captionA.playerId;
  } else if (votesB > votesA) {
    matchup.winner = matchup.captionB.playerId;
  } else {
    // ---- CHANGED (A6): tie → random tiebreak, no more both-advance ----
    matchup.winner = Math.random() < 0.5 ? matchup.captionA.playerId : matchup.captionB.playerId;
    console.log(`[rooms] Room ${room.code}: tie in matchup — randomly chose winner: ${matchup.winner}`);
    // ---- CHANGED ABOVE (A6) ----
  }

  console.log(`[rooms] Room ${room.code}: matchup resolved — winner: ${matchup.winner}`);
  advanceMatchup(room, broadcastRoom);
}
// ---- CHANGED ABOVE (A6) ----

// ---- CHANGED (A6+A3): uses singular winner field; game2State.voteState ----
function advanceMatchup(room: Room, broadcastRoom: (roomCode: string) => void): void {
  const vote = room.game2State?.voteState;
  if (!vote) return;

  const currentMatchups = vote.rounds[vote.currentRound]!;
  const nextMatchupIndex = vote.currentMatchup + 1;

  if (nextMatchupIndex < currentMatchups.length) {
    vote.currentMatchup = nextMatchupIndex;

    const nextMatchup = currentMatchups[nextMatchupIndex]!;
    nextMatchup.phaseEndsAt = Date.now() + GAME2_VOTE_ROUND_MS;

    broadcastRoom(room.code);
    scheduleNextMatchupTimer(room, broadcastRoom);
  } else {
    // ---- CHANGED (A6): collect singular winners (not arrays) ----
    const allWinners = currentMatchups
      .map((m) => m.winner)
      .filter((w): w is string => w !== null);
    // ---- CHANGED ABOVE (A6) ----

    if (allWinners.length <= 1) {
      const finalWinner = allWinners[0] ?? '';
      // ---- CHANGED (A6): finalWinner is singular ----
      vote.finalWinner = finalWinner;
      // ---- CHANGED ABOVE (A6) ----

      const captions = room.game2State?.captionState?.captions ?? {};
      // ---- CHANGED (A6): no tie variant; always a single winningCaption ----
      room.game2State!.winningCaption = {
        playerId: finalWinner,
        text: captions[finalWinner] ?? '',
      };
      // ---- CHANGED ABOVE (A6) ----

      console.log(`[rooms] Room ${room.code}: bracket complete, final winner: ${finalWinner}`);
      startGame2Commenting(room, broadcastRoom);
    } else {
      const captions = room.game2State?.captionState?.captions ?? {};
      const nextMatchups: BracketMatchup[] = [];
      const byePlayers: Array<{ playerId: string; text: string }> = [];

      for (let i = 0; i + 1 < allWinners.length; i += 2) {
        const pidA = allWinners[i]!;
        const pidB = allWinners[i + 1]!;
        nextMatchups.push({
          captionA: { playerId: pidA, text: captions[pidA] ?? '' },
          captionB: { playerId: pidB, text: captions[pidB] ?? '' },
          votes: {},
          // ---- CHANGED (A6): null sentinel ----
          winner: null,
          // ---- CHANGED ABOVE (A6) ----
          phaseEndsAt: Date.now() + GAME2_VOTE_ROUND_MS,
        });
      }

      if (allWinners.length % 2 === 1) {
        const pid = allWinners[allWinners.length - 1]!;
        byePlayers.push({ playerId: pid, text: captions[pid] ?? '' });
      }

      // ---- CHANGED (A6): bye matchups use singular winner ----
      const byeMatchups: BracketMatchup[] = byePlayers.map((p) => ({
        captionA: p,
        captionB: { playerId: '', text: '(bye)' },
        votes: {},
        winner: p.playerId,
        phaseEndsAt: Date.now(),
      }));
      // ---- CHANGED ABOVE (A6) ----

      vote.rounds.push([...nextMatchups, ...byeMatchups]);
      vote.currentRound++;
      vote.currentMatchup = 0;

      console.log(`[rooms] Room ${room.code}: advancing to bracket round ${vote.currentRound}`);
      broadcastRoom(room.code);
      scheduleNextMatchupTimer(room, broadcastRoom);
    }
  }
}

export function submitVote(roomCode: string, playerId: string, vote: 'A' | 'B'): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found.' };
  // ---- CHANGED (A3): game2State.voteState ----
  const voteState = room.game2State?.voteState;
  // ---- CHANGED ABOVE (A3) ----
  if (!voteState) return { error: 'Not in voting phase.' };

  const matchup = voteState.rounds[voteState.currentRound]?.[voteState.currentMatchup];
  if (!matchup) return { error: 'No active matchup.' };
  // ---- NEW: reject votes for a matchup that's already been tallied. Without this,
  // a vote that arrives late (e.g. from a client that silently reconnected and is
  // running on stale state) gets applied to whatever matchup is CURRENT by the time
  // it arrives — which may be a completely different matchup the voter never saw. ----
  if (matchup.winner !== null) return { error: 'Voting has closed for this matchup.' };
  // ---- NEW ABOVE ----

  matchup.votes[playerId] = vote;
  console.log(`[rooms] Room ${roomCode}: ${playerId} voted ${vote} in round ${voteState.currentRound} matchup ${voteState.currentMatchup}`);
  return room;
}

// ---- CHANGED (B3+A6+A3): broadcastRoom renamed; winnerPlayerIds replaces winnerPlayerId ----
function startGame2Commenting(room: Room, broadcastRoom: (roomCode: string) => void): void {
  if (!room.game2State) return;

  const playerCount = Object.keys(room.players).length;
  const commentVotingMs = playerCount * 15_000;

  room.game2State.phase = 'commenting';
  // ---- CHANGED (A3): game2State.commentState (was game2.comment) ----
  room.game2State.commentState = {
    comments: {},
    phaseEndsAt: Date.now() + GAME2_COMMENT_MS,
    votingEndsAt: null,
    // ---- CHANGED (A6): array for multi-winner support ----
    winnerPlayerIds: [],
    // ---- CHANGED ABOVE (A6) ----
  };
  // ---- CHANGED ABOVE (A3) ----

  console.log(`[rooms] Room ${room.code}: comment phase started`);
  broadcastRoom(room.code);

  // ---- CHANGED (A5): INPUT_GRACE_MS + SERVER_BUFFER_MS replaces GRACE_PERIOD_MS ----
  scheduleGame2Timer(room.code, GAME2_COMMENT_MS + INPUT_GRACE_MS + SERVER_BUFFER_MS, () => {
    openCommentVoting(room, commentVotingMs, broadcastRoom);
  });
  // ---- CHANGED ABOVE (A5) ----
}

function openCommentVoting(room: Room, votingMs: number, broadcastRoom: (roomCode: string) => void): void {
  // ---- CHANGED (A3): game2State.commentState ----
  const comment = room.game2State?.commentState;
  // ---- CHANGED ABOVE (A3) ----
  if (!comment) return;

  comment.votingEndsAt = Date.now() + votingMs;
  console.log(`[rooms] Room ${room.code}: comment voting open for ${votingMs}ms`);
  broadcastRoom(room.code);

  // votingMs is the nominal on-screen duration; add the same grace + dead window as every other phase
  scheduleGame2Timer(room.code, votingMs + INPUT_GRACE_MS + SERVER_BUFFER_MS, () => {
    resolveCommentWinner(room, broadcastRoom);
  });
}

// ---- CHANGED (A6+B7): winnerPlayerIds (array) supports multi-way ties in comments ----
function resolveCommentWinner(room: Room, broadcastRoom: (roomCode: string) => void): void {
  // ---- CHANGED (A3): game2State.commentState ----
  const comment = room.game2State?.commentState;
  // ---- CHANGED ABOVE (A3) ----
  if (!comment) return;

  let bestScore = -Infinity;
  // ---- CHANGED (A6): collect all tied winners instead of only the first ----
  const winnerIds: string[] = [];

  Object.entries(comment.comments).forEach(([pid, c]) => {
    const score = c.upvotes - c.downvotes;
    if (score > bestScore) {
      bestScore = score;
      winnerIds.length = 0; // clear previous leaders
      winnerIds.push(pid);
    } else if (score === bestScore) {
      winnerIds.push(pid); // tie — add as co-winner
    }
  });

  comment.winnerPlayerIds = winnerIds;
  // ---- CHANGED ABOVE (A6) ----
  console.log(`[rooms] Room ${room.code}: comment winner(s): ${winnerIds.join(', ')}`);

  room.game2State!.phase = 'results';
  broadcastRoom(room.code);
}

export function submitComment(roomCode: string, playerId: string, text: string): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found.' };
  // ---- CHANGED (A3): game2State.commentState ----
  const comment = room.game2State?.commentState;
  // ---- CHANGED ABOVE (A3) ----
  if (!comment) return { error: 'Not in comment phase.' };

  // ---- CHANGED (B9): GAME2_TEXT_MAX_LEN replaces hardcoded 300 ----
  comment.comments[playerId] = {
    playerId,
    text: text.slice(0, GAME2_TEXT_MAX_LEN),
    upvotes: 0,
    downvotes: 0,
    playerVotes: {},
  };
  // ---- CHANGED ABOVE (B9) ----
  console.log(`[rooms] Room ${roomCode}: comment from ${playerId}`);
  return room;
}

export function submitCommentVote(
  roomCode: string,
  voterId: string,
  targetPlayerId: string,
  vote: 'up' | 'down' | null
): Room | { error: string } {
  const room = getRoom(roomCode);
  if (!room) return { error: 'Room not found.' };
  // ---- CHANGED (A3): game2State.commentState ----
  const comment = room.game2State?.commentState;
  // ---- CHANGED ABOVE (A3) ----
  if (!comment) return { error: 'Not in comment phase.' };
  // ---- NEW: reject votes once the phase has moved past commenting, or before voting
  // has opened. Without this, a straggling vote (e.g. from a client that silently
  // reconnected and never learned the phase had already resolved) still mutates
  // upvotes/downvotes after resolveCommentWinner already ran and picked a winner —
  // changing the tally invisibly, since the winner is never recalculated. ----
  if (room.game2State?.phase !== 'commenting' || !comment.votingEndsAt) {
    return { error: 'Comment voting is not open.' };
  }
  // ---- NEW ABOVE ----

  const target = comment.comments[targetPlayerId];
  if (!target) return { error: 'Comment not found.' };

  const previous = target.playerVotes[voterId] ?? null;

  if (previous === 'up') target.upvotes--;
  if (previous === 'down') target.downvotes--;

  target.playerVotes[voterId] = vote;
  if (vote === 'up') target.upvotes++;
  if (vote === 'down') target.downvotes++;

  console.log(`[rooms] Room ${roomCode}: ${voterId} voted ${vote} on ${targetPlayerId}'s comment`);
  return room;
}

export function toPublicRoom(room: Room): RoomPublic {
  return {
    code: room.code,
    status: room.status,
    mode: room.mode,
    players: Object.values(room.players).map((p) => ({
      playerId: p.playerId,
      name: p.name,
      role: p.role,
      isHost: p.playerId === room.hostId,
    })),
    // ---- CHANGED (A2+A3): rapBattle replaces spread prep/performance ----
    ...(room.rapBattle !== undefined && { rapBattle: room.rapBattle }),
    // ---- CHANGED ABOVE (A2+A3) ----
    // ---- CHANGED (A3): game2State replaces game2 ----
    ...(room.game2State !== undefined && { game2State: room.game2State }),
    // ---- CHANGED ABOVE (A3) ----
    numCouplets: room.settings.numCouplets,
  };
}
