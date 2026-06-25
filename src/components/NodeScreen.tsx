import type { Run } from '../run';
import { NODE_META } from './nodeMeta';

interface NodeScreenProps {
  run: Run;
  act: (fn: (run: Run) => void) => void;
  onDone: () => void;
}

// A non-fight node. Shops and events render their own screens (added in later
// commits); until then this is a placeholder that lets the run progress.
export function NodeScreen({ run, onDone }: NodeScreenProps) {
  if (run.location.kind !== 'node') return null;
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
