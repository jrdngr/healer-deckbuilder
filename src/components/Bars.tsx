import type { ReactNode } from 'react';

// The shared HP/MP bar frame: a track holding one or more fill segments, plus a
// label. Segments are passed as children (a single fill for HP, or the layered
// mp/siphon/refresh fills for MP); `extra` renders after the label, inside the bar
// (the MP bar's refresh/siphon pills).
export function StatBar({ className, label, extra, children }: {
  className?: string;
  label: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={className ? `bar ${className}` : 'bar'}>
      <div className="bar-track">{children}</div>
      <span className="bar-label">{label}</span>
      {extra}
    </div>
  );
}
