// Browser controller: renders Game state and wires up player actions.
import { Game } from './engine.js';
import { CARDS, POISON_BASE, TAUNT_TURNS, BOLT_BASE, CHARGE_MAX, MP_MAX } from './constants.js';

const $ = (id) => document.getElementById(id);

let game = null;
let selected = null;     // { handIndex, card } when a target-needing card is chosen
let lastLogLen = 0;

// Short flavor of each member's ability, shown on their card.
const ABILITY = {
  ranger: `Poison Arrow — stack Poison ${POISON_BASE} on the enemy.`,
  tank: `Taunt — force the enemy onto the Tank for ${TAUNT_TURNS} turns.`,
  mage: `Lightning Bolt — deal ${BOLT_BASE} + Charge to the enemy.`,
};

function newGame(seed) {
  const s = Number.isFinite(seed) ? seed : (Math.random() * 1e9) | 0;
  game = new Game(s);
  $('seed-input').value = game.seed;
  selected = null;
  lastLogLen = 0;
  $('log').innerHTML = '';
  $('overlay').classList.add('hidden');
  game.start();
  render();
}

// ---- targeting ------------------------------------------------------------

function clearTargeting() {
  selected = null;
  render();
}

function onCardClick(handIndex) {
  if (game.status !== 'playing' || game.phase !== 'player') return;
  const cardId = game.hand[handIndex];
  const card = CARDS[cardId];
  if (game.mp < card.cost) return; // unaffordable

  // No-target cards play immediately.
  if (card.target === 'all' || card.target === 'none') {
    play(handIndex, null);
    return;
  }
  // Toggle selection for cards needing a target.
  if (selected && selected.handIndex === handIndex) {
    clearTargeting();
    return;
  }
  selected = { handIndex, card };
  render();
}

function onMemberClick(slot) {
  if (!selected) return;
  const reason = game.canPlay(selected.handIndex, slot);
  if (reason) return; // invalid target; ignore
  play(selected.handIndex, slot);
}

function play(handIndex, target) {
  const res = game.playCard(handIndex, target);
  selected = null;
  if (res.ok) checkEnd();
  render();
}

function endTurn() {
  if (game.status !== 'playing') return;
  selected = null;
  game.endTurn();
  checkEnd();
  render();
}

function skipTurn() {
  if (!game.canSkip()) return;
  selected = null;
  game.skipTurn();
  checkEnd();
  render();
}

function checkEnd() {
  if (game.status === 'win' || game.status === 'loss') showOverlay();
}

// ---- rendering ------------------------------------------------------------

function isValidTarget(slot) {
  return selected ? game.canPlay(selected.handIndex, slot) === null : false;
}

function render() {
  const over = game.status !== 'playing';

  // Enemy
  const e = game.enemy;
  $('enemy-hp-fill').style.width = `${(e.hp / e.maxHP) * 100}%`;
  $('enemy-hp-label').textContent = `${e.hp} / ${e.maxHP} HP`;
  $('enrage-flag').classList.toggle('hidden', !e.enraged);
  $('enemy-status').textContent = e.poison > 0 ? `☠ Poison ${e.poison}` : '';

  renderTelegraph();

  // Party
  const party = $('party');
  party.innerHTML = '';
  for (const m of game.members) {
    const el = document.createElement('div');
    el.className = 'member' + (m.alive ? '' : ' dead');
    const targetedByEnemy = !over && game.telegraph && !game.telegraph.hidden
      && game.telegraph.targets.includes(m.slot) && m.alive;
    if (targetedByEnemy) el.classList.add('targeted-by-enemy');
    if (isValidTarget(m.slot)) el.classList.add('valid-target');

    const badges = [];
    if (m.shield) badges.push('<span class="badge shield">🛡 Shield</span>');
    if (m.regen > 0) badges.push(`<span class="badge regen">♻ Regen ${m.regen}</span>`);
    if (m.id === 'tank' && m.taunt > 0) badges.push(`<span class="badge taunt">⚔ Taunt ${m.taunt}</span>`);

    const hpPct = (m.hp / m.maxHP) * 100;
    const low = hpPct <= 34;
    const charge = m.id === 'mage'
      ? `<div class="charge">⚡ Charge ${game.mageCharge}/${CHARGE_MAX}</div>` : '';
    el.innerHTML = `
      <div class="atk" title="Attack"><span>${m.damage}</span></div>
      <h3>${m.name}</h3>
      <div class="bar"><div class="bar-fill" style="width:${hpPct}%;${low ? 'background:var(--hp-low);' : ''}"></div>
        <span class="bar-label">${m.hp} / ${m.maxHP}</span></div>
      <div class="badges">${badges.join('')}</div>
      ${charge}
      <div class="ability">${ABILITY[m.id]}</div>`;
    el.addEventListener('click', () => onMemberClick(m.slot));
    party.appendChild(el);
  }

  // MP bar (+ Refresh pill when MP-regen is pending)
  $('mp-fill').style.width = `${(game.mp / MP_MAX) * 100}%`;
  $('mp-label').textContent = `MP ${game.mp} / ${MP_MAX}`;
  const pill = $('refresh-pill');
  pill.classList.toggle('hidden', game.refresh <= 0);
  if (game.refresh > 0) pill.textContent = `⟳ +${game.refresh}`;

  // Buttons
  $('skip-btn').disabled = over || !game.canSkip();
  $('end-btn').disabled = over;
  $('cancel-btn').classList.toggle('hidden', !selected);

  renderHand(over);
  renderLog();
}

function renderTelegraph() {
  const tg = $('telegraph');
  const t = game.telegraph;
  tg.className = 'telegraph';
  if (game.status !== 'playing' || !t) { tg.innerHTML = '<h4>Next enemy attack</h4><div>—</div>'; return; }
  if (t.hidden) {
    tg.classList.add('concealed');
    tg.innerHTML = `<h4>Next enemy attack</h4>
      <div class="tg-shape">??? Concealed</div>
      <div class="tg-targets">This enemy reveals nothing. Keep a Shield up.</div>`;
    return;
  }
  if (t.enraged) tg.classList.add('enraged');
  const shapeName = { single: 'Single target', two: 'Two-target', aoe: 'AoE (all three)' }[t.type] || t.type;
  const names = t.targets.map((s) => game.members[s].name).join(', ');
  tg.innerHTML = `<h4>Next enemy attack${t.enraged ? ' (enraged)' : ''}</h4>
    <div class="tg-shape">${shapeName} · <span class="tg-dmg">${t.damage} dmg</span> each</div>
    <div class="tg-targets">Targets: ${names}</div>`;
}

function renderHand(over) {
  const hand = $('hand');
  hand.innerHTML = '';
  for (let i = 0; i < game.hand.length; i++) {
    const cardId = game.hand[i];
    const card = CARDS[cardId];
    const el = document.createElement('div');
    const affordable = game.mp >= card.cost && !over;
    el.className = 'card' + (affordable ? '' : ' unaffordable')
      + (selected && selected.handIndex === i ? ' selected' : '');
    const heal = card.heal != null ? `<div class="heal" title="Healing">${card.heal}</div>` : '';
    el.innerHTML = `
      <div class="cost">${card.cost}</div>
      ${heal}
      <div class="cname">${card.name}</div>
      <div class="cdesc">${card.desc}</div>`;
    el.addEventListener('click', () => onCardClick(i));
    hand.appendChild(el);
  }
  $('draw-count').textContent = game.drawPile.length;
  $('discard-count').textContent = game.discardPile.length;
  const prompt = $('hand-prompt');
  if (selected) {
    prompt.classList.add('targeting');
    const kind = selected.card.target === 'dead' ? 'a dead member'
      : selected.card.target === 'ability' ? 'a living member (fires their ability)'
      : 'a living member';
    prompt.textContent = `Select ${kind} for ${selected.card.name} — or Cancel`;
  } else {
    prompt.classList.remove('targeting');
    prompt.textContent = 'Your hand';
  }
}

function renderLog() {
  const log = $('log');
  let prevTurn = lastLogLen > 0 ? (game.log[lastLogLen - 1]?.turn) : null;
  for (let i = lastLogLen; i < game.log.length; i++) {
    const entry = game.log[i];
    const li = document.createElement('li');
    li.className = entry.kind;
    if (prevTurn !== null && entry.turn !== prevTurn) li.classList.add('turn-sep');
    li.textContent = `T${entry.turn}: ${entry.text}`;
    log.appendChild(li);
    prevTurn = entry.turn;
  }
  lastLogLen = game.log.length;
  log.scrollTop = log.scrollHeight;
}

function showOverlay() {
  const ov = $('overlay');
  const card = ov.querySelector('.overlay-card');
  card.className = 'overlay-card ' + game.status;
  if (game.status === 'win') {
    $('overlay-title').textContent = 'Victory';
    $('overlay-text').textContent = `The enemy fell on turn ${game.turn}.`;
  } else {
    $('overlay-title').textContent = 'Defeat';
    $('overlay-text').textContent = `The party was wiped on turn ${game.turn}.`;
  }
  ov.classList.remove('hidden');
}

// ---- wiring ---------------------------------------------------------------

$('end-btn').addEventListener('click', endTurn);
$('skip-btn').addEventListener('click', skipTurn);
$('cancel-btn').addEventListener('click', clearTargeting);
$('overlay-again').addEventListener('click', () => newGame(NaN));
$('new-game').addEventListener('click', () => {
  const v = parseInt($('seed-input').value, 10);
  newGame(Number.isFinite(v) ? v : NaN);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') clearTargeting(); });

newGame(NaN);
