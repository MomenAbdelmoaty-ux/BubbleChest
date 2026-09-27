// ==================== SPLIT FROM events.ts (A1) ====================
// All shared TypeScript types and interfaces live here.

export type Role = 'rapper' | 'ghostwriter' | 'producer' | 'record-label';

export type GameMode = 'rap-battle' | 'gamemode2';

export interface PlayerPublic {
  playerId: string;
  name: string;
  role: Role | null;
  isHost: boolean;
}

export interface PrepState {
  topic: string;
  coupletEndings: string[];
  beatGrid: boolean[][];
  submitted: { recordLabel: boolean; ghostwriter: boolean; producer: boolean };
  prepEndsAt: number;
}

// ---- NEW (A2): wraps all rap-battle sub-phase state so it's clearly scoped ----
// phase 'grace' is the SERVER_BUFFER_MS window between ROLES_ASSIGNED and beat start
export interface RapBattleState {
  phase: 'prep' | 'grace' | 'performance';
  prepState?: PrepState;
  performanceState?: { startAt: number };
}
// ---- NEW ABOVE (A2) ----

// ---- Gamemode 2 state shapes ----

// The drawing phase: one player draws at a time, round-robin
export interface Game2DrawState {
  frames: string[];           // base64 PNG strings, one per completed frame
  currentDrawerIndex: number; // index into the turn order array
  turnOrder: string[];        // playerIds in drawing order
  phaseEndsAt: number;        // epoch ms countdown for current drawer's timer
}

// The caption phase: everyone writes a caption simultaneously
export interface Game2CaptionState {
  captions: Record<string, string>; // playerId → caption text
  phaseEndsAt: number;
}

// ---- CHANGED (A6): winner is now singular with null-before-tally sentinel;
// ties are broken randomly so there is always exactly one winner ----
export interface BracketMatchup {
  captionA: { playerId: string; text: string };
  captionB: { playerId: string; text: string };
  votes: Record<string, 'A' | 'B'>; // playerId → which they voted for
  winner: string | null;             // null = not yet tallied; string = winner playerId
  phaseEndsAt: number;
}
// ---- CHANGED ABOVE (A6) ----

// The bracket voting phase
export interface Game2VoteState {
  rounds: BracketMatchup[][];  // rounds[0] = quarter/semi, rounds[last] = final
  currentRound: number;
  currentMatchup: number;
  // ---- CHANGED (A6): singular — random tiebreak means exactly one final winner ----
  finalWinner: string;
  // ---- CHANGED ABOVE (A6) ----
}

// One comment entry
export interface Comment {
  playerId: string;
  text: string;
  upvotes: number;
  downvotes: number;
  // each player's vote on this comment: 'up' | 'down' | null (null = no vote)
  playerVotes: Record<string, 'up' | 'down' | null>;
}

// The comment phase: write + vote combined
export interface Game2CommentState {
  comments: Record<string, Comment>; // playerId → their comment
  phaseEndsAt: number;               // when comment writing ends
  votingEndsAt: number | null;       // set once writing timer ends, null before
  // ---- CHANGED (A6): array to support multi-way ties in comment voting ----
  winnerPlayerIds: string[];         // all playerIds whose net score equals the max
  // ---- CHANGED ABOVE (A6) ----
}

// ---- CHANGED (A3): sub-state properties renamed to carry a 'State' suffix ----
// Top-level gamemode 2 state, lives on the Room
export interface Game2State {
  phase: 'drawing' | 'caption' | 'voting' | 'commenting' | 'results';
  drawState?: Game2DrawState;
  captionState?: Game2CaptionState;
  voteState?: Game2VoteState;
  commentState?: Game2CommentState;
  // ---- CHANGED (A6): no more tie variant — random tiebreak in bracket ----
  winningCaption?: { playerId: string; text: string };
  // ---- CHANGED ABOVE (A6) ----
}
// ---- CHANGED ABOVE (A3) ----

export interface RoomPublic {
  code: string;
  // ---- CHANGED (A4): simplified to three statuses; phase lives inside rapBattle/game2State ----
  status: 'lobby' | 'in-game' | 'round-end';
  // ---- CHANGED ABOVE (A4) ----
  players: PlayerPublic[];
  // ---- CHANGED (A2+A3): prep/performance replaced by rapBattle container ----
  rapBattle?: RapBattleState;
  // ---- CHANGED ABOVE (A2+A3) ----
  numCouplets: number;
  mode: GameMode;
  // ---- CHANGED (A3): renamed from game2 to game2State ----
  game2State?: Game2State;
  // ---- CHANGED ABOVE (A3) ----
}
