import { useState, useEffect, useRef } from 'react';
import { SOCKET_EVENTS } from '../../shared/events';
import type { PrepState, RoomPublic } from '../../shared/types';
import { socket } from './socket';
import { SAMPLES, playOnce, previewLoop } from './audio';
import { useError } from './ErrorContext';
// ---- CHANGED: shared countdown hook (local copy removed) ----
import { useCountdown } from './useCountdown';
// ---- CHANGED ABOVE ----

// ---- CHANGED (grace): during the INPUT_GRACE_MS window after the countdown hits 0 the
// inputs stay EDITABLE and manually submittable, with a "Time's up, submitting..." notice.
// At the end of the grace window (graceOver) inputs lock for the SERVER_BUFFER_MS dead
// window (race-condition guard). The auto-submit is an EMERGENCY FALLBACK only: it fires
// solely if the server has no submission from this player yet (prep.submitted.* is false).
// If the player already submitted manually, the auto-submit is skipped. ----

function TopicInput({ code, prep }: { code: string; prep: PrepState }) {
  const [topic, setTopic] = useState(prep.topic);
  const { inGracePeriod, graceOver } = useCountdown(prep.prepEndsAt);
  const autoSubmitted = useRef(false);
  const { clearError } = useError();

  const submit = (manual = false) => {
    if (manual) clearError();
    console.log('[client] emitting SUBMIT_TOPIC:', { code, topic });
    socket.emit(SOCKET_EVENTS.SUBMIT_TOPIC, { code, topic });
  };

  useEffect(() => {
    if (graceOver && !autoSubmitted.current && !prep.submitted.recordLabel) {
      autoSubmitted.current = true;
      submit(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graceOver]);

  return (
    <div>
      <h2>Record Label — pick the topic</h2>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. Monday mornings"
        disabled={graceOver}
      />
      <button onClick={() => submit(true)} disabled={graceOver} style={{ color: '#000' }}>
        {prep.submitted.recordLabel ? 'Update Topic' : 'Submit Topic'}
      </button>
      {inGracePeriod && <p>Time's up, submitting...</p>}
      {graceOver && <p>Time's up — locked in.</p>}
      {prep.submitted.recordLabel && <p>Submitted ✓</p>}
    </div>
  );
}

function CoupletsInput({ code, prep, numCouplets }: { code: string; prep: PrepState; numCouplets: number }) {
  const [endings, setEndings] = useState<string[]>(
    prep.coupletEndings.length === numCouplets ? prep.coupletEndings : Array(numCouplets).fill('')
  );
  const { inGracePeriod, graceOver } = useCountdown(prep.prepEndsAt);
  const autoSubmitted = useRef(false);
  const { clearError } = useError();

  const updateEnding = (i: number, value: string) => {
    setEndings((prev) => prev.map((e, idx) => (idx === i ? value : e)));
  };

  const submit = (manual = false) => {
    if (manual) clearError();
    console.log('[client] emitting SUBMIT_COUPLETS:', { code, endings });
    socket.emit(SOCKET_EVENTS.SUBMIT_COUPLETS, { code, coupletEndings: endings });
  };

  useEffect(() => {
    if (graceOver && !autoSubmitted.current && !prep.submitted.ghostwriter) {
      autoSubmitted.current = true;
      submit(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graceOver]);

  return (
    <div>
      <h2>Ghostwriter — write the couplet endings</h2>
      {endings.map((ending, i) => (
        <div key={i}>
          <input
            value={ending}
            onChange={(e) => updateEnding(i, e.target.value)}
            placeholder={`Line ${i + 1} ending`}
            disabled={graceOver}
          />
        </div>
      ))}
      <button onClick={() => submit(true)} disabled={graceOver} style={{ color: '#000' }}>
        {prep.submitted.ghostwriter ? 'Update Couplets' : 'Submit Couplets'}
      </button>
      {inGracePeriod && <p>Time's up, submitting...</p>}
      {graceOver && <p>Time's up — locked in.</p>}
      {prep.submitted.ghostwriter && <p>Submitted ✓</p>}
    </div>
  );
}

function BeatGrid({ code, prep }: { code: string; prep: PrepState }) {
  const [grid, setGrid] = useState<boolean[][]>(prep.beatGrid);
  const { inGracePeriod, graceOver } = useCountdown(prep.prepEndsAt);
  const autoSubmitted = useRef(false);
  const { clearError } = useError();

  const toggleCell = (row: number, col: number) => {
    // locked only once the grace window is over (dead window), not during grace
    if (graceOver) return;
    setGrid((prev) => {
      const newGrid = prev.map((r, ri) => r.map((cell, ci) => (ri === row && ci === col ? !cell : cell)));
      const cellIsNowOn = newGrid[row]?.[col] === true;
      if (cellIsNowOn) {
        void playOnce(row);
      }
      return newGrid;
    });
  };

  const submit = (manual = false) => {
    if (manual) clearError();
    console.log('[client] emitting SUBMIT_BEAT:', { code });
    socket.emit(SOCKET_EVENTS.SUBMIT_BEAT, { code, beatGrid: grid });
  };

  const handlePreview = () => {
    void previewLoop(grid);
  };

  useEffect(() => {
    if (graceOver && !autoSubmitted.current && !prep.submitted.producer) {
      autoSubmitted.current = true;
      submit(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graceOver]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2>Producer — build the beat</h2>
      {grid.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ width: 90 }}>{SAMPLES[ri]?.label ?? `Row ${ri + 1}`}</span>
          {row.map((cell, ci) => (
            <button
              key={ci}
              onClick={() => toggleCell(ri, ci)}
              disabled={graceOver}
              style={{
                width: 32,
                height: 32,
                backgroundColor: cell ? '#4a90e2' : '#ddd',
                border: '1px solid #999',
              }}
            />
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
        <button onClick={handlePreview} style={{ color: '#000' }} disabled={graceOver}>
          Preview
        </button>
        <button onClick={() => submit(true)} disabled={graceOver} style={{ color: '#000' }}>
          {prep.submitted.producer ? 'Update Beat' : 'Submit Beat'}
        </button>
      </div>
      {inGracePeriod && <p>Time's up, submitting...</p>}
      {graceOver && <p>Time's up — locked in.</p>}
      {prep.submitted.producer && <p>Submitted ✓</p>}
    </div>
  );
}

function PrepPhase({ room, myRole }: { room: RoomPublic; myRole: string | null }) {
  const prepState = room.rapBattle?.prepState;
  const { secondsLeft } = useCountdown(prepState?.prepEndsAt);

  if (!prepState) {
    return <p>Loading prep phase...</p>;
  }

  return (
    <div>
      <h1>Room: {room.code}</h1>
      <p>Time left: {secondsLeft}s</p>

      {myRole === 'record-label' && <TopicInput code={room.code} prep={prepState} />}
      {myRole === 'ghostwriter' && (
        <CoupletsInput code={room.code} prep={prepState} numCouplets={room.numCouplets} />
      )}
      {myRole === 'producer' && <BeatGrid code={room.code} prep={prepState} />}

      {myRole === 'rapper' && (
        <div>
          <h2>Waiting on your team...</h2>
          <ul>
            <li>Record Label (topic): {prepState.submitted.recordLabel ? '✓ Submitted' : 'Waiting...'}</li>
            <li>Ghostwriter (couplets): {prepState.submitted.ghostwriter ? '✓ Submitted' : 'Waiting...'}</li>
            <li>Producer (beat): {prepState.submitted.producer ? '✓ Submitted' : 'Waiting...'}</li>
          </ul>
        </div>
      )}

      {!myRole && <p>No role assigned.</p>}
    </div>
  );
}

export default PrepPhase;
