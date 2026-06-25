import type { Run } from '../run';
import { NODE_META } from './nodeMeta';
import { CardShopScreen } from './CardShopScreen';
import { CardUpgradeShopScreen } from './CardUpgradeShopScreen';
import { PartyUpgradeShopScreen } from './PartyUpgradeShopScreen';
import { HealerUpgradeShopScreen } from './HealerUpgradeShopScreen';

interface NodeScreenProps {
  run: Run;
  act: (fn: (run: Run) => void) => void;
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
    default: {
      // Event screen lands in the next commit; placeholder keeps the run movable.
      const meta = NODE_META[run.location.nodeType];
      return (
        <main className="node-screen">
          <div className="node-card">
            <span className="node-icon" aria-hidden>{meta.icon}</span>
            <h2>{meta.label}</h2>
            <p>{meta.desc}</p>
            <p className="node-placeholder">(This node’s screen is coming soon.)</p>
            <button className="primary" onClick={onDone}>Continue</button>
          </div>
        </main>
      );
    }
  }
}
