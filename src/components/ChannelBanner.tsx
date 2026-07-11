import { CARDS } from '../constants';
import type { Game } from '../engine';
import { channelEffectLine } from '../channelView';
import { Icon } from './Icon';

interface ChannelBannerProps {
  game: Game;
}

// Persistent feedback for a player-cast channel (#64, #78): while a channel runs,
// the effect repeats each turn and playing ANY card cancels it — but the cast
// card itself has already gone to the discard, so without this banner there is no
// on-screen sign a channel is live. Mirrors the enemy cast-bar's visual language
// (EnemyPanel `.cast-bar`), read-only over the engine's channel state.
export function ChannelBanner({ game }: ChannelBannerProps) {
  const id = game.channelCard;
  if (game.status !== 'playing' || id == null || !game.channelActive()) return null;

  const def = CARDS[id];
  const turns = game.channelTurns;
  // Single-target channels (Mending Stream, Fortify) remember their bound member;
  // channelTarget is that member's slot index.
  const bound = game.channelTarget != null ? game.members[game.channelTarget] : null;
  const effect = channelEffectLine(id);
  // Depleting fill: full at cast, empties as ticks run out (turns / maxTurns),
  // clamped to [0, 100]. Reads as YOUR sustained effect winding down.
  const maxTurns = def.channel?.maxTurns ?? turns;
  const pct = Math.max(0, Math.min(100, (turns / maxTurns) * 100));

  return (
    <div className="cast-bar channel-banner" title="Playing any card cancels this channel.">
      <span className="cast-label channel-label">
        <Icon name="bolt" /> Channeling {def.name}
        {bound && <span className="channel-target"> → {bound.name}</span>}
        {' — '}
        {turns} turn{turns === 1 ? '' : 's'} left
      </span>
      {effect && <span className="channel-effect">{effect}</span>}
      <div className="cast-track">
        <div className="cast-fill channel-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="channel-warn">Playing any card cancels the channel.</span>
    </div>
  );
}
