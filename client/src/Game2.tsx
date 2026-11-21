// Gamemode 2 — collaborative animation + caption bracket + comment voting.
// This file contains all gamemode 2 UI, split into sub-components by phase.
// The top-level <Game2> component routes to the right sub-component based on
// game2State.phase using a switch statement (C2).

// ---- CHANGED (A1): SOCKET_EVENTS from events; RoomPublic from types; GAME2_FPS + GAME2_TEXT_MAX_LEN from constants ----
import { SOCKET_EVENTS } from '../../shared/events';
import type { RoomPublic } from '../../shared/types';
import { GAME2_FPS, GAME2_TEXT_MAX_LEN } from '../../shared/constants';
// ---- CHANGED ABOVE (A1) ----
import { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from './socket';
// ---- CHANGED: import useError so every manual submit handler can clear stale errors ----
import { useError } from './ErrorContext';
// ---- CHANGED ABOVE ----
import { useCountdown } from './useCountdown';

// useCountdown now lives in ./useCountdown (shared with PrepPhase).
// It returns { secondsLeft, inGracePeriod, graceOver } — see that file for the timeline.

// ---- NEW (D3): single function to compute canvas size, replacing three
// identical Math.floor(window.innerWidth / 3) expressions in the file ----
// ---- CHANGED: fixed resolution for every player, regardless of window size.
// Frames are saved at exactly whatever pixel size they were drawn at (via
// canvas.toDataURL). If that varied per device — as it did when this was based on
// window.innerWidth — a frame drawn small on one player's phone gets stretched up
// (blurry) whenever it's displayed larger later: as the next drawer's underlay, or
// during final playback. A fixed size means every frame is captured at the same
// native resolution, so nothing needs to be upscaled. ----
const CANVAS_SIZE = 512;
function getCanvasSize(): number {
  return CANVAS_SIZE;
}
// ---- NEW ABOVE (D3) ----

// ---- NEW (C9): shared helper for formatting the winning caption,
// replacing two independent copies of the tie-branch logic ----
function formatWinningCaption(
  winningCaption: { playerId: string; text: string } | undefined,
  players: RoomPublic['players']
): { text: string; author: string } {
  if (!winningCaption) return { text: '', author: '' };
  const author = players.find((p) => p.playerId === winningCaption.playerId)?.name ?? '?';
  return { text: winningCaption.text, author };
}
// ---- NEW ABOVE (C9) ----

// ==================== DRAWING PHASE ====================

// ---- NEW (C6): shared pushSnapshot helper — routes all undo-stack pushes
// through one place so the floor (index 0) is never evicted ----
function makePushSnapshot(undoStackRef: React.MutableRefObject<string[]>) {
  return (snapshot: string) => {
    if (undoStackRef.current.length >= 20) {
      // Never evict index 0 — that's the floor (previous frame / blank start)
      undoStackRef.current.splice(1, 1);
    }
    undoStackRef.current.push(snapshot);
  };
}
// ---- NEW ABOVE (C6) ----

function DrawingCanvas({
  previousFrame,
  onSubmit,
  phaseEndsAt,
}: {
  previousFrame: string | null;
  onSubmit: (base64: string) => void;
  phaseEndsAt: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(6);
  const undoStackRef = useRef<string[]>([]);
  // grace: canvas stays drawable during INPUT_GRACE_MS after 0; auto-submit at graceOver
  const { secondsLeft, inGracePeriod, graceOver } = useCountdown(phaseEndsAt);
  const hasSubmitted = useRef(false);
  const lockedRef = useRef(false);
  // true once the drawer manually submits: the turn is over, so lock everything
  const [submittedManually, setSubmittedManually] = useState(false);
  const locked = graceOver || submittedManually;
  // ---- CHANGED: clearError for manual submit ----
  const { clearError } = useError();
  // ---- CHANGED ABOVE ----

  // ---- CHANGED (D3): use getCanvasSize() instead of repeating the formula ----
  const canvasSize = getCanvasSize();
  // ---- CHANGED ABOVE (D3) ----

  // ---- NEW (C6): create the pushSnapshot helper once, bound to this component's ref ----
  const pushSnapshot = useCallback(makePushSnapshot(undoStackRef), []);
  // ---- NEW ABOVE (C6) ----

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (previousFrame) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
        undoStackRef.current = [canvas.toDataURL('image/png')];
      };
      img.src = previousFrame;
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasSize, canvasSize);
      undoStackRef.current = [canvas.toDataURL('image/png')];
    }
  }, [previousFrame, canvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colorRef = { current: color };
    const brushRef = { current: brushSize };

    const startDrawing = (x: number, y: number) => {
      if (lockedRef.current) return;
      isDrawingRef.current = true;
      ctx.strokeStyle = colorRef.current;
      ctx.lineWidth = brushRef.current;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (x: number, y: number) => {
      if (!isDrawingRef.current || lockedRef.current) return;
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      pushSnapshot(canvas.toDataURL('image/png'));
    };

    const getPos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onMouseDown = (e: MouseEvent) => { const p = getPos(e); startDrawing(p.x, p.y); };
    const onMouseMove = (e: MouseEvent) => { const p = getPos(e); draw(p.x, p.y); };
    const onMouseUp = () => stopDrawing();
    const onWindowMouseUp = () => stopDrawing();

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mouseup', onWindowMouseUp);

    (canvas as unknown as { _colorRef: typeof colorRef; _brushRef: typeof brushRef })._colorRef = colorRef;
    (canvas as unknown as { _colorRef: typeof colorRef; _brushRef: typeof brushRef })._brushRef = brushRef;

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const colorRef = (canvas as unknown as { _colorRef: { current: string } })._colorRef;
    const brushRef = (canvas as unknown as { _brushRef: { current: number } })._brushRef;
    if (colorRef) colorRef.current = color;
    if (brushRef) brushRef.current = brushSize;
  }, [color, brushSize]);

  // Mirror `locked` into a ref so the mouse handlers (attached once) see live values
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    if (graceOver && !hasSubmitted.current) {
      hasSubmitted.current = true;
      const canvas = canvasRef.current;
      // ---- note: no clearError here — auto-submit, not user-initiated ----
      if (canvas) onSubmit(canvas.toDataURL('image/png'));
    }
  }, [graceOver, onSubmit]);

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const stack = undoStackRef.current;
    if (stack.length <= 1) return;
    stack.pop();
    const previous = stack[stack.length - 1]!;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
    img.src = previous;
  };

  const handleBlank = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize, canvasSize);
    // ---- CHANGED (C6): route through pushSnapshot ----
    pushSnapshot(canvas.toDataURL('image/png'));
    // ---- CHANGED ABOVE (C6) ----
  };

  // ---- CHANGED (C6): Reset now pushes a copy of the floor instead of
  // truncating the stack, so it becomes undoable just like any other action ----
  const handleReset = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const floor = undoStackRef.current[0];
    if (!floor) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvasSize, canvasSize);
      pushSnapshot(canvas.toDataURL('image/png'));
    };
    img.src = floor;
  };
  // ---- CHANGED ABOVE (C6) ----

  const handleSubmit = () => {
    // ---- CHANGED: clear error on manual submit ----
    clearError();
    // ---- CHANGED ABOVE ----
    // ref guard is synchronous, so a fast double-click can't emit twice
    if (hasSubmitted.current) return;
    // a manual submit ends this turn, so the auto-submit must not fire as well
    hasSubmitted.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSubmittedManually(true);
    onSubmit(canvas.toDataURL('image/png'));
  };

  const palette = [
    '#000000', '#ffffff', '#ff0000', '#ff8800',
    '#ffff00', '#00cc00', '#0000ff', '#8800cc',
    '#ff69b4', '#00cccc', '#8B4513', '#888888',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <p>Time left: {secondsLeft}s</p>
      {inGracePeriod && <p>Time's up, submitting...</p>}
      {graceOver && <p>Time's up — locked in.</p>}
      {submittedManually && !graceOver && <p>Frame submitted ✓ — waiting for the next drawer...</p>}

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {previousFrame && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <p style={{ fontSize: 12, color: '#888' }}>Previous frame</p>
            <img src={previousFrame} width={canvasSize} height={canvasSize} style={{ opacity: 0.4, border: '1px solid #ccc' }} alt="previous frame" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          style={{ border: '2px solid #333', cursor: 'crosshair', display: 'block' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {palette.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 28,
              height: 28,
              backgroundColor: c,
              border: color === c ? '3px solid #4a90e2' : '2px solid #999',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label>Brush size: {brushSize}px</label>
        <input
          type="range"
          min={1}
          max={20}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleUndo} disabled={locked} style={{ color: '#000' }}>Undo</button>
        <button onClick={handleBlank} disabled={locked} style={{ color: '#000' }}>Blank</button>
        <button onClick={handleReset} disabled={locked} style={{ color: '#000' }}>Reset</button>
        <button onClick={handleSubmit} disabled={locked} style={{ color: '#000' }}>Submit Frame</button>
      </div>
    </div>
  );
}

// ---- CHANGED (A3): draw comes from game2State.drawState ----
function DrawingPhase({ room, myPlayerId }: { room: RoomPublic; myPlayerId: string }) {
  const draw = room.game2State?.drawState;
  if (!draw) return <p>Loading drawing phase...</p>;

  const currentDrawerId = draw.turnOrder[draw.currentDrawerIndex];
  const isMyTurn = currentDrawerId === myPlayerId;
  const previousFrame = draw.frames.length > 0 ? draw.frames[draw.frames.length - 1] ?? null : null;
  const currentDrawerName = room.players.find((p) => p.playerId === currentDrawerId)?.name ?? '?';
  const frameNumber = draw.currentDrawerIndex + 1;
  const totalFrames = draw.turnOrder.length;

  const handleSubmit = useCallback((base64: string) => {
    console.log('[client] emitting SUBMIT_FRAME');
    socket.emit(SOCKET_EVENTS.SUBMIT_FRAME, {
      code: room.code,
      playerId: myPlayerId,
      frameBase64: base64,
    });
  }, [room.code, myPlayerId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <h1>Room: {room.code}</h1>
      <p>Frame {frameNumber} of {totalFrames}</p>

      {isMyTurn ? (
        <>
          <h2>Your turn to draw!</h2>
          <DrawingCanvas
            previousFrame={previousFrame}
            onSubmit={handleSubmit}
            phaseEndsAt={draw.phaseEndsAt}
          />
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <h2>Waiting for {currentDrawerName} to draw...</h2>
          <p>Frame {frameNumber} of {totalFrames}</p>
        </div>
      )}
    </div>
  );
}
// ---- CHANGED ABOVE (A3) ----

// ==================== ANIMATION PLAYER ====================

// ---- CHANGED (A3): frames come from game2State.drawState.frames ----
function AnimationPlayer({ frames }: { frames: string[] }) {
  // ---- NEW (C5): filter blank frames so the animation only plays real content ----
  const validFrames = frames.filter((f) => f !== '');
  // ---- NEW ABOVE (C5) ----

  const [frameIndex, setFrameIndex] = useState(0);
  const intervalMs = Math.round(1000 / GAME2_FPS);

  useEffect(() => {
    // ---- CHANGED (C5): use validFrames.length ----
    if (validFrames.length === 0) return;
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % validFrames.length);
    }, intervalMs);
    return () => clearInterval(interval);
  // ---- CHANGED (C5): depend on validFrames.length ----
  }, [validFrames.length, intervalMs]);

  if (validFrames.length === 0) return null;
  // ---- CHANGED ABOVE (C5) ----

  // ---- CHANGED (D3): use getCanvasSize() ----
  const canvasSize = getCanvasSize();
  // ---- CHANGED ABOVE (D3) ----

  return (
    <img
      // ---- CHANGED (C5): use validFrames instead of frames ----
      src={validFrames[frameIndex] ?? validFrames[0]}
      // ---- CHANGED ABOVE (C5) ----
      width={canvasSize}
      height={canvasSize}
      style={{ border: '2px solid #333', display: 'block' }}
      alt={`animation frame ${frameIndex + 1}`}
    />
  );
}

// ==================== CAPTION PHASE ====================

// ---- CHANGED (A3): caption lives in game2State.captionState ----
function CaptionPhase({ room, myPlayerId }: { room: RoomPublic; myPlayerId: string }) {
  const caption = room.game2State?.captionState;
  const [text, setText] = useState('');
  const { secondsLeft, inGracePeriod, graceOver } = useCountdown(caption?.phaseEndsAt);
  const autoSubmitted = useRef(false);
  const submitted = caption?.captions[myPlayerId] !== undefined;
  // ---- CHANGED: clearError on manual submit ----
  const { clearError } = useError();
  // ---- CHANGED ABOVE ----

  const handleSubmit = (manual = false) => {
    // ---- CHANGED: only clear error on manual submit, not auto-submit ----
    if (manual) clearError();
    // ---- CHANGED ABOVE ----
    console.log('[client] emitting SUBMIT_CAPTION');
    socket.emit(SOCKET_EVENTS.SUBMIT_CAPTION, {
      code: room.code,
      playerId: myPlayerId,
      text,
    });
  };

  // emergency auto-submit at the END of the grace window — skipped if they already submitted
  useEffect(() => {
    if (graceOver && !autoSubmitted.current && !submitted) {
      autoSubmitted.current = true;
      handleSubmit(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graceOver]);

  // ---- CHANGED (A3): game2State.drawState.frames ----
  const frames = room.game2State?.drawState?.frames ?? [];
  // ---- CHANGED ABOVE (A3) ----

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <h1>Write a caption!</h1>
      <p>Time left: {secondsLeft}s</p>
      {inGracePeriod && <p>Time's up, submitting...</p>}
      {graceOver && <p>Time's up — locked in.</p>}
      <AnimationPlayer frames={frames} />
      {/* ---- CHANGED (B9): GAME2_TEXT_MAX_LEN replaces hardcoded 300 ---- */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, GAME2_TEXT_MAX_LEN))}
        maxLength={GAME2_TEXT_MAX_LEN}
        rows={3}
        cols={40}
        disabled={graceOver}
        placeholder="Write your caption..."
        style={{ color: '#000', resize: 'none' }}
      />
      <p style={{ fontSize: 12, color: '#888' }}>{text.length}/{GAME2_TEXT_MAX_LEN}</p>
      {/* ---- CHANGED ABOVE (B9) ---- */}
      <button onClick={() => handleSubmit(true)} disabled={graceOver} style={{ color: '#000' }}>
        {submitted ? 'Update Caption' : 'Submit Caption'}
      </button>
      {submitted && <p>Submitted ✓</p>}
    </div>
  );
}
// ---- CHANGED ABOVE (A3) ----

// ==================== VOTING PHASE ====================

// ---- CHANGED (A3+A6): voteState replaces vote; winner replaces winners array ----
function VotingPhase({ room, myPlayerId }: { room: RoomPublic; myPlayerId: string }) {
  const vote = room.game2State?.voteState;
  // ---- CHANGED (A3): drawState ----
  const frames = room.game2State?.drawState?.frames ?? [];
  // ---- CHANGED ABOVE (A3) ----
  const { secondsLeft, inGracePeriod, graceOver } = useCountdown(
    vote?.rounds[vote.currentRound]?.[vote.currentMatchup]?.phaseEndsAt
  );
  // ---- CHANGED: clearError on manual vote ----
  const { clearError } = useError();
  // ---- CHANGED ABOVE ----

  if (!vote) return <p>Loading voting...</p>;

  const currentMatchup = vote.rounds[vote.currentRound]?.[vote.currentMatchup];
  if (!currentMatchup) return <p>Loading matchup...</p>;

  const myVote = currentMatchup.votes[myPlayerId];
  const roundNum = vote.currentRound + 1;
  const totalRounds = vote.rounds.length;

  // ---- CHANGED (C9/A6): winner is now string | null; null means not yet tallied ----
  // Votes stay changeable during the grace window; results show and buttons lock at graceOver
  const showResults = graceOver || currentMatchup.winner !== null;
  // ---- CHANGED ABOVE (C9/A6) ----

  const handleVote = (choice: 'A' | 'B') => {
    if (showResults) return;
    // ---- CHANGED: clear error on vote ----
    clearError();
    // ---- CHANGED ABOVE ----
    console.log('[client] emitting SUBMIT_VOTE:', choice);
    socket.emit(SOCKET_EVENTS.SUBMIT_VOTE, {
      code: room.code,
      playerId: myPlayerId,
      vote: choice,
    });
  };

  const countA = Object.values(currentMatchup.votes).filter((v) => v === 'A').length;
  const countB = Object.values(currentMatchup.votes).filter((v) => v === 'B').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <h1>Vote for your favourite caption!</h1>
      <p>Round {roundNum} of {totalRounds}</p>
      <p>Time left: {secondsLeft}s</p>
      {inGracePeriod && <p>Time's up — last chance to vote!</p>}
      <AnimationPlayer frames={frames} />

      <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
        <button
          onClick={() => handleVote('A')}
          disabled={showResults}
          style={{
            color: '#000',
            padding: '16px 24px',
            fontSize: 18,
            backgroundColor: myVote === 'A' ? '#4a90e2' : '#eee',
            border: '2px solid #999',
            borderRadius: 8,
            maxWidth: 240,
            cursor: showResults ? 'default' : 'pointer',
          }}
        >
          {currentMatchup.captionA.text || '(no caption submitted)'}
          {showResults && <div style={{ fontSize: 14, marginTop: 8 }}>{countA} votes</div>}
        </button>

        <button
          onClick={() => handleVote('B')}
          disabled={showResults}
          style={{
            color: '#000',
            padding: '16px 24px',
            fontSize: 18,
            backgroundColor: myVote === 'B' ? '#4a90e2' : '#eee',
            border: '2px solid #999',
            borderRadius: 8,
            maxWidth: 240,
            cursor: showResults ? 'default' : 'pointer',
          }}
        >
          {currentMatchup.captionB.text || '(no caption submitted)'}
          {showResults && <div style={{ fontSize: 14, marginTop: 8 }}>{countB} votes</div>}
        </button>
      </div>
    </div>
  );
}
// ---- CHANGED ABOVE (A3+A6) ----

// ==================== COMMENT PHASE ====================

// ---- CHANGED (A3+A6+B9+C9): commentState; winnerPlayerIds; GAME2_TEXT_MAX_LEN;
// formatWinningCaption helper replaces inline tie-branch logic ----
function CommentPhase({ room, myPlayerId }: { room: RoomPublic; myPlayerId: string }) {
  const comment = room.game2State?.commentState;
  // ---- CHANGED (A3): drawState.frames ----
  const frames = room.game2State?.drawState?.frames ?? [];
  // ---- CHANGED ABOVE (A3) ----
  const [text, setText] = useState('');
  const autoSubmitted = useRef(false);
  // ---- CHANGED: clearError on manual submit/vote ----
  const { clearError } = useError();
  // ---- CHANGED ABOVE ----

  const {
    secondsLeft: writingSecondsLeft,
    inGracePeriod: writingGrace,
    graceOver: writingOver,
  } = useCountdown(comment?.phaseEndsAt);
  const {
    secondsLeft: votingSecondsLeft,
    inGracePeriod: votingGrace,
    graceOver: votingOver,
  } = useCountdown(comment?.votingEndsAt);

  const myCommentSubmitted = comment?.comments[myPlayerId] !== undefined;
  const votingOpen = comment?.votingEndsAt !== null;

  const handleSubmitComment = (manual = false) => {
    // ---- CHANGED: only clear error on manual submit ----
    if (manual) clearError();
    // ---- CHANGED ABOVE ----
    console.log('[client] emitting SUBMIT_COMMENT');
    socket.emit(SOCKET_EVENTS.SUBMIT_COMMENT, {
      code: room.code,
      playerId: myPlayerId,
      text,
    });
  };

  // emergency auto-submit — skipped if they already submitted a comment
  useEffect(() => {
    if (writingOver && !autoSubmitted.current && !myCommentSubmitted) {
      autoSubmitted.current = true;
      handleSubmitComment(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writingOver]);

  const handleCommentVote = (targetPlayerId: string, vote: 'up' | 'down' | null) => {
    if (votingOver) return;
    // ---- CHANGED: clear error on vote ----
    clearError();
    // ---- CHANGED ABOVE ----
    console.log('[client] emitting SUBMIT_COMMENT_VOTE:', { targetPlayerId, vote });
    socket.emit(SOCKET_EVENTS.SUBMIT_COMMENT_VOTE, {
      code: room.code,
      voterId: myPlayerId,
      targetPlayerId,
      vote,
    });
  };

  // ---- CHANGED (C9): use shared helper instead of duplicated tie-branch logic ----
  const { text: winningCaptionText, author: winningCaptionAuthor } = formatWinningCaption(
    room.game2State?.winningCaption,
    room.players
  );
  // ---- CHANGED ABOVE (C9) ----

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <h1>Comments</h1>

      <AnimationPlayer frames={frames} />

      <p style={{ fontSize: 20, fontWeight: 700 }}>"{winningCaptionText}"</p>
      <p style={{ fontSize: 14, color: '#888' }}>Caption by {winningCaptionAuthor}</p>

      {!votingOpen && (
        <>
          <p>Write a comment! Time left: {writingSecondsLeft}s</p>
          {writingGrace && <p>Time's up, submitting...</p>}
          {writingOver && <p>Time's up — locked in.</p>}
          {/* ---- CHANGED (B9): GAME2_TEXT_MAX_LEN replaces hardcoded 300 ---- */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, GAME2_TEXT_MAX_LEN))}
            maxLength={GAME2_TEXT_MAX_LEN}
            rows={3}
            cols={40}
            disabled={writingOver}
            placeholder="Write a funny comment..."
            style={{ color: '#000', resize: 'none' }}
          />
          <p style={{ fontSize: 12, color: '#888' }}>{text.length}/{GAME2_TEXT_MAX_LEN}</p>
          {/* ---- CHANGED ABOVE (B9) ---- */}
          <button onClick={() => handleSubmitComment(true)} disabled={writingOver} style={{ color: '#000' }}>
            {myCommentSubmitted ? 'Update Comment' : 'Submit Comment'}
          </button>
          {myCommentSubmitted && <p>Submitted ✓</p>}
        </>
      )}

      {votingOpen && (
        <>
          <p>Time left to vote: {votingSecondsLeft}s</p>
          {votingGrace && <p>Time's up — last chance to vote!</p>}
          {votingOver && <p>Voting closed — tallying...</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 600 }}>
            {Object.values(comment?.comments ?? {}).map((c) => {
              const authorName = room.players.find((p) => p.playerId === c.playerId)?.name ?? '?';
              const myVote = c.playerVotes[myPlayerId] ?? null;

              return (
                <div
                  key={c.playerId}
                  style={{
                    border: '1px solid #ccc',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{authorName}</p>
                    <p style={{ margin: 0 }}>{c.text}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => handleCommentVote(c.playerId, myVote === 'up' ? null : 'up')}
                      disabled={votingOver}
                      style={{
                        color: '#000',
                        backgroundColor: myVote === 'up' ? '#4caf50' : '#eee',
                        border: '1px solid #999',
                        borderRadius: 4,
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      ▲ {c.upvotes}
                    </button>
                    <button
                      onClick={() => handleCommentVote(c.playerId, myVote === 'down' ? null : 'down')}
                      disabled={votingOver}
                      style={{
                        color: '#000',
                        backgroundColor: myVote === 'down' ? '#e63946' : '#eee',
                        border: '1px solid #999',
                        borderRadius: 4,
                        padding: '4px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      ▼ {c.downvotes}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
// ---- CHANGED ABOVE (A3+A6+B9+C9) ----

// ==================== RESULTS PHASE ====================

// ---- CHANGED (A3+A6+C9+D3): game2State refs; formatWinningCaption helper;
// winnerPlayerIds (array) for comments; getCanvasSize() ----
function ResultsPhase({ room }: { room: RoomPublic }) {
  // ---- CHANGED (A3): game2State.drawState.frames ----
  const frames = room.game2State?.drawState?.frames ?? [];
  const commentState = room.game2State?.commentState;
  const comments = commentState?.comments ?? {};
  // ---- CHANGED ABOVE (A3) ----

  // ---- CHANGED (C9): use shared helper, no more duplicated tie-branch ----
  const { text: winningCaptionText, author: winningCaptionAuthorName } = formatWinningCaption(
    room.game2State?.winningCaption,
    room.players
  );
  // ---- CHANGED ABOVE (C9) ----

  // ---- CHANGED (A6+C9): winnerPlayerIds is an array; render all co-winners ----
  const commentWinnerIds = commentState?.winnerPlayerIds ?? [];
  const commentWinnerNames = commentWinnerIds
    .map((id) => room.players.find((p) => p.playerId === id)?.name ?? '?')
    .join(' & ');
  const commentWinnerTexts = commentWinnerIds
    .map((id) => comments[id]?.text ?? '')
    .filter(Boolean)
    .join(' / ');
  // ---- CHANGED ABOVE (A6+C9) ----

  // ---- CHANGED: clearError on return to lobby ----
  const { clearError } = useError();
  // ---- CHANGED ABOVE ----

  const handleReturnToLobby = () => {
    // ---- CHANGED: clear error before navigating ----
    clearError();
    // ---- CHANGED ABOVE ----
    console.log('[client] emitting RETURN_TO_LOBBY');
    socket.emit(SOCKET_EVENTS.RETURN_TO_LOBBY, { code: room.code });
  };

  // ---- CHANGED (D3): use getCanvasSize() ----
  const canvasSize = getCanvasSize();
  // ---- CHANGED ABOVE (D3) ----

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 24 }}>
      <h1>Results!</h1>

      <AnimationPlayer frames={frames} />

      <div style={{ display: 'flex', gap: 48, justifyContent: 'center', width: '100%', maxWidth: canvasSize * 2 }}>

        <div style={{ flex: 1, textAlign: 'center', border: '2px solid #4a90e2', borderRadius: 12, padding: 16 }}>
          <h2 style={{ color: '#4a90e2' }}>🏆 Best Caption</h2>
          <p style={{ fontWeight: 700, fontSize: 18 }}>{winningCaptionAuthorName}</p>
          <p>"{winningCaptionText}"</p>
        </div>

        {/* ---- CHANGED (C9/A6): render all comment co-winners ---- */}
        <div style={{ flex: 1, textAlign: 'center', border: '2px solid #4caf50', borderRadius: 12, padding: 16 }}>
          <h2 style={{ color: '#4caf50' }}>💬 Best Comment</h2>
          <p style={{ fontWeight: 700, fontSize: 18 }}>{commentWinnerNames || '?'}</p>
          <p>"{commentWinnerTexts}"</p>
        </div>
        {/* ---- CHANGED ABOVE (C9/A6) ---- */}
      </div>

      <button onClick={handleReturnToLobby} style={{ color: '#000', fontSize: 18, padding: '10px 24px', marginTop: 16 }}>
        Return to Lobby
      </button>
    </div>
  );
}
// ---- CHANGED ABOVE (A3+A6+C9+D3) ----

// ==================== TOP-LEVEL GAME2 ROUTER ====================

// ---- CHANGED (C2): if-chain replaced with switch statement ----
// ---- CHANGED (A3): reads game2State.phase ----
function Game2({ room, myPlayerId }: { room: RoomPublic; myPlayerId: string }) {
  switch (room.game2State?.phase) {
    case 'drawing':    return <DrawingPhase room={room} myPlayerId={myPlayerId} />;
    case 'caption':    return <CaptionPhase room={room} myPlayerId={myPlayerId} />;
    case 'voting':     return <VotingPhase room={room} myPlayerId={myPlayerId} />;
    case 'commenting': return <CommentPhase room={room} myPlayerId={myPlayerId} />;
    case 'results':    return <ResultsPhase room={room} />;
    default:           return <p>Loading...</p>;
  }
}
// ---- CHANGED ABOVE (C2+A3) ----

export default Game2;
