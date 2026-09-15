// Validates the large-scale corpus (test-projects-scale/, see its own
// README.md) - a sibling of scripts/validate-test-projects.mjs, kept
// completely separate rather than folded into it, since these fixtures are
// NOT part of that script's `readdirSync(test-projects/)` auto-discovery and
// exist for a different purpose (scale/performance, not breadth of project
// shapes). Two things, deliberately not merged:
//
//   1. Correctness assertions on cycles-large and regression-large - the two
//      fixtures with a designed, known-correct answer (exact cycle/SCC
//      counts, exact regression finding deltas at specific commits).
//   2. Performance measurement on scale-medium and both stress-10k-*
//      fixtures - wall-clock time and peak RSS via `/usr/bin/time -v`,
//      REPORTED, not gated against an invented pass/fail threshold (per this
//      corpus's own design brief: measure and record actual numbers rather
//      than guessing at a "should take less than Nms" rule with no basis).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCALE_DIR = join(ROOT, 'test-projects-scale');
const CLI = join(ROOT, 'dist', 'app', 'cli.js');

if (!existsSync(CLI)) {
    console.error('dist/app/cli.js not found - run `npm run build` first.');
    process.exit(1);
}

function git(dir, args) {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

function resolveCommitByMessage(dir, grepPattern) {
    const sha = git(dir, ['log', '--all', '--grep', grepPattern, '-1', '--format=%H']);
    if (!sha) {
        throw new Error(`No commit matching /${grepPattern}/ found in ${dir}`);
    }
    return sha;
}

function checkedOutAt(dir, ref, fn) {
    const originalBranch = git(dir, ['branch', '--show-current']);
    git(dir, ['checkout', '-q', ref]);
    try {
        return fn();
    } finally {
        git(dir, ['checkout', '-q', originalBranch]);
    }
}

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

function cyclesAt(dir, ref) {
    return checkedOutAt(dir, ref, () => {
        const result = run(dir, ['cycles'], { allowNonZeroExit: true });
        return {
            cycles: extractNumber(result.output ?? result.message ?? '', 'Cycles detected'),
            largestScc: extractNumber(result.output ?? result.message ?? '', 'Largest SCC'),
            modules: extractNumber(result.output ?? result.message ?? '', 'Modules'),
        };
    });
}

let assertionCount = 0;
const assertionErrors = [];

function assertEqual(actual, expected, description) {
    assertionCount += 1;
    if (actual !== expected) {
        assertionErrors.push(`${description}: expected ${expected}, got ${actual}`);
        console.log(`FAIL  ${description} (expected ${expected}, got ${actual})`);
    } else {
        console.log(`OK    ${description} (${actual})`);
    }
}

// ---------------------------------------------------------------------------
// Part 1: correctness assertions
// ---------------------------------------------------------------------------

console.log('Part 1: correctness assertions on cycles-large and regression-large\n');

{
    const dir = join(SCALE_DIR, 'cycles-large');
    const head = cyclesAt(dir, 'HEAD');
    assertEqual(head.cycles, 21, 'cycles-large @ HEAD: exactly 21 independent cycles');
    assertEqual(head.largestScc, 50, 'cycles-large @ HEAD: largest SCC is the 50-module bigring');
    assertEqual(head.modules, 602, 'cycles-large @ HEAD: exactly 602 modules');
}

{
    const dir = join(SCALE_DIR, 'regression-large');
    const head = cyclesAt(dir, 'HEAD');
    assertEqual(head.cycles, 0, 'regression-large @ HEAD: 0 cycles (all introduced cycles were fixed)');

    const introduceCycle = resolveCommitByMessage(dir, '^04: introduce a new cycle');
    const atIntroduce = cyclesAt(dir, introduceCycle);
    assertEqual(atIntroduce.cycles, 1, 'regression-large @ "04: introduce a new cycle": exactly 1 cycle');
    assertEqual(atIntroduce.largestScc, 4, 'regression-large @ "04: introduce a new cycle": largest SCC is the 4-module cycleA ring');

    const removeCycle = resolveCommitByMessage(dir, '^07: fix - break cycleA');
    assertEqual(cyclesAt(dir, removeCycle).cycles, 0, 'regression-large @ "07: fix - break cycleA": 0 cycles');

    // Regression delta 03 -> 05: baseline (03) predates both the cycleA
    // cycle (introduced at 04, a 4-module same-directory ring -> 4 "sibling"
    // findings) and the area0 -> cycleA call (-> 1 "internal" finding) and
    // the deep-internal reach (introduced at 05, area15 -> area16's nested
    // internal file). `regression`'s counts are of NEW findings relative to
    // the baseline, not a running total, so this combined diff is the
    // deterministic expected shape - verified directly against `--mode full`
    // output before being encoded here.
    const introduceFindings = resolveCommitByMessage(dir, '^03: introduce 10 new cross-boundary');
    const deepInternalCommit = resolveCommitByMessage(dir, '^05: introduce a deep-internal finding');
    const deltaOutput = checkedOutAt(dir, deepInternalCommit, () => {
        const result = run(dir, ['regression', '--baseline', introduceFindings, '--mode', 'compact'], { allowNonZeroExit: true });
        return result.output ?? result.message ?? '';
    });
    assertEqual(extractNumber(deltaOutput, 'Deep internal traversals'), 1, 'regression-large 03->05: exactly 1 deep-internal finding (area15 -> area16 nested)');
    assertEqual(extractNumber(deltaOutput, 'Sibling dependencies'), 4, 'regression-large 03->05: exactly 4 sibling findings (cycleA\'s own 4 internal ring edges)');
    assertEqual(extractNumber(deltaOutput, 'Internal dependencies'), 1, 'regression-large 03->05: exactly 1 internal finding (area0 -> cycleA)');

    // Regression HEAD~1 at commit 05 (relative to its own parent, 04): the
    // same deep-internal finding in isolation, with nothing from cycleA
    // (which already existed at 04, the parent) mixed in.
    const deepInternalOnlyOutput = checkedOutAt(dir, deepInternalCommit, () => {
        const result = run(dir, ['regression', '--baseline', 'HEAD~1', '--mode', 'compact'], { allowNonZeroExit: true });
        return result.output ?? result.message ?? '';
    });
    assertEqual(
        extractNumber(deepInternalOnlyOutput, 'Deep internal traversals'),
        1,
        'regression-large HEAD~1 @ commit 05: exactly 1 deep-internal finding introduced'
    );
}

console.log(`\n${assertionCount - assertionErrors.length}/${assertionCount} correctness assertions passed.`);

// ---------------------------------------------------------------------------
// Part 2: performance measurement (reported, not gated on an invented
// threshold - see this script's own header comment)
// ---------------------------------------------------------------------------

console.log('\nPart 2: performance measurement (wall time + peak RSS via /usr/bin/time -v)\n');

function measure(dir, args) {
    const result = spawnSync('/usr/bin/time', ['-v', 'node', CLI, ...args], {
        cwd: dir,
        encoding: 'utf8',
    });
    const stderr = result.stderr ?? '';
    const wallClock = stderr.match(/Elapsed \(wall clock\) time.*?:\s*([\d:.]+)/)?.[1] ?? null;
    const maxRssKb = stderr.match(/Maximum resident set size \(kbytes\):\s*(\d+)/)?.[1] ?? null;
    return {
        exitOk: result.status === 0 || result.status === 1, // 1 = cycles/regression found, a valid CI-gate exit
        wallClock,
        maxRssMb: maxRssKb ? (Number(maxRssKb) / 1024).toFixed(1) : null,
    };
}

const perfFixtures = ['scale-medium', 'stress-10k-acyclic', 'stress-10k-cyclic'];
const perfResults = [];

for (const name of perfFixtures) {
    const dir = join(SCALE_DIR, name);
    const cyclesRun = measure(dir, ['cycles', '--mode', 'compact']);
    const regressionRun = measure(dir, ['regression', '--baseline', 'HEAD~1', '--mode', 'compact']);
    const historyRun = measure(dir, ['history', '--baseline', 'HEAD~1', '--points', '2', '--mode', 'compact']);

    perfResults.push({ name, cyclesRun, regressionRun, historyRun });

    console.log(`${name}:`);
    console.log(`  cycles      wall=${cyclesRun.wallClock ?? 'n/a'}  peakRSS=${cyclesRun.maxRssMb ?? 'n/a'}MB  ok=${cyclesRun.exitOk}`);
    console.log(`  regression  wall=${regressionRun.wallClock ?? 'n/a'}  peakRSS=${regressionRun.maxRssMb ?? 'n/a'}MB  ok=${regressionRun.exitOk}`);
    console.log(`  history     wall=${historyRun.wallClock ?? 'n/a'}  peakRSS=${historyRun.maxRssMb ?? 'n/a'}MB  ok=${historyRun.exitOk}`);
}

const perfFailures = perfResults.filter(
    (r) => !r.cyclesRun.exitOk || !r.regressionRun.exitOk || !r.historyRun.exitOk
);
if (perfFailures.length > 0) {
    console.log(`\n${perfFailures.length} fixture(s) had a command exit abnormally (crash/stack overflow) - see above.`);
} else {
    console.log('\nAll performance runs completed without crashing (no non-CI-gate abnormal exit).');
}

// ---------------------------------------------------------------------------

const failures = assertionErrors.length + perfFailures.length;
process.exit(failures > 0 ? 1 : 0);
