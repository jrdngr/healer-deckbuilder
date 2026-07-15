import type { NodeType } from '../constants';

// Display metadata for each node type, shared by the map and node screens.
export const NODE_META: Record<NodeType, { label: string; icon: string; desc: string }> = {
  fight: { label: 'Fight', icon: '⚔', desc: 'A battle.' },
  cardShop: { label: 'Card Shop', icon: '🃏', desc: 'Buy new cards for your deck.' },
  cardUpgrade: { label: 'Upgrade Shop', icon: '✦', desc: 'Apply upgrade modifiers to your cards.' },
  partyUpgrade: { label: 'Training Hall', icon: '🛡', desc: 'Boost a party member’s stats.' },
  event: { label: 'Event', icon: '❓', desc: 'An encounter with a choice.' },
  recruit: { label: 'Recruiter', icon: '🎪', desc: 'Add a new member to your roster.' },
  infirmary: { label: 'Infirmary', icon: '🩹', desc: 'Pay to heal HP or shed an injury.' },
  dojo: { label: 'Training Dojo', icon: '🥋', desc: 'A hero learns a new ability card, free.' },
  reliquary: { label: 'Reliquary', icon: '🏺', desc: 'Buy relics; pay to remove cards.' },
};
