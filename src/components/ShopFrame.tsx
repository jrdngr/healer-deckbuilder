import type { ReactNode } from 'react';
import { ScreenHeader, GoldTag } from './ScreenChrome';

interface ShopFrameProps {
  title: string;
  gold: number;
  onLeave: () => void;
  children: ReactNode;
}

// Shared chrome for the shop / node screens: a header with the title and current
// gold, the body, and a Leave button.
export function ShopFrame({ title, gold, onLeave, children }: ShopFrameProps) {
  return (
    <main className="shop-screen">
      <ScreenHeader title={title} right={<GoldTag gold={gold} />} />
      {children}
      <button className="leave-btn" onClick={onLeave}>Leave</button>
    </main>
  );
}
