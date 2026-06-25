import { useState } from 'react';
import { useRun } from './useRun';
import type { Run } from './run';
import { FIGHT_COUNT, NODES_PER_BRANCH } from './constants';
import { Topbar } from './components/Topbar';
import { StartScreen } from './components/StartScreen';
import { FightScreen } from './components/FightScreen';
import { MapScreen } from './components/MapScreen';
import { NodeScreen } from './components/NodeScreen';
import { RunOverScreen } from './components/RunOverScreen';

// A short label for where the player is in the run, shown in the topbar.
function progressLabel(run: Run): string {
  if (run.status === 'won') return 'Run complete';
  if (run.status === 'lost') return 'Run over';
  const loc = run.location;
  if (loc.kind === 'start') return 'The journey begins';
  if (loc.kind === 'fight') {
    return loc.fightIndex === FIGHT_COUNT - 1 ? 'Boss fight' : `Fight ${loc.fightIndex + 1} / ${FIGHT_COUNT}`;
  }
  if (loc.kind === 'forkChoice') return 'Choose a path';
  return `Node ${loc.index + 1} / ${NODES_PER_BRANCH}`;
}

export function App() {
  const { run, act, newRun } = useRun();
  const [seedField, setSeedField] = useState<string>(String(run.seed));

  const startNewRun = (seed?: number) => setSeedField(String(newRun(seed)));
  const onNewRun = () => {
    const v = parseInt(seedField, 10);
    startNewRun(Number.isFinite(v) ? v : undefined);
  };

  let screen;
  if (run.status !== 'playing') {
    screen = <RunOverScreen run={run} onNewRun={() => startNewRun()} />;
  } else if (run.location.kind === 'start') {
    screen = <StartScreen onBegin={() => act((r) => r.beginRun())} />;
  } else if (run.location.kind === 'fight') {
    // Keyed so each fight remounts with a fresh battle from its own config.
    screen = (
      <FightScreen
        key={`fight-${run.location.fightIndex}-${run.seed}`}
        run={run}
        onWin={() => act((r) => r.winFight())}
        onLose={() => act((r) => r.loseFight())}
      />
    );
  } else if (run.location.kind === 'forkChoice') {
    screen = <MapScreen run={run} onChoose={(b) => act((r) => r.chooseBranch(b))} />;
  } else {
    screen = <NodeScreen run={run} act={act} onDone={() => act((r) => r.completeNode())} />;
  }

  return (
    <>
      <Topbar
        seedField={seedField}
        onSeedChange={setSeedField}
        onNewRun={onNewRun}
        gold={run.gold}
        progress={progressLabel(run)}
      />
      {screen}
    </>
  );
}
