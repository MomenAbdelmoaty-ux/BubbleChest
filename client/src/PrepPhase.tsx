import { useState, useEffect, useRef } from 'react';
// ---- CHANGED (A1): SOCKET_EVENTS from events; types from types; constants from constants ----
import { SOCKET_EVENTS } from '../../shared/events';
import type { PrepState, RoomPublic } from '../../shared/types';
import { INPUT_GRACE_MS } from '../../shared/constants';
// ---- CHANGED ABOVE (A1) ----
import { socket } from './socket';
import { SAMPLES, playOnce, previewLoop } from './audio';

// ---- CHANGED (C7): useCountdown now also tracks the INPUT_GRACE_MS window after time is up ----
function useCountdown(endsAt: number | undefined) {
  const [secondsLeft, setSecondsLeft] = useState(-1);
  const [inGracePeriod, setInGracePeriod] = useState(false);

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const remaining = endsAt - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
      setInGracePeriod(remaining <= 0 && remaining > -INPUT_GRACE_MS);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  return { secondsLeft, inGracePeriod };
}
// ---- CHANGED ABOVE (C7) ----

// ---- CHANGED (A2+A3): receives prep via rapBattle.prepState, passed as a prop here ----
function TopicInput({ code, prep }: { code: string; prep: PrepState }) {
  const [topic, setTopic] = useState(prep.topic);
  // ---- CHANGED (C7): destructure both values from useCountdown ----
  const { secondsLeft, inGracePeriod } = useCountdown(prep.prepEndsAt);
  // ---- CHANGED ABOVE (C7) ----
  const autoSubmitted = useRef(false);

  // ---- CHANGED (C4): autoSubmitted.current = true set inside submit() so a
  // manual submit prevents the auto-submit from also firing ----
  const submit = () => {
    autoSubmitted.current = true;
    console.log('[client] emitting SUBMIT_TOPIC:', { code, topic });
    socket.emit(SOCKET_EVENTS.SUBMIT_TOPIC, { code, topic });
  };
  // ---- CHANGED ABOVE (C4) ----

  // ---- CHANGED (C7): auto-submit fires after INPUT_GRACE_MS, not immediately at 0 ----
  useEffect(() => {
    if (secondsLeft === 0 && !inGracePeriod && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, inGracePeriod]);
  // ---- CHANGED ABOVE (C7) ----

  return (
    <div>
      <h2>Record Label — pick the topic</h2>
      {/* ---- CHANGED (C7): disable inputs during grace period ---- */}
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. Monday mornings"
        disabled={inGracePeriod}
      />
      {inGracePeriod ? (
        <p>Time's up, submitting...</p>
      ) : (
        <button onClick={submit} style={{ color: '#000' }}>
          {prep.submitted.recordLabel ? 'Update Topic' : 'Submit Topic'}
        </button>
      )}
      {/* ---- CHANGED ABOVE (C7) ---- */}
      {prep.submitted.recordLabel && <p>Submitted ✓</p>}
    </div>
  );
}

function CoupletsInput({ code, prep, numCouplets }: { code: string; prep: PrepState; numCouplets: number }) {
  const [endings, setEndings] = useState<string[]>(
    prep.coupletEndings.length === numCouplets ? prep.coupletEndings : Array(numCouplets).fill('')
  );
  // ---- CHANGED (C7): destructure both values ----
  const { secondsLeft, inGracePeriod } = useCountdown(prep.prepEndsAt);
  // ---- CHANGED ABOVE (C7) ----
  const autoSubmitted = useRef(false);

  const updateEnding = (i: number, value: string) => {
    setEndings((prev) => prev.map((e, idx) => (idx === i ? value : e)));
  };

  // ---- CHANGED (C4): autoSubmitted.current set inside submit ----
  const submit = () => {
    autoSubmitted.current = true;
    console.log('[client] emitting SUBMIT_COUPLETS:', { code, endings });
    socket.emit(SOCKET_EVENTS.SUBMIT_COUPLETS, { code, coupletEndings: endings });
  };
  // ---- CHANGED ABOVE (C4) ----

  // ---- CHANGED (C7): auto-submit after grace period ----
  useEffect(() => {
    if (secondsLeft === 0 && !inGracePeriod && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, inGracePeriod]);
  // ---- CHANGED ABOVE (C7) ----

  return (
    <div>
      <h2>Ghostwriter — write the couplet endings</h2>
      {/* ---- CHANGED (C7): disable inputs during grace period ---- */}
      {endings.map((ending, i) => (
        <div key={i}>
          <input
            value={ending}
            onChange={(e) => updateEnding(i, e.target.value)}
            placeholder={`Line ${i + 1} ending`}
            disabled={inGracePeriod}
          />
        </div>
      ))}
      {inGracePeriod ? (
        <p>Time's up, submitting...</p>
      ) : (
        <button onClick={submit} style={{ color: '#000' }}>
          {prep.submitted.ghostwriter ? 'Update Couplets' : 'Submit Couplets'}
        </button>
      )}
      {/* ---- CHANGED ABOVE (C7) ---- */}
      {prep.submitted.ghostwriter && <p>Submitted ✓</p>}
    </div>
  );
}

function BeatGrid({ code, prep }: { code: string; prep: PrepState }) {
  const [grid, setGrid] = useState<boolean[][]>(prep.beatGrid);
  // ---- CHANGED (C7): destructure both values ----
  const { secondsLeft, inGracePeriod } = useCountdown(prep.prepEndsAt);
  // ---- CHANGED ABOVE (C7) ----
  const autoSubmitted = useRef(false);

  const toggleCell = (row: number, col: number) => {
    // ---- CHANGED (C7): disable toggling during grace period ----
    if (inGracePeriod) return;
    // ---- CHANGED ABOVE (C7) ----
    setGrid((prev) => {
      const newGrid = prev.map((r, ri) => r.map((cell, ci) => (ri === row && ci === col ? !cell : cell)));
      const cellIsNowOn = newGrid[row]?.[col] === true;
      if (cellIsNowOn) {
        void playOnce(row);
      }
      return newGrid;
    });
  };

  // ---- CHANGED (C4): autoSubmitted.current set inside submit ----
  const submit = () => {
    autoSubmitted.current = true;
    console.log('[client] emitting SUBMIT_BEAT:', { code });
    socket.emit(SOCKET_EVENTS.SUBMIT_BEAT, { code, beatGrid: grid });
  };
  // ---- CHANGED ABOVE (C4) ----

  const handlePreview = () => {
    void previewLoop(grid);
  };

  // ---- CHANGED (C7): auto-submit after grace period ----
  useEffect(() => {
    if (secondsLeft === 0 && !inGracePeriod && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, inGracePeriod]);
  // ---- CHANGED ABOVE (C7) ----

  return (
    <div>
      <h2>Producer — build the beat</h2>
      {grid.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 90 }}>{SAMPLES[ri]?.label ?? `Row ${ri + 1}`}</span>
          {row.map((cell, ci) => (
            <button
              key={ci}
              onClick={() => toggleCell(ri, ci)}
              // ---- CHANGED (C7): disable grid cells during grace period ----
              disabled={inGracePeriod}
              // ---- CHANGED ABOVE (C7) ----
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
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {/* ---- CHANGED (C7): disable Preview and Submit during grace period ---- */}
        <button onClick={handlePreview} style={{ color: '#000' }} disabled={inGracePeriod}>
          Preview
        </button>
        {inGracePeriod ? (
          <p>Time's up, submitting...</p>
        ) : (
          <button onClick={submit} style={{ color: '#000' }}>
            {prep.submitted.producer ? 'Update Beat' : 'Submit Beat'}
          </button>
        )}
        {/* ---- CHANGED ABOVE (C7) ---- */}
      </div>
      {prep.submitted.producer && <p>Submitted ✓</p>}
    </div>
  );
}

function PrepPhase({ room, myRole }: { room: RoomPublic; myRole: string | null }) {
  // ---- CHANGED (A2+A3): room.rapBattle?.prepState instead of room.prep ----
  const prepState = room.rapBattle?.prepState;
  const { secondsLeft } = useCountdown(prepState?.prepEndsAt);
  // ---- CHANGED ABOVE (A2+A3) ----

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
