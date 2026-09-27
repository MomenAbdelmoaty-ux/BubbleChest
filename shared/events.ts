// ==================== SPLIT FROM events.ts (A1) ====================
// This file now contains ONLY the socket event name constants.
// Types → shared/types.ts  |  Numeric constants → shared/constants.ts

export const SOCKET_EVENTS = {
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  REJOIN_ROOM: 'rejoin_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_UPDATE: 'room_update',
  START_GAME: 'start_game',
  ROLES_ASSIGNED: 'roles_assigned',
  SUBMIT_TOPIC: 'submit_topic',
  SUBMIT_COUPLETS: 'submit_couplets',
  SUBMIT_BEAT: 'submit_beat',
  PREP_UPDATE: 'prep_update',
  RETURN_TO_LOBBY: 'return_to_lobby',
  ERROR: 'room_error',
  SUBMIT_FRAME: 'submit_frame',
  SUBMIT_CAPTION: 'submit_caption',
  SUBMIT_VOTE: 'submit_vote',
  SUBMIT_COMMENT: 'submit_comment',
  SUBMIT_COMMENT_VOTE: 'submit_comment_vote',
  GAME2_UPDATE: 'game2_update',
} as const;
