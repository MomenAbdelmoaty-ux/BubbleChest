import { useState, useEffect, useRef } from 'react';
import { SOCKET_EVENTS, type PrepState, type RoomPublic } from '../../shared/events';
import { socket } from './socket';
import { SAMPLES, playOnce, previewLoop, stopPreview } from './audio';

function useCountdown(endsAt: number | undefined) {
  const [secondsLeft, setSecondsLeft] = useState(-1);

  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  return secondsLeft;
}

function TopicInput({ code, prep }: { code: string; prep: PrepState }) {
  const [topic, setTopic] = useState(prep.topic);
  const secondsLeft = useCountdown(prep.prepEndsAt);
  const autoSubmitted = useRef(false);

  const submit = () => {
    console.log('[client] emitting SUBMIT_TOPIC:', { code, topic });
    socket.emit(SOCKET_EVENTS.SUBMIT_TOPIC, { code, topic });
  };

  useEffect(() => {
    if (secondsLeft === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit();
    }
  }, [secondsLeft]);

  return (
    <div>
      <h2>Record Label — pick the topic</h2>
      <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Monday mornings" />
      <button onClick={submit} style={{ color: '#000' }}>
        {prep.submitted.recordLabel ? 'Update Topic' : 'Submit Topic'}
      </button>
      {prep.submitted.recordLabel && <p>Submitted ✓</p>}
    </div>
  );
}

function CoupletsInput({ code, prep, numCouplets }: { code: string; prep: PrepState; numCouplets: number }) {
  const [endings, setEndings] = useState<string[]>(
    prep.coupletEndings.length === numCouplets ? prep.coupletEndings : Array(numCouplets).fill('')
  );
  const secondsLeft = useCountdown(prep.prepEndsAt);
  const autoSubmitted = useRef(false);

  const updateEnding = (i: number, value: string) => {
    setEndings((prev) => prev.map((e, idx) => (idx === i ? value : e)));
  };

  const submit = () => {
    console.log('[client] emitting SUBMIT_COUPLETS:', { code, endings });
    socket.emit(SOCKET_EVENTS.SUBMIT_COUPLETS, { code, coupletEndings: endings });
  };

  useEffect(() => {
    if (secondsLeft === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit();
    }
  }, [secondsLeft]);

  return (
    <div>
      <h2>Ghostwriter — write the couplet endings</h2>
      {endings.map((ending, i) => (
        <div key={i}>
          <input
            value={ending}
            onChange={(e) => updateEnding(i, e.target.value)}
            placeholder={`Line ${i + 1} ending`}
          />
        </div>
      ))}
      <button onClick={submit} style={{ color: '#000' }}>
        {prep.submitted.ghostwriter ? 'Update Couplets' : 'Submit Couplets'}
      </button>
      {prep.submitted.ghostwriter && <p>Submitted ✓</p>}
    </div>
  );
}

function BeatGrid({ code, prep }: { code: string; prep: PrepState }) {
  const [grid, setGrid] = useState<boolean[][]>(prep.beatGrid);
  const secondsLeft = useCountdown(prep.prepEndsAt);
  const autoSubmitted = useRef(false);

  // ---- NEW: toggling a cell ON immediately plays that instrument once so
  // the Producer gets audio feedback. Toggling OFF makes no sound since
  // silence is already self-evident. playOnce is called inside the setGrid
  // updater function (the (prev) => form) because that's where we have
  // access to the new grid state to confirm the cell is now truly ON. ----
  const toggleCell = (row: number, col: number) => {
    setGrid((prev) => {
      const newGrid = prev.map((r, ri) => r.map((cell, ci) => (ri === row && ci === col ? !cell : cell)));
      const cellIsNowOn = newGrid[row]?.[col] === true;
      if (cellIsNowOn) {
        void playOnce(row);
      }
      return newGrid;
    });
  };
  // ---- NEW ABOVE ----

  const submit = () => {
    console.log('[client] emitting SUBMIT_BEAT:', { code });
    socket.emit(SOCKET_EVENTS.SUBMIT_BEAT, { code, beatGrid: grid });
  };

  // ---- NEW: plays one full loop of the current grid state immediately.
  // All hits are scheduled up front before playback begins, so any grid
  // changes made while the loop plays have no effect on the current preview. ----
  const handlePreview = () => {
    void previewLoop(grid);
  };
  // ---- NEW ABOVE ----

  // ---- NEW: stops any in-progress preview when the prep phase ends
  // (component unmounts) so audio doesn't bleed into performance phase ----
  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);
  // ---- NEW ABOVE ----
  useEffect(() => {
    if (secondsLeft === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit();
    }
  }, [secondsLeft]);

  // Replace the BeatGrid return's outer div and button row:

  // ---- FIX: centered the entire grid including instrument labels,
  // and centered the Preview+Submit button row ----
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2>Producer — build the beat</h2>
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
        {grid.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 90, textAlign: 'right' }}>{SAMPLES[ri]?.label ?? `Row ${ri + 1}`}</span>
            {row.map((cell, ci) => (
              <button
                key={ci}
                onClick={() => toggleCell(ri, ci)}
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
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
        <button onClick={handlePreview} style={{ color: '#000' }}>Preview</button>
        <button onClick={submit} style={{ color: '#000' }}>
          {prep.submitted.producer ? 'Update Beat' : 'Submit Beat'}
        </button>
      </div>
      {prep.submitted.producer && <p>Submitted ✓</p>}
    </div>
  );
  // ---- FIX ABOVE ----
}

function PrepPhase({ room, myRole }: { room: RoomPublic; myRole: string | null }) {
  const secondsLeft = useCountdown(room.prep?.prepEndsAt);

  if (!room.prep) {
    return <p>Loading prep phase...</p>;
  }

  return (
    <div>
      <h1>Room: {room.code}</h1>
      <p>Time left: {secondsLeft}s</p>

      {myRole === 'record-label' && <TopicInput code={room.code} prep={room.prep} />}
      {myRole === 'ghostwriter' && (
        <CoupletsInput code={room.code} prep={room.prep} numCouplets={room.numCouplets} />
      )}
      {myRole === 'producer' && <BeatGrid code={room.code} prep={room.prep} />}

      {myRole === 'rapper' && (
        <div>
          <h2>Waiting on your team...</h2>
          <ul>
            <li>Record Label (topic): {room.prep.submitted.recordLabel ? '✓ Submitted' : 'Waiting...'}</li>
            <li>Ghostwriter (couplets): {room.prep.submitted.ghostwriter ? '✓ Submitted' : 'Waiting...'}</li>
            <li>Producer (beat): {room.prep.submitted.producer ? '✓ Submitted' : 'Waiting...'}</li>
          </ul>
        </div>
      )}

      {!myRole && <p>No role assigned.</p>}
    </div>
  );
}

export default PrepPhase;
