import { useState } from 'react';
import { useRun } from './useRun';
import type { Run } from './run';
import type { GameController } from './useGame';
import { FIGHTS_PER_ACT, ACT_COUNT, isActBoss, actOfFight } from './constants';
import type { Difficulty } from './constants';
import { Topbar } from './components/Topbar';
import { StartScreen } from './components/StartScreen';
import { DraftScreen } from './components/DraftScreen';
import { FightScreen } from './components/FightScreen';
import { MapScreen } from './components/MapScreen';
import { BranchScreen } from './components/BranchScreen';
import { NODE_META } from './components/nodeMeta';
import { NodeScreen } from './components/NodeScreen';
import { SpoilsScreen } from './components/SpoilsScreen';
import { RunOverScreen } from './components/RunOverScreen';
import { DevPanel } from './components/DevPanel';

// A short label for where the player is in the run, shown in the topbar.
function progressLabel(run: Run): string {
  if (run.status === 'won') return 'Run complete';
  if (run.status === 'lost') return 'Run over';
  const loc = run.location;
  if (loc.kind === 'start') return 'The journey begins';
  if (loc.kind === 'draft') return 'Draft your party';
  if (loc.kind === 'fight') {
    const act = actOfFight(loc.fightIndex) + 1;
    const inAct = (loc.fightIndex % FIGHTS_PER_ACT) + 1;
    const where = `Act ${act} / ${ACT_COUNT} · Fight ${inAct} / ${FIGHTS_PER_ACT}`;
    return isActBoss(loc.fightIndex) ? `${where} — Boss` : where;
  }
  if (loc.kind === 'forkChoice') return 'Choose a path';
  if (loc.kind === 'spoils') return 'Spoils of victory';
  if (loc.kind === 'branch') return 'Along the trail';
  return NODE_META[loc.nodeType].label;
}

export function App() {
  const { run, act, newRun, hasSave, savedFightIndex, continueRun } = useRun();
  const [seedField, setSeedField] = useState<string>(String(run.seed));
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  // The active fight's controller, published by FightScreen; null outside of a fight.
  const [gameCtrl, setGameCtrl] = useState<GameController | null>(null);

  const startNewRun = (seed?: number) => setSeedField(String(newRun(seed, difficulty)));
  const onContinue = () => { const s = continueRun(); if (s != null) setSeedField(String(s)); };
  const onNewRun = () => {
    const v = parseInt(seedField, 10);
    startNewRun(Number.isFinite(v) ? v : undefined);
  };

  let screen;
  if (run.status !== 'playing') {
    screen = <RunOverScreen run={run} onNewRun={() => startNewRun()} />;
  } else if (run.location.kind === 'start') {
    screen = (
      <StartScreen
        onBegin={() => act((r) => { r.difficulty = difficulty; r.beginRun(); })}
        onDraft={() => act((r) => { r.difficulty = difficulty; r.beginDraft(); })}
        hasSave={hasSave}
        savedFightIndex={savedFightIndex}
        onContinue={onContinue}
        difficulty={difficulty}
        onDifficulty={setDifficulty}
      />
    );
  } else if (run.location.kind === 'draft') {
    screen = <DraftScreen run={run} act={act} />;
  } else if (run.location.kind === 'fight') {
    // Keyed so each fight remounts with a fresh battle from its own config.
    screen = (
      <FightScreen
        key={`fight-${run.location.fightIndex}-${run.seed}`}
        run={run}
        onWin={() => act((r) => r.winFight())}
        onLose={() => act((r) => r.loseFight())}
        onSpent={(ids) => act((r) => r.markRelicsSpent(ids))}
        onInjuries={(slots) => act((r) => r.recordInjuries(slots))}
        onController={setGameCtrl}
      />
    );
  } else if (run.location.kind === 'spoils') {
    screen = <SpoilsScreen run={run} act={act} />;
  } else if (run.location.kind === 'forkChoice') {
    screen = <MapScreen run={run} onChoose={(b) => act((r) => r.chooseBranch(b))} />;
  } else if (run.location.kind === 'branch') {
    screen = (
      <BranchScreen
        run={run}
        onEnter={(i) => act((r) => r.enterNode(i))}
        onFight={() => act((r) => r.startNextFight())}
      />
    );
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
        relics={run.relics}
      />
      {screen}
      {import.meta.env.DEV && <DevPanel ctrl={gameCtrl} addGold={() => act((r) => { r.gold += 100; })} />}
    </>
  );
}
