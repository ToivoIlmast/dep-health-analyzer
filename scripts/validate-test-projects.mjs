// Validates the external validation corpus against dep-health-analyzer.
// Two phases:
//
//   1. Smoke check - runs `cycles`/`regression`/`history` against every
//      fixture and confirms none of them crash or hit a config error. This
//      alone only proves "the CLI didn't crash on this input" - it does NOT
//      prove the analyzer's output is correct.
//   2. Assertions - a small, explicit list of machine-verifiable checks
//      against representative fixtures: does `cycles` report the cycle count
//      a fixture's own history says it should, at the specific commit that
//      claim is about; does the `includeTypeOnlyImports` flip actually
//      change what's counted; do a few structural invariants hold on
//      history-laboratory. This is deliberately NOT a full integration-test
//      framework - it checks a handful of real invariants, not the entire
//      output of every command against every fixture.
//
// Regression baseline note: a fixture's LAST commit is always the
// README-only commit added by gen-readmes.mjs (README.md is never scanned,
// so it never changes the dependency graph). Blindly using `HEAD~1` as a
// regression baseline for every fixture would therefore always diff a
// content commit against the *identical* graph one commit later - a
// structural no-op for every single fixture, regardless of size. This
// script resolves the real "content HEAD" (skipping trailing README-only
// commits) before picking a baseline relative to it.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CORPUS_DIR = join(ROOT, 'test-projects');
const CLI = join(ROOT, 'dist', 'app', 'cli.js');

if (!existsSync(CLI)) {
    console.error('dist/app/cli.js not found - run `npm run build` first.');
    process.exit(1);
}

const fixtures = readdirSync(CORPUS_DIR).filter((name) => statSync(join(CORPUS_DIR, name)).isDirectory());

function git(dir, args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

function commitCount(dir, ref = 'HEAD') {
    return Number(git(dir, ['rev-list', '--count', ref]));
}

// README.md is added by gen-readmes.mjs as the fixture's own trailing
// commit, with a fixed, recognizable message - see scripts/gen-readmes.mjs.
const README_ONLY_COMMIT_PATTERN = /^docs: add fixture README/;

function resolveContentHead(dir) {
    let ref = 'HEAD';
    for (let i = 0; i < 5; i++) {
        const message = git(dir, ['log', '-1', '--pretty=%s', ref]);
        if (!README_ONLY_COMMIT_PATTERN.test(message)) {
            return ref;
        }
        ref = `${ref}~1`;
    }
    return ref;
}

function resolveCommitByMessage(dir, grepPattern) {
    const sha = git(dir, ['log', '--all', '--grep', grepPattern, '-1', '--format=%H']);
    if (!sha) {
        throw new Error(`No commit matching /${grepPattern}/ found in ${dir}`);
    }
    return sha;
}

// `cycles` intentionally exits 1 (a CI-gate signal) when cycles are found -
// that is correct, designed behavior for several fixtures in this corpus,
// not a failure. Treat only a crash / config error (recognizable output) as
// a smoke-check FAIL.
function run(dir, args, { allowNonZeroExit = false } = {}) {
    try {
        const output = execFileSync('node', [CLI, ...args], { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
        return { ok: true, output };
    } catch (err) {
        const output = (err.stdout || '') + (err.stderr || '');
        if (allowNonZeroExit && !/Invalid configuration|Failed to load config|Invalid git reference|Error:/i.test(output)) {
            return { ok: true, output };
        }
        return { ok: false, message: output || err.message };
    }
}

function extractNumber(output, label) {
    const match = output.match(new RegExp(`${label}:\\s*(\\d+)`));
    return match ? Number(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Phase 1: smoke check
// ---------------------------------------------------------------------------

console.log('Phase 1: smoke check (no crashes / config errors across all fixtures)\n');

let smokeFailures = 0;
for (const name of fixtures.sort()) {
    const dir = join(CORPUS_DIR, name);
    const count = commitCount(dir);
    const contentHead = resolveContentHead(dir);
    const contentCount = commitCount(dir, contentHead);
    const regressionBaseline = `${contentHead}~${Math.max(1, Math.min(5, contentCount - 1))}`;
    const historyBaseline = `HEAD~${Math.max(1, Math.min(5, count - 1))}`;

    const results = {
        cycles: run(dir, ['cycles'], { allowNonZeroExit: true }),
        regression: run(dir, ['regression', '--baseline', regressionBaseline], { allowNonZeroExit: true }),
        history: run(dir, ['history', '--baseline', historyBaseline, '--points', '5'], { allowNonZeroExit: true }),
    };
    const failed = Object.entries(results).filter(([, r]) => !r.ok);
    if (failed.length === 0) {
        console.log(`OK    ${name}`);
    } else {
        smokeFailures += 1;
        console.log(`FAIL  ${name}`);
        for (const [cmd, r] of failed) {
            console.log(`        ${cmd}: ${r.message.split('\n').slice(0, 3).join(' | ')}`);
        }
    }
}

console.log(`\n${fixtures.length - smokeFailures}/${fixtures.length} fixtures passed the smoke check.`);

// ---------------------------------------------------------------------------
// Phase 2: machine-verifiable assertions on representative fixtures
// ---------------------------------------------------------------------------

console.log('\nPhase 2: assertions (real observations on representative fixtures)\n');

const assertionErrors = [];
let assertionCount = 0;

function assertEqual(actual, expected, description) {
    assertionCount += 1;
    if (actual !== expected) {
        assertionErrors.push(`${description}: expected ${expected}, got ${actual}`);
        console.log(`FAIL  ${description} (expected ${expected}, got ${actual})`);
    } else {
        console.log(`OK    ${description} (${actual})`);
    }
}

function assertAtLeast(actual, min, description) {
    assertionCount += 1;
    if (actual === null || actual < min) {
        assertionErrors.push(`${description}: expected >= ${min}, got ${actual}`);
        console.log(`FAIL  ${description} (expected >= ${min}, got ${actual})`);
    } else {
        console.log(`OK    ${description} (${actual})`);
    }
}

// Restores the exact original branch by name rather than relying on
// `git checkout -` (which depends on reflog state that has proven fragile
// to interleaving this script's own child-process CLI invocations with),
// so a fixture's repo is never left detached even if something in between
// behaves unexpectedly.
function checkedOutAt(dir, ref, fn) {
    const originalBranch = git(dir, ['branch', '--show-current']);
    git(dir, ['checkout', '-q', ref]);
    try {
        return fn();
    } finally {
        git(dir, ['checkout', '-q', originalBranch]);
    }
}

function cyclesAt(dir, ref) {
    return checkedOutAt(dir, ref, () => {
        const result = run(dir, ['cycles'], { allowNonZeroExit: true });
        return extractNumber(result.output ?? result.message ?? '', 'Cycles detected');
    });
}

function dependenciesAt(dir, ref) {
    return checkedOutAt(dir, ref, () => {
        const result = run(dir, ['cycles'], { allowNonZeroExit: true });
        return extractNumber(result.output ?? result.message ?? '', 'Dependencies');
    });
}

function largestSccAt(dir, ref) {
    return checkedOutAt(dir, ref, () => {
        const result = run(dir, ['cycles'], { allowNonZeroExit: true });
        return extractNumber(result.output ?? result.message ?? '', 'Largest SCC');
    });
}

// --- cycle presence/absence on representative fixtures -----------------

{
    const dir = join(CORPUS_DIR, 'same-directory-complex');
    assertAtLeast(cyclesAt(dir, 'HEAD'), 1, 'same-directory-complex @ HEAD has >=1 cycle (a real cycle in one flat directory)');
}
{
    const dir = join(CORPUS_DIR, 'flat-app');
    assertAtLeast(cyclesAt(dir, 'HEAD'), 1, 'flat-app @ HEAD has >=1 cycle (api.ts <-> notification.ts, same directory)');
}
{
    const dir = join(CORPUS_DIR, 'cyclic-app');
    assertEqual(cyclesAt(dir, 'HEAD'), 0, 'cyclic-app @ HEAD has 0 runtime cycles (all three introduced cycles were fixed)');
}
{
    const dir = join(CORPUS_DIR, 'feature-oriented-app');
    assertEqual(cyclesAt(dir, 'HEAD'), 0, 'feature-oriented-app @ HEAD has 0 cycles (orders<->payments cycle was fixed)');
}

// --- large-cycle-app: large SCC + high-external-fanout cycle member -----
// (added for the cycle-node-details/educational-modal work - the rest of
// the corpus's cycle fixtures top out at a 3-node SCC and 1-2 external
// deps per cycle member; this fixture is the one place with a genuinely
// large SCC and a cycle member with many real external dependencies.)

{
    const dir = join(CORPUS_DIR, 'large-cycle-app');
    assertEqual(cyclesAt(dir, 'HEAD'), 2, 'large-cycle-app @ HEAD has exactly 2 independent cycles (the 7-node ring + the 2-node pair)');
    assertEqual(largestSccAt(dir, 'HEAD'), 7, 'large-cycle-app @ HEAD has a largest SCC of 7 modules (the ring)');
}

// --- mts-cts: the .mts/.cts discovery regression fixture ----------------

{
    const dir = join(CORPUS_DIR, 'mts-cts');
    assertEqual(cyclesAt(dir, 'HEAD'), 1, 'mts-cts @ HEAD has exactly 1 cycle (core.ts <-> cjsBoundary.cts)');

    const mtsCycleCommit = resolveCommitByMessage(dir, '^introduce a real cycle: core.ts -> esmBoundary.mts');
    assertEqual(cyclesAt(dir, mtsCycleCommit), 1, 'mts-cts @ "esmBoundary.mts cycle" commit has exactly 1 cycle');
}

// --- history-laboratory: structural invariants at specific commits ------

{
    const dir = join(CORPUS_DIR, 'history-laboratory');
    const introduceCycle = resolveCommitByMessage(dir, '^04: introduce cycle');
    const removeCycle = resolveCommitByMessage(dir, '^05: remove cycle');
    const addTypeOnlyDep = resolveCommitByMessage(dir, '^06: add type-only dependency');

    assertEqual(cyclesAt(dir, introduceCycle), 1, 'history-laboratory @ "04: introduce cycle" has exactly 1 cycle');
    assertEqual(cyclesAt(dir, removeCycle), 0, 'history-laboratory @ "05: remove cycle" has 0 cycles');

    // The type-only dependency added at commit 06 must be invisible to a
    // plain dependency count (default includeTypeOnlyImports: false).
    const depsAtRemoveCycle = dependenciesAt(dir, removeCycle);
    const depsAtAddTypeOnlyDep = dependenciesAt(dir, addTypeOnlyDep);
    assertEqual(
        depsAtAddTypeOnlyDep,
        depsAtRemoveCycle,
        'history-laboratory: Dependencies unchanged from commit 05 to 06 with includeTypeOnlyImports=false (the new dep is type-only)'
    );
}

// --- includeTypeOnlyImports flip on two TypeScript fixtures --------------
// Never mutates a real fixture - copies it (including its .git history) to
// a scratch temp directory first, so the corpus on disk is untouched
// regardless of how this script exits.

function withTypeOnlyFlip(fixtureName, run) {
    const src = join(CORPUS_DIR, fixtureName);
    const tmp = mkdtempSync(join(tmpdir(), `dep-health-validate-${fixtureName}-`));
    try {
        cpSync(src, tmp, { recursive: true });
        const configPath = join(tmp, 'dep-health.config.json');
        const config = JSON.parse(readFileSync(configPath, 'utf8'));

        const before = run(tmp);

        config.features.regression.typescript = { includeTypeOnlyImports: true };
        config.features.scc.typescript = { includeTypeOnlyImports: true };
        writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

        const after = run(tmp);

        return { before, after };
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
}

for (const fixtureName of ['vanilla-ts', 'react-ts']) {
    const { before, after } = withTypeOnlyFlip(fixtureName, (dir) => {
        const result = run(dir, ['cycles'], { allowNonZeroExit: true });
        return extractNumber(result.output ?? result.message ?? '', 'Cycles detected');
    });
    assertEqual(before, 0, `${fixtureName}: 0 cycles with includeTypeOnlyImports=false (default)`);
    assertEqual(after, 1, `${fixtureName}: 1 cycle with includeTypeOnlyImports=true`);
}

// ---------------------------------------------------------------------------

console.log(`\n${assertionCount - assertionErrors.length}/${assertionCount} assertions passed.`);

const failures = smokeFailures + assertionErrors.length;
process.exit(failures > 0 ? 1 : 0);
