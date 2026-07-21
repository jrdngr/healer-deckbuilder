// The generated JSON Schemas must (a) stay in sync with the zod they came from and
// (b) actually accept the content they are supposed to describe.
//
// Both halves matter, and they fail in opposite directions:
//
//   STALE — someone adds an op or a tuning constant, the committed .schema.json still
//   describes the old vocabulary, and the editor reports a red squiggle on correct
//   content. An editor that cries wolf gets ignored, which costs more than having no
//   schema at all.
//
//   WRONG — the hand-written envelope (which fields a card has) disagrees with reality,
//   so every entry using an undescribed field lights up. This is the likelier of the two,
//   because the envelope is the half zod never described: it was caught in development
//   exactly this way, by `engine` being declared a string when it is a boolean.
//
// So: regenerate in-memory and compare byte-for-byte, then validate the real files
// against the committed schemas with a real JSON Schema validator.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import Ajv from 'ajv/dist/2020';
import { check, eq, finish } from '../harness';

const NAMES = ['cards', 'abilities', 'relics', 'members'];

// --- freshness --------------------------------------------------------------
// Regenerating writes the files, so snapshot them first and compare after. The
// generator is the only thing that should ever write these.
{
  const before = Object.fromEntries(NAMES.map((n) =>
    [n, readFileSync(`src/content/schema/${n}.schema.json`, 'utf8')]));
  execFileSync('npx', ['tsx', 'scripts/gen-content-schema.ts'], { stdio: 'pipe' });
  for (const n of NAMES) {
    const after = readFileSync(`src/content/schema/${n}.schema.json`, 'utf8');
    eq(`${n}.schema.json is up to date (run: npm run schema)`, after === before[n], true);
  }
}

// --- conformance ------------------------------------------------------------
{
  const ajv = new Ajv({ strict: false, allErrors: true });
  for (const n of NAMES) {
    const schema = JSON.parse(readFileSync(`src/content/schema/${n}.schema.json`, 'utf8'));
    const data = JSON.parse(readFileSync(`src/content/${n}.json`, 'utf8'));
    const ok = ajv.validate(schema, data);
    const detail = (ajv.errors ?? []).slice(0, 5)
      .map((e) => `${e.instancePath} ${e.message}`).join('; ');
    check(`${n}.json validates against its own schema`, ok as boolean, detail);
  }
}

// --- the point of the exercise ----------------------------------------------
// additionalProperties:false is the whole reason the envelopes are hand-written: a
// misspelled field used to validate cleanly and silently do nothing. Negative-control
// it here so the property cannot be quietly dropped from the generator.
{
  const ajv = new Ajv({ strict: false, allErrors: true });
  const schema = JSON.parse(readFileSync('src/content/schema/cards.schema.json', 'utf8'));
  const data = JSON.parse(readFileSync('src/content/cards.json', 'utf8'));
  const typo = { ...data, lowHeal: { ...data.lowHeal, healing: 3 } };
  check('a misspelled card field is rejected by the schema', !ajv.validate(schema, typo));
}

finish('content/schema-fresh');
