import { useState, useEffect, useRef } from 'react';
// ---- FIX 1: import the real shared types instead of redeclaring local
// copies of PrepState/RoomState — no more duplicate, drift-prone interfaces ----
import { SOCKET_EVENTS, type PrepState, type RoomPublic } from '../../shared/events';
import { socket } from './socket';

const INSTRUMENT_NAMES = ['Instrument 1', 'Instrument 2', 'Instrument 3', 'Instrument 4'];

// Pair colors for couplet display: pair 0 (lines 0,1) = light blue,
// pair 1 (lines 2,3) = light green, pair 2 = light blue again, etc.
const PAIR_COLORS = ['#add8e6', '#90ee90']; // light blue, light green

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

  const toggleCell = (row: number, col: number) => {
    setGrid((prev) => prev.map((r, ri) => r.map((cell, ci) => (ri === row && ci === col ? !cell : cell))));
  };

  const submit = () => {
    socket.emit(SOCKET_EVENTS.SUBMIT_BEAT, { code, beatGrid: grid });
  };

  useEffect(() => {
    if (secondsLeft === 0 && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit();
    }
  }, [secondsLeft]);

  return (
    <div>
      <h2>Producer — build the beat</h2>
      {grid.map((row, ri) => (
        // ---- FIX 4a: instrument name label added to the left of each row ----
        <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 90 }}>{INSTRUMENT_NAMES[ri] ?? `Instrument ${ri + 1}`}</span>
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
        // ---- FIX 4a ABOVE ----
      ))}
      <button onClick={submit} style={{ color: '#000' }}>
        {prep.submitted.producer ? 'Update Beat' : 'Submit Beat'}
      </button>
      {prep.submitted.producer && <p>Submitted ✓</p>}
    </div>
  );
}

function PrepPhase({ room, myRole }: { room: RoomPublic; myRole: string | null }) {
  const secondsLeft = useCountdown(room.prep?.prepEndsAt);

  if (room.status === 'performance' || room.status === 'round-end') {
    return (
      <div>
        <h1>Prep phase over!</h1>
        <p>Topic: {room.prep?.topic || '(none submitted)'}</p>

        {/* ---- FIX 3: couplet display redesigned — blank line + colored word,
            pairs of two lines sharing the same color, alternating blue/green ---- */}
        <div>
          {room.prep?.coupletEndings.map((ending, i) =>
            ending ? (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span>__________</span>
                <span
                  style={{
                    backgroundColor: PAIR_COLORS[Math.floor(i / 2) % 2],
                    color: '#000',
                    padding: '2px 10px',
                    borderRadius: 4,
                  }}
                >
                  {ending}
                </span>
              </div>
            ) : null
          )}
        </div>
        {/* ---- FIX 3 ABOVE ---- */}

        {/* ---- FIX 4b: removed the "3/5/7/4 steps active per row" summary —
            the beat grid data is only ever consumed by playback code later,
            never meaningfully shown as a number to a person ---- */}

        <p>(Performance phase UI coming next.)</p>
      </div>
    );
  }

  if (!room.prep) {
    return <p>Loading prep phase...</p>;
  }

  return (
    <div>
      <h1>Room: {room.code}</h1>
      <p>Time left: {secondsLeft}s</p>

      {myRole === 'record-label' && <TopicInput code={room.code} prep={room.prep} />}
      {myRole === 'ghostwriter' && (
        // ---- FIX 2: numCouplets now comes from the real server setting,
        // not a guess based on the current array's length ----
        <CoupletsInput code={room.code} prep={room.prep} numCouplets={room.numCouplets} />
        // ---- FIX 2 ABOVE ----
      )}
      {myRole === 'producer' && <BeatGrid code={room.code} prep={room.prep} />}
      {myRole === 'rapper' && <p>Waiting on your team to finish prep...</p>}
      {!myRole && <p>No role assigned.</p>}
    </div>
  );
}

export default PrepPhase;