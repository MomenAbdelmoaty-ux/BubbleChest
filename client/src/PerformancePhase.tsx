import { useState, useEffect, useRef, type CSSProperties } from 'react';
// ---- CHANGED (A1): RoomPublic from types; LOOP_MS from constants ----
import type { RoomPublic } from '../../shared/types';
import { LOOP_MS, READING_DELAY_MS } from '../../shared/constants';
// ---- CHANGED ABOVE (A1) ----
import { schedulePlayback } from './audio';

function lineContainerStyle(_active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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
    color: '#4caf50',
    fontWeight: 900,
    fontSize: 36,
  };
}

function PerformancePhase({ room }: { room: RoomPublic }) {
  const [lineIndex, setLineIndex] = useState(0);
  // ---- NEW: reading window — carousel and audio are held until this is true ----
  const [readingDone, setReadingDone] = useState(false);
  // ---- NEW ABOVE ----
  const audioStarted = useRef(false);

  // ---- CHANGED (A2+A3): rapBattle.prepState and rapBattle.performanceState ----
  const rapBattle = room.rapBattle;
  const topic = rapBattle?.prepState?.topic ?? '';
  const coupletEndings = rapBattle?.prepState?.coupletEndings ?? [];
  const startAt = rapBattle?.performanceState?.startAt;
  const isGrace = rapBattle?.phase === 'grace';
  // Carousel + audio are anchored to the END of the reading window, not startAt
  const beatStartAt = startAt !== undefined ? startAt + READING_DELAY_MS : undefined;
  // ---- CHANGED ABOVE (A2+A3) ----

  // ---- NEW: 3-second reading delay before carousel and audio begin ----
  useEffect(() => {
    if (isGrace || !startAt) return;
    const timer = setTimeout(() => setReadingDone(true), Math.max(0, startAt + READING_DELAY_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [isGrace, startAt]);
  // ---- NEW ABOVE ----

  useEffect(() => {
    // ---- CHANGED (A2+D1): only schedule audio once we're out of grace, reading is done,
    // and we have prep data ----
    if (!beatStartAt || !rapBattle?.prepState || audioStarted.current || isGrace || !readingDone) return;
    // ---- CHANGED ABOVE (A2+D1) ----
    audioStarted.current = true;
    void schedulePlayback(rapBattle.prepState.beatGrid, beatStartAt, room.numCouplets);
  }, [beatStartAt, isGrace, readingDone]);

  useEffect(() => {
    // ---- CHANGED: don't start carousel until reading delay is done ----
    if (!beatStartAt || !readingDone) return;
    // ---- CHANGED ABOVE ----
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = (index: number) => {
      const targetTime = beatStartAt + index * LOOP_MS;
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
  }, [beatStartAt, room.numCouplets, readingDone]);

  // ---- CHANGED (D1): show a "Get ready..." state during the grace/buffer window ----
  if (isGrace) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          gap: 24,
        }}
      >
        <h2 style={{ color: '#ccc', fontSize: 32 }}>Get ready...</h2>
      </div>
    );
  }
  // ---- CHANGED ABOVE (D1) ----

  // ---- NEW: show topic during the reading window before carousel starts ----
  if (!readingDone) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80vh',
          gap: 24,
        }}
      >
        <p style={topicStyle()}>
          Topic: <span style={topicWordStyle()}>{topic}</span>
        </p>
        <h2 style={{ color: '#ccc', fontSize: 24 }}>Get ready to rap...</h2>
      </div>
    );
  }
  // ---- NEW ABOVE ----

  const topLine = coupletEndings[lineIndex];
  const bottomLine = coupletEndings[lineIndex + 1];

  const renderLine = (word: string | undefined, active: boolean) => {
    if (!word) return null;
    return (
      <div style={lineContainerStyle(active)}>
        <span style={underscoreStyle(active)}>____________</span>
        <span style={wordStyle(active)}>{word}</span>
      </div>
    );
  };

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
      <p style={topicStyle()}>
        Topic: <span style={topicWordStyle()}>{topic}</span>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        {renderLine(topLine, true)}
        {renderLine(bottomLine, false)}
      </div>
    </div>
  );
}

export default PerformancePhase;
