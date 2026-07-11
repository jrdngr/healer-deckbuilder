import { useMemo } from 'react';
import { resolveArt } from '../characterArt';

// The 96×104 native tile (design_handoff/character handoff). We render at native
// size and scale with a transform so the mix of %-based and px-based layer geometry
// stays proportional at any display size.
const TILE_W = 96;
const TILE_H = 104;

interface CharacterBlobProps {
  // Roster id (MemberId / EnemyDef.id). Resolves to that character's War-Torn art.
  id: string;
  // Display width in px; height keeps the 96:104 aspect. Default suits a party card.
  size?: number;
  // Disambiguates hero vs enemy art (and picks the fallback table). Omit for members.
  isEnemy?: boolean;
  className?: string;
}

// Purely decorative; the character's identity is carried by the adjacent name text,
// so the blob is aria-hidden.
export function CharacterBlob({ id, size = 62, isEnemy, className }: CharacterBlobProps) {
  const { layers } = resolveArt(id, isEnemy);
  // Build the layer stack as static HTML (the reference's own cssText technique) —
  // the data is trusted and never changes, so this stays out of React's diffing.
  const html = useMemo(
    () => layers.map((s) => `<div style="position:absolute;${s}"></div>`).join(''),
    [layers],
  );
  // Desync the idle bob per character so a row of blobs doesn't move in lockstep.
  const delay = useMemo(() => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
    return -(h / 1000) * 3.6;
  }, [id]);

  return (
    <div
      className={`char-blob${className ? ' ' + className : ''}`}
      style={{ width: size, height: size * (TILE_H / TILE_W), animationDelay: `${delay}s` }}
      aria-hidden="true"
    >
      <div
        className="char-blob-tile"
        style={{ width: TILE_W, height: TILE_H, transform: `scale(${size / TILE_W})` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
