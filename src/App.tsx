import { useRef, useState } from 'react';
import { useRun } from './useRun';
import type { Run } from './run';
import type { GameController } from './useGame';
import { FIGHTS_PER_ACT, ACT_COUNT, isActBoss, actOfFight, memberSalary } from './constants';
import { planGoldFx } from './goldFx';
import { GoldFx } from './components/GoldFx';
import type { GoldFxJob, GoldFxTarget } from './components/GoldFx';
import { Topbar } from './components/Topbar';
import { StartScreen } from './components/StartScreen';
import { DraftScreen } from './components/DraftScreen';
import { DeployScreen } from './components/DeployScreen';
import { FightScreen } from './components/FightScreen';
import { MapScreen } from './components/MapScreen';
import { BranchScreen } from './components/BranchScreen';
import { NODE_META } from './components/nodeMeta';
import { NodeScreen } from './components/NodeScreen';
import { CardRewardScreen } from './components/CardRewardScreen';
import { SpoilsScreen } from './components/SpoilsScreen';
import { RunOverScreen } from './components/RunOverScreen';
import { DevPanel } from './components/DevPanel';

// A short label for where the player is in the run, shown in the topbar.
function progressLabel(run: Run): string {
  if (run.status === 'won') return 'Run complete';
  if (run.status === 'lost') return 'Run over';
  const loc = run.location;
  if (loc.kind === 'start') return 'The journey begins';
  if (loc.kind === 'draft') return 'Recruit your first hero';
  if (loc.kind === 'deploy') return 'Deploy your party';
  if (loc.kind === 'fight') {
    const act = actOfFight(loc.fightIndex) + 1;
    const inAct = (loc.fightIndex % FIGHTS_PER_ACT) + 1;
    const where = `Act ${act} / ${ACT_COUNT} · Fight ${inAct} / ${FIGHTS_PER_ACT}`;
    return isActBoss(loc.fightIndex) ? `${where} — Boss` : where;
  }
  if (loc.kind === 'forkChoice') return 'Choose a path';
  if (loc.kind === 'cardReward') return 'Claim a card';
  if (loc.kind === 'spoils') return 'Spoils of victory';
  if (loc.kind === 'branch') return 'Along the trail';
  return NODE_META[loc.nodeType].label;
}

interface Pt { x: number; y: number; }

// Does the viewer prefer reduced motion? The whole gold burst is skipped when so.
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Center of an element in viewport px, or null if it isn't laid out.
function centerOf(el: Element | null | undefined): Pt | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Measured geometry for the end-of-fight gold burst (#59). Read from the LIVE
// battle DOM the instant a fight is won — before the run advances and unmounts
// it — so the coins have real party-card and topbar coordinates to fly to.
interface GoldGeometry {
  origin: Pt;               // where the loot swarm gathers (the defeated enemy)
  members: (Pt | null)[];   // party-card centers, indexed by battle slot
  salaries: { slot: number; gold: number }[]; // each seated member's salary share
  goldEl: Pt | null;        // the topbar .run-gold counter
}

function measureGoldGeometry(run: Run): GoldGeometry {
  const origin = centerOf(document.querySelector('.enemy'))
    ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const partyEl = document.querySelector('.party');
  const members: (Pt | null)[] = [];
  const salaries: { slot: number; gold: number }[] = [];
  for (let s = 0; s < run.deployment.length; s++) {
    members[s] = centerOf(partyEl?.children[s]);
    const ri = run.deployment[s];
    const p = ri != null ? run.roster[ri] : null;
    if (p) salaries.push({ slot: s, gold: memberSalary(p) });
  }
  return { origin, members, salaries, goldEl: centerOf(document.querySelector('.run-gold')) };
}

export function App() {
  const { run, act, newRun, hasSave, savedFightIndex, continueRun } = useRun();
  const [seedField, setSeedField] = useState<string>(String(run.seed));
  // The active fight's controller, published by FightScreen; null outside of a fight.
  const [gameCtrl, setGameCtrl] = useState<GameController | null>(null);
  // End-of-fight gold burst (#59): the active coin job, and a temporary override
  // for the topbar counter so it holds the pre-reward total until the player's
  // coins arrive (then falls back to the live run.gold).
  const [goldFxJob, setGoldFxJob] = useState<GoldFxJob | null>(null);
  const [goldOverride, setGoldOverride] = useState<number | null>(null);
  const goldFxNonce = useRef(0);

  // Resolve a won fight, then fly the reward as coins (#59). Geometry is measured
  // from the still-mounted battle DOM BEFORE winFight advances the run; the coin
  // split is one-per-gold (salaries to each paid member, the remainder to the
  // topbar). Skipped under reduced-motion, on the final (bounty-less) boss win,
  // or if nothing could be measured.
  const onWin = (hpBySlot: (number | null)[]) => {
    const geom = prefersReducedMotion() ? null : measureGoldGeometry(run);
    const before = run.gold;
    act((r) => r.winFight(hpBySlot));
    const gained = run.gold - before;
    if (!geom || gained <= 0) return;

    const plan = planGoldFx(gained, geom.salaries);
    const targets: GoldFxTarget[] = [];
    for (const t of plan.targets) {
      const pt = t.kind === 'player' ? geom.goldEl : geom.members[t.slot ?? -1];
      if (pt) targets.push({ x: pt.x, y: pt.y, particles: t.particles });
    }
    if (targets.length === 0) return;

    setGoldOverride(before); // hold the counter until the coins land
    setGoldFxJob({ nonce: ++goldFxNonce.current, origin: geom.origin, targets });
  };

  const startNewRun = (seed?: number) => setSeedField(String(newRun(seed)));
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
        onBegin={() => act((r) => r.beginDraft())}
        hasSave={hasSave}
        savedFightIndex={savedFightIndex}
        onContinue={onContinue}
      />
    );
  } else if (run.location.kind === 'draft') {
    screen = <DraftScreen run={run} act={act} />;
  } else if (run.location.kind === 'deploy') {
    screen = <DeployScreen run={run} act={act} />;
  } else if (run.location.kind === 'fight') {
    // Keyed so each fight remounts with a fresh battle from its own config.
    screen = (
      <FightScreen
        key={`fight-${run.location.fightIndex}-${run.seed}`}
        run={run}
        onWin={onWin}
        onLose={() => act((r) => r.loseFight())}
        onSpent={(ids) => act((r) => r.markRelicsSpent(ids))}
        onInjuries={(slots) => act((r) => r.recordInjuries(slots))}
        onController={setGameCtrl}
      />
    );
  } else if (run.location.kind === 'cardReward') {
    screen = <CardRewardScreen run={run} act={act} />;
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
        gold={goldOverride ?? run.gold}
        progress={progressLabel(run)}
        relics={run.relics}
        deck={run.deck}
      />
      {screen}
      <GoldFx
        job={goldFxJob}
        onArrive={() => setGoldOverride(null)}
        onDone={() => setGoldFxJob(null)}
      />
      {import.meta.env.DEV && <DevPanel ctrl={gameCtrl} addGold={() => act((r) => { r.gold += 100; })} />}
    </>
  );
}
