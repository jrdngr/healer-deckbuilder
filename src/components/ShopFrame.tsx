import type { ReactNode } from 'react';

interface ShopFrameProps {
  title: string;
  subtitle: string;
  gold: number;
  onLeave: () => void;
  children: ReactNode;
}

// Shared chrome for the shop / node screens: a header with the title and current
// gold, the body, and a Leave button.
export function ShopFrame({ title, subtitle, gold, onLeave, children }: ShopFrameProps) {
  return (
    <main className="shop-screen">
      <header className="shop-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="run-gold" title="Gold">⦿ {gold}</span>
      </header>
      {children}
      <button className="leave-btn" onClick={onLeave}>Leave</button>
    </main>
  );
}
