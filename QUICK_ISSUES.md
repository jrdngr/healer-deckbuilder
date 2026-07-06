# Quick items to fix that don't need full issues

- BALANCE FOLLOW-UP (from enemy-first): the enemy-first opening strike landed but dropped full-run winrate ~22% -> ~10.5% (Gatewarden ~61% -> ~39%). Sim gates were re-pinned to the harder numbers as a known regression. Do a proper balance pass (re-anchor ENEMY_HP_BY_FIGHT down) to pull winrates back toward the ~22% / 50-72% boss target.
- Path selection animation makes it look like the player is skipping both nodes. Get rid of this animation entirely.
- Remember the party member positions between fights
- Party members should no longer fully heal between fights. They should only heal a percentage of their max HP. Let's start with 20% and do a balance pass to figure out the best number. Add back the infirmary node which allows the player to heal their party members for a price and heal injuries for a much larger price. If a party member is dead at the end of the fight, resurrect them with the normal amount of recovered HP.
- When a party member dies, disable their ability cards but still allow them to be drawn. If they permanently die due to injuries, remove their ability cards from the deck for the rest of the fight.
- We should rework regen a bit. I think I want to go back to the previous system where the regen amount is both magnitude and duration. So Regen 5 would last 5 turns and heal 5 hp on the first turn, then it ticks down to Regen 4. Regen 4 heals 4 hp and ticks down to Regen 3, etc. The current regen spell should start at Regen 2. Casting regen again should add to the total regen amount, so casting Regen 2 on a hero with Regen 3 should result in Regen 5.
- The starting hero pool should allow for all heroes to be drafted. The available options should be 3 options randomized from the full pool of options.
- Remove party member recruitment after bosses. Leave it to the recruiter node and always offer a path with a recruiter node at the beginning of each fight cycle. So the player should be offered a recruiter node after the first fight and then again after each boss.
- Add an animation at the end of each fight for gold. Make one gold particle for each piece of gold earned and have them form up into a swarm, then animate the gold moving to its destination. Gold paid to salaries should move to each party member receiving a salary. Gold going to the player should move to the gold UI element on the top status bar
- Winning a fight should have card rewards. Offer 3 cards and the player chooses 1. Cards probabilities are based on rarity. These cards are free
- Show UI elements for injuries on players. Use same style as buffs and debuffs. Show injury name, mouse over for details
- Enemy is targeting dead players. This is a bug. It also seems like the telegraph is aimed at a dead player but a living player still gets hit sometimes.
- Continue saved run button doesn't work
- Add a button to view your deck in the top status bar
- Change the starting deck to be 1x group heal, 3x quick heal, 2x heal
- Passive MP gain upgrades should only trigger when 0 or 1 card is played.