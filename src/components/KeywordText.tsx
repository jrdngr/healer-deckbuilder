import { Fragment } from 'react';
import { KEYWORDS, tokenizeKeywords } from '../constants';
import type { KeywordId } from '../constants';
import { Tooltip } from './Tooltip';

// Render a string with each status-effect keyword highlighted (class `.keyword`) and
// carrying its canonical gloss in a #97 themed Tooltip. The tokenizer (pure, DOM-free)
// decides what is a keyword; this component only maps the tokens to DOM.
//
// Use on free text that has no per-effect tooltip of its own (card/ability descs). For
// readout chips that already carry a rich, live-number Tooltip (poison / enrage / hex /
// siphon), highlight just the keyword word with <KeywordMark> to avoid nesting tooltips.

export function KeywordText({ children, plain = false }: { children: string; plain?: boolean }) {
  const tokens = tokenizeKeywords(children);
  return (
    <>
      {tokens.map((t, i) =>
        'keyword' in t ? (
          plain ? (
            <span key={i} className="keyword">{t.text}</span>
          ) : (
            <KeywordMark key={i} id={t.keyword}>{t.text}</KeywordMark>
          )
        ) : (
          <Fragment key={i}>{t.text}</Fragment>
        ),
      )}
    </>
  );
}

// A single highlighted keyword word with its gloss tooltip. Exposed so a chip that
// renders the effect name in a fixed label can highlight+gloss just that word.
export function KeywordMark({ id, children }: { id: KeywordId; children: string }) {
  const def = KEYWORDS[id];
  return (
    <Tooltip content={<><b>{def.name}</b> — {def.desc}</>}>
      <span className="keyword">{children}</span>
    </Tooltip>
  );
}
