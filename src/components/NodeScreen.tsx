import type { Run } from '../run';
import type { RunAct } from '../useRun';
import { CardShopScreen } from './CardShopScreen';
import { CardUpgradeShopScreen } from './CardUpgradeShopScreen';
import { PartyUpgradeShopScreen } from './PartyUpgradeShopScreen';
import { HealerUpgradeShopScreen } from './HealerUpgradeShopScreen';
import { EventScreen } from './EventScreen';
import { ReliquaryScreen } from './ReliquaryScreen';
import { RecruitScreen } from './RecruitScreen';

interface NodeScreenProps {
  run: Run;
  act: RunAct;
  onDone: () => void;
}

// A non-fight node: dispatch to the screen for its rolled content.
export function NodeScreen({ run, act, onDone }: NodeScreenProps) {
  const content = run.nodeContent;
  if (run.location.kind !== 'node' || !content) return null;

  switch (content.type) {
    case 'cardShop':
      return <CardShopScreen run={run} act={act} onDone={onDone} />;
    case 'cardUpgrade':
      return <CardUpgradeShopScreen run={run} act={act} onDone={onDone} />;
    case 'partyUpgrade':
      return <PartyUpgradeShopScreen run={run} act={act} onDone={onDone} />;
    case 'healerUpgrade':
      return <HealerUpgradeShopScreen run={run} act={act} onDone={onDone} />;
    case 'event':
      return <EventScreen run={run} act={act} onDone={onDone} />;
    case 'recruit':
      return <RecruitScreen run={run} act={act} onDone={onDone} />;
    case 'reliquary':
      return <ReliquaryScreen run={run} act={act} onDone={onDone} />;
    default:
      return null;
  }
}
