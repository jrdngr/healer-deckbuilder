import type { NodeType } from '../constants';

// Display metadata for each node type, shared by the map and node screens.
export const NODE_META: Record<NodeType, { label: string; icon: string; desc: string }> = {
  fight: { label: 'Fight', icon: '⚔', desc: 'A battle.' },
  cardShop: { label: 'Card Shop', icon: '🃏', desc: 'Buy new cards for your deck.' },
  cardUpgrade: { label: 'Upgrade Shop', icon: '✦', desc: 'Apply upgrade modifiers to your cards.' },
  partyUpgrade: { label: 'Training Hall', icon: '🛡', desc: 'Boost a party member’s stats.' },
  event: { label: 'Event', icon: '❓', desc: 'An encounter with a choice.' },
  healerUpgrade: { label: 'Sanctum', icon: '✚', desc: 'Improve the healer’s resources.' },
  infirmary: { label: 'Infirmary', icon: '⛑', desc: 'Pay to heal your party’s lasting injuries.' },
  reliquary: { label: 'Reliquary', icon: '🏺', desc: 'Buy relics; pay to remove cards.' },
};
