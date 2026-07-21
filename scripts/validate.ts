// `npm run validate` — the fastest possible answer to "is my JSON edit well-formed?"
//
// Importing src/constants runs the whole content validator as a module side effect: it
// re-exports src/content last, and src/content calls validateOrExit(BUNDLE) at import
// time. So this check has always existed — it just was not reachable without booting the
// app or running a test suite. It takes well under a second, against ~12s for the full
// suite, which is the difference between checking after every edit and checking at the
// end of a batch.
//
// On failure the validator prints its own report (file -> JSON path -> cause, with a
// nearest-identifier hint) and exits non-zero before this file's last line is reached.
import '../src/constants';

console.log('content OK');
