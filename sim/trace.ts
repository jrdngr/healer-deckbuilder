// Deterministic trace differ — the migration's SECOND regression net (#100).
//
//   tsx sim/trace.ts 200 > /tmp/before.txt    # on the parent commit
//   tsx sim/trace.ts 200 > /tmp/after.txt
//   diff /tmp/before.txt /tmp/after.txt       # must be empty
//
// #99's characterization suite is the PRIMARY oracle; this catches drift nobody
// thought to assert. It is cheap and blunt: play N seeded runs and dump every log line
// and every emitted event, in order, prefixed by seed/fight.
//
// WHY IT IS SHAPED THIS WAY (the first plan draft got this wrong):
//
//   - `game.events` is NOT a fight record. It is documented as "animation feed for the
//     most recent action" (core.ts:344) and is cleared at the top of every public
//     entry point. Reading it after a fight yields only the last action's events, so
//     the events have to be TEE'd off Game.prototype._emit as they happen.
//   - `runSingleRun` (sim/run-sim.ts) constructs each fight's Game internally and
//     discards it, so this cannot simply call it and read anything back. The run loop
//     is duplicated below, deliberately, so the trace can straddle fight boundaries.
//
// The tee is installed by monkey-patching the prototype. That is ugly and confined to
// this dev tool — it never ships and nothing imports it.
import { Game } from '../src/engine';
import { Run } from '../src/run';
import { FIGHT_COUNT } from '../src/constants';
import {
  playFight, resolveNode, chooseBranch, chooseSpoil, chooseCardReward, chooseHealerBoon,
  advanceBranch, draftPick, deployBest, newMpTelemetry,
} from './policy';
import { STICK } from './profile';
import { fightSeed, runIfMain } from './util';

// --- the emit tee ----------------------------------------------------------
const sink: string[] = [];
let capturing = false;
let prefix = '';

const originalEmit = Game.prototype._emit;
Game.prototype._emit = function (event: never): void {
  if (capturing) sink.push(`${prefix} EVENT ${stable(event)}`);
  return originalEmit.call(this, event);
};

/** Stable stringify: key order must not depend on insertion order, or the diff is noise. */
function stable(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? String(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
}

/** Drain a game's persisted log into the sink, from `from` onward. */
function drainLog(game: Game, from: number): number {
  for (let i = from; i < game.log.length; i++) {
    const e = game.log[i];
    sink.push(`${prefix} LOG   [${e.kind}] ${e.text}`);
  }
  return game.log.length;
}

/**
 * One full run, traced. A duplicate of runSingleRun's loop (see the header) — kept
 * deliberately close to it so a divergence is easy to spot side by side.
 */
function traceRun(seed: number): void {
  const run = new Run(seed);
  run.beginDraft();
  let guard = 0;
  while (run.status === 'playing' && guard < 1000) {
    guard++;
    switch (run.location.kind) {
      case 'fight': {
        const fi = run.location.fightIndex;
        prefix = `seed=${seed} fight=${fi}`;
        const game = new Game(fightSeed(seed, fi), run.toBattleConfig());
        const mp = newMpTelemetry();
        capturing = true;
        let logged = 0;
        playFight(game, 40, STICK, mp);
        logged = drainLog(game, logged);
        capturing = false;
        sink.push(`${prefix} RESULT ${game.status} turns=${game.turn} enemyHp=${game.enemy.hp}`);
        run.markRelicsSpent(game.spentRelicIds());
        const died = game.diedThisFightSlots();
        if (game.status === 'win') {
          run.recordInjuries(died);
          run.winFight(game.memberHPBySlot());
        } else run.loseFight();
        break;
      }
      case 'cardReward': {
        const ci = chooseCardReward(run, STICK);
        if (ci >= 0) run.pickCardReward(ci); else run.skipCardReward();
        break;
      }
      case 'spoils': run.pickSpoil(chooseSpoil(run, STICK)); break;
      case 'healerBoon': run.pickHealerBoon(chooseHealerBoon(run)); break;
      case 'forkChoice': run.chooseBranch(chooseBranch(run)); break;
      case 'branch': advanceBranch(run); break;
      case 'node': resolveNode(run, STICK); run.completeNode(); break;
      case 'start': run.beginDraft(); break;
      case 'deploy': deployBest(run, {}); break;
      case 'draft': draftPick(run, STICK); break;
      default: run.status = 'lost'; break;
    }
  }
  sink.push(`seed=${seed} RUN ${run.status} gold=${run.gold} deck=${run.deck.length}`);
}

export function trace(seeds: number): string[] {
  sink.length = 0;
  for (let s = 1; s <= seeds; s++) traceRun(s);
  return sink;
}

runIfMain(import.meta.url, () => {
  const n = Number(process.argv[2] ?? 50);
  const lines = trace(n);
  const events = lines.filter((l) => l.includes(' EVENT ')).length;
  const logs = lines.filter((l) => l.includes(' LOG   ')).length;

  // GUARD: an empty diff is only meaningful if the trace actually captured
  // something. A capture bug would otherwise read as a clean pass — exactly the
  // failure mode this tool exists to prevent. Fail loudly instead.
  // Note the absolute floors as well as the per-seed ones: with n = 0 a purely
  // relative threshold is `0 < 0`, which passes, and emits an empty trace that every
  // diff calls clean.
  if (n < 1 || events < 1 || logs < 1 || events < n * 10 || logs < n * 10) {
    console.error(
      `trace.ts: suspiciously little captured for ${n} seeds — ${events} events, ${logs} log lines.\n` +
      'That usually means the _emit tee or the log drain broke, not that the game got quiet.\n' +
      'Refusing to emit a trace that would make any diff look clean.',
    );
    process.exit(1);
  }
  for (const l of lines) console.log(l);
  console.error(`trace: ${n} seeds · ${lines.length} lines · ${events} events · ${logs} logs · ${FIGHT_COUNT} fights/run`);
});
