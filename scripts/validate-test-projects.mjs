// Lightweight smoke-check: runs dep-health-analyzer's `cycles`, `regression`,
// and `history` commands against every fixture under test-projects/ and
// reports which ones exit non-zero / throw. This is NOT a correctness suite -
// it only catches crashes and config errors so a broken fixture doesn't slip
// silently into the corpus. Deliberately not Jest/Vitest - see the task spec.
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CORPUS_DIR = join(ROOT, 'test-projects');
const CLI = join(ROOT, 'dist', 'app', 'cli.js');

if (!existsSync(CLI)) {
    console.error('dist/app/cli.js not found - run `npm run build` first.');
    process.exit(1);
}

const fixtures = readdirSync(CORPUS_DIR).filter((name) => statSync(join(CORPUS_DIR, name)).isDirectory());

function commitCount(cwd) {
    return Number(execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd, encoding: 'utf8' }).trim());
}

// `cycles` intentionally exits 1 (a CI-gate signal) when cycles are found - that
// is correct, designed behavior for several fixtures in this corpus, not a
// failure. Treat only a crash / config error (recognizable output) as FAIL.
function run(cwd, args, { allowNonZeroExit = false } = {}) {
    try {
        const output = execFileSync('node', [CLI, ...args], { cwd, stdio: 'pipe', encoding: 'utf8' });
        return { ok: true, output };
    } catch (err) {
        const output = (err.stdout || '') + (err.stderr || '');
        if (allowNonZeroExit && !/Invalid configuration|Failed to load config|Invalid git reference|Error:/i.test(output)) {
            return { ok: true, output };
        }
        return { ok: false, message: output || err.message };
    }
}

let failures = 0;
for (const name of fixtures.sort()) {
    const dir = join(CORPUS_DIR, name);
    const count = commitCount(dir);
    const baseline = `HEAD~${Math.max(1, Math.min(5, count - 1))}`;
    const results = {
        cycles: run(dir, ['cycles'], { allowNonZeroExit: true }),
        regression: run(dir, ['regression', '--baseline', `HEAD~${Math.max(1, Math.min(1, count - 1))}`]),
        history: run(dir, ['history', '--baseline', baseline, '--points', '5']),
    };
    const failed = Object.entries(results).filter(([, r]) => !r.ok);
    if (failed.length === 0) {
        console.log(`OK    ${name}`);
    } else {
        failures += 1;
        console.log(`FAIL  ${name}`);
        for (const [cmd, r] of failed) {
            console.log(`        ${cmd}: ${r.message.split('\n').slice(0, 3).join(' | ')}`);
        }
    }
}

console.log(`\n${fixtures.length - failures}/${fixtures.length} fixtures passed the smoke check.`);
process.exit(failures > 0 ? 1 : 0);
