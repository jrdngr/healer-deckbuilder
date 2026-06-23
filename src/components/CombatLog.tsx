import { useEffect, useRef } from 'react';
import type { Game } from '../engine';

export function CombatLog({ game }: { game: Game }) {
  const ref = useRef<HTMLUListElement>(null);

  // Keep the log pinned to the latest entry, like the old UI did each render.
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  });

  let prevTurn: number | null = null;
  return (
    <section className="log-wrap">
      <h3>Combat log</h3>
      <ul className="log" ref={ref}>
        {game.log.map((entry, i) => {
          const sep = prevTurn !== null && entry.turn !== prevTurn;
          prevTurn = entry.turn;
          return (
            <li key={i} className={`${entry.kind}${sep ? ' turn-sep' : ''}`}>
              T{entry.turn}: {entry.text}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
