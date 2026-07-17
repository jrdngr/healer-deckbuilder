import { CARDS } from '../constants';
import type { Game } from '../engine';
import { Icon } from './Icon';
import { Tooltip } from './Tooltip';

interface ChannelBannerProps {
  game: Game;
}

// Persistent feedback for a player-cast channel (#64, #78): while a channel runs,
// the effect repeats each turn and playing ANY card cancels it — but the cast
// card itself has already gone to the discard, so without this indicator there is
// no on-screen sign a channel is live. Compact by design: it sits in the fixed
// gutter to the left of the MP bar (see `.mana-row` / `.channel-banner`), so it
// must not grow the row and shove the hand down — one label line plus a depleting
// track. The full effect text lives on the in-hand card's badge + this tooltip.
export function ChannelBanner({ game }: ChannelBannerProps) {
  const id = game.channelCard;
  if (game.status !== 'playing' || id == null || !game.channelActive()) return null;

  const def = CARDS[id];
  const turns = game.channelTurns;
  // Single-target channels (Mending Stream) remember their bound member;
  // channelTarget is that member's slot index.
  const bound = game.channelTarget != null ? game.members[game.channelTarget] : null;
  // Depleting fill: full at cast, empties as ticks run out (turns / maxTurns),
  // clamped to [0, 100]. Reads as YOUR sustained effect winding down.
  const maxTurns = def.channel?.maxTurns ?? turns;
  const pct = Math.max(0, Math.min(100, (turns / maxTurns) * 100));

  return (
    <Tooltip content="Playing any card cancels this channel.">
      <div className="cast-bar channel-banner">
        <span className="cast-label channel-label">
          <Icon name="bolt" /> Channeling {def.name}
          {bound && <span className="channel-target"> → {bound.name}</span>}
          {' · '}
          {turns} left
        </span>
        <div className="cast-track">
          <div className="cast-fill channel-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Tooltip>
  );
}
