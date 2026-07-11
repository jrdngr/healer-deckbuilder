import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { RelicTile } from './RelicTile';
import { RewardScreen, GoldTag } from './ScreenChrome';

interface SpoilsScreenProps {
  run: Run;
  act: RunAct;
}

// The free relic pick after the act-1 and act-2 bosses (#21): take one of the
// offered relics, or walk on empty-handed.
export function SpoilsScreen({ run, act }: SpoilsScreenProps) {
  if (run.location.kind !== 'spoils' || run.nodeContent?.type !== 'spoils') return null;
  const offers = run.nodeContent.offers;

  return (
    <RewardScreen
      title="Spoils of Victory"
      headerRight={<GoldTag gold={run.gold} />}
      onSkip={() => act((r) => r.skipSpoils())}
    >
      {offers.map((offer, i) => (
        <RelicTile
          key={offer.relicId}
          offer={offer}
          affordable
          onClick={() => act((r) => r.pickSpoil(i))}
        />
      ))}
    </RewardScreen>
  );
}
