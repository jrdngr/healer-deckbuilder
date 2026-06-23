import { useState } from 'react';
import { useGame } from './useGame';
import { Topbar } from './components/Topbar';
import { BattleScreen } from './components/BattleScreen';

// The only screen for now. This is the seam where map / events / rewards screens
// will slot in as the game grows.
type Screen = 'battle';

export function App() {
  const { game, newGame, playCard, skipTurn, endTurn } = useGame();
  const [seedField, setSeedField] = useState<string>(String(game.seed));
  const [screen] = useState<Screen>('battle');

  // New Fight from the topbar: use the typed seed if valid, else random.
  const onNewFight = () => {
    const v = parseInt(seedField, 10);
    const seed = newGame(Number.isFinite(v) ? v : undefined);
    setSeedField(String(seed));
  };
  // Random restart (overlay "New Fight").
  const newGameRandom = () => {
    setSeedField(String(newGame()));
  };

  return (
    <>
      <Topbar seedField={seedField} onSeedChange={setSeedField} onNewFight={onNewFight} />
      {screen === 'battle' && (
        <BattleScreen
          game={game}
          playCard={playCard}
          skipTurn={skipTurn}
          endTurn={endTurn}
          newGameRandom={newGameRandom}
        />
      )}
    </>
  );
}
