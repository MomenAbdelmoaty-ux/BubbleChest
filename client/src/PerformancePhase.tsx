import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { type RoomPublic, LOOP_MS } from '../../shared/events';
import { schedulePlayback } from './audio';

// ---- CHANGED: active line now shows "____________ WORD" where only the word
// has a red background — underscores are plain text, word is highlighted.
// inactive (preview) line shows the same layout but smaller and grey. ----
function lineContainerStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: active ? 12 : 8,
    transition: 'all 0.3s ease',
  };
}

function underscoreStyle(active: boolean): CSSProperties {
  return {
    fontFamily: '"Arial Black", Impact, sans-serif',
    fontWeight: 900,
    fontSize: active ? 48 : 28,
    color: active ? '#fff' : '#666',
    letterSpacing: 2,
    transition: 'all 0.3s ease',
  };
}

function wordStyle(active: boolean): CSSProperties {
  return {
    fontFamily: '"Arial Black", Impact, sans-serif',
    fontWeight: 900,
    fontSize: active ? 64 : 36,
    color: '#fff',
    backgroundColor: active ? '#e63946' : 'transparent',
    padding: active ? '8px 24px' : '0',
    borderRadius: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
    transition: 'all 0.3s ease',
  };
}
// ---- CHANGED ABOVE ----

// ---- CHANGED: topic now displayed larger with the actual topic word in green ----
function topicStyle(): CSSProperties {
  return {
    fontSize: 28,
    fontWeight: 700,
    textAlign: 'center',
    color: '#ccc',
    letterSpacing: 1,
  };
}

function topicWordStyle(): CSSProperties {
  return {
    color: '#4caf50', // green text, no background
    fontWeight: 900,
    fontSize: 36,
  };
}
// ---- CHANGED ABOVE ----

function PerformancePhase({ room }: { room: RoomPublic }) {
  const [lineIndex, setLineIndex] = useState(0);
  const audioStarted = useRef(false);

  const topic = room.prep?.topic ?? '';
  const coupletEndings = room.prep?.coupletEndings ?? [];
  const startAt = room.performance?.startAt;

  useEffect(() => {
    if (!startAt || !room.prep || audioStarted.current) return;
    audioStarted.current = true;
    void schedulePlayback(room.prep.beatGrid, startAt, room.numCouplets);
  }, [startAt]);

  useEffect(() => {
    if (!startAt) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = (index: number) => {
      const targetTime = startAt + index * LOOP_MS;
      const delay = Math.max(0, targetTime - Date.now());
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setLineIndex(index);
        if (index < room.numCouplets) {
          scheduleNext(index + 1);
        }
      }, delay);
    };

    scheduleNext(0);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [startAt, room.numCouplets]);

  const topLine = coupletEndings[lineIndex];
  const bottomLine = coupletEndings[lineIndex + 1];

  // ---- CHANGED: renders "____________ WORD" layout with separate spans
  // so the red background only sits behind the word, not the underscores ----
  const renderLine = (word: string | undefined, active: boolean) => {
    if (!word) return null;
    return (
      <div style={lineContainerStyle(active)}>
        <span style={underscoreStyle(active)}>____________</span>
        <span style={wordStyle(active)}>{word}</span>
      </div>
    );
  };
  // ---- CHANGED ABOVE ----

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        gap: 40,
      }}
    >
      {/* ---- CHANGED: topic split into label + word so the word itself
          can be styled separately in green ---- */}
      <p style={topicStyle()}>
        Topic: <span style={topicWordStyle()}>{topic}</span>
      </p>
      {/* ---- CHANGED ABOVE ---- */}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {renderLine(topLine, true)}
        {renderLine(bottomLine, false)}
      </div>
    </div>
  );
}

export default PerformancePhase;
