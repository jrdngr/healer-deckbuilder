import type { ReactNode } from 'react';

// The ⦿ gold pill shown in the topbar and on every shop/reward header.
export function GoldTag({ gold, label = 'Gold' }: { gold: number; label?: string }) {
  return <span className="run-gold" title={label}>⦿ {gold}</span>;
}

// The shared header row for shop / reward / draft screens: a title on the left and
// an optional right-hand slot (a GoldTag, a free-pick note, or a small button).
export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="shop-head">
      <div>
        <h2>{title}</h2>
      </div>
      {right}
    </header>
  );
}

// A pick-one-or-skip reward screen (card reward, relic spoils, healer boon): the
// shared shell — header, an optional hint line, the offer row, and a skip button.
// The offers themselves (a Card, a RelicTile, a boon button) are passed as children.
export function RewardScreen({
  title, headerRight, hint, skipLabel = 'Take nothing', onSkip, children,
}: {
  title: string;
  headerRight?: ReactNode;
  hint?: ReactNode;
  skipLabel?: string;
  onSkip: () => void;
  children: ReactNode;
}) {
  return (
    <main className="shop-screen">
      <ScreenHeader title={title} right={headerRight} />
      {hint != null && <p className="shop-hint">{hint}</p>}
      <div className="shop-offers">{children}</div>
      <button className="leave-btn" onClick={onSkip}>{skipLabel}</button>
    </main>
  );
}
