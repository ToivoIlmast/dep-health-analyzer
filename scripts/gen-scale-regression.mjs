// Large-scale regression/history fixture ("regression-large") - see
// test-projects-scale/README.md for why this corpus is a sibling of
// test-projects/, not inside it. Reuses scripts/test-projects-toolkit.mjs's
// existing write/commit/config helpers and writeChain()/closeRing().
//
// Purpose: history-laboratory (test-projects/history-laboratory) already
// proves the PATTERN this fixture scales up - a deliberate, documented
// commit-by-commit sequence, each commit isolating one class of structural
// event (new cross-boundary reaches, a new cycle, a fix, deep-internal
// reaches, growth) - at history-laboratory's own ~10-module scale.
// regression-large repeats that exact pattern at a few hundred modules, so
// the SAME two things history-laboratory already validates at toy scale -
// `regression --baseline <X>` reporting the expected finding delta between
// two specific, named commits, and `history` walking N sampled points and
// producing a real trend - can also be validated (and timed) on something
// actually "large" per this task's own wording, without inventing a second
// regression-fixture design. One fixture serves both the task's own
// "regression fixture" and "history fixture" requirements, exactly as
// history-laboratory already does at small scale.
import {
    freshRepo,
    write,
    commit,
    writePackageJson,
    writeDepHealthConfig,
    writeTsconfig,
    gitignoreNodeModules,
    writeChain,
    closeRing,
} from './test-projects-toolkit.mjs';
import { SCALE_ROOT } from './scale-corpus-toolkit.mjs';

const FIXTURE_NAME = 'regression-large';
const CORE_COUNT = 15;
const AREA_COUNT = 20; // "features/areaN", each AREA_SIZE modules
const AREA_SIZE = 15; // -> 300 modules across areas, +15 core = 315 baseline

function genRegressionLarge() {
    const dir = freshRepo(FIXTURE_NAME, SCALE_ROOT);
    writePackageJson(dir, { name: FIXTURE_NAME, version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    // internalDepth: 2 (not the default 3) so a feature area only 2
    // segments deep (features/areaN/fileM.ts) already counts as its own
    // "area" for cross-boundary classification - matching the same choice
    // dep-health's own root config makes for its similarly-shallow
    // src/features/**, so the cross-boundary/deep-internal findings this
    // fixture deliberately introduces below actually classify as such
    // instead of everything reading as "internal" by default.
    writeDepHealthConfig(dir, {
        features: {
            regression: {
                enabled: true,
                thresholds: { internalDepth: 2, deepInternalResidualDepth: 2 },
                history: { enabled: true, sampleSize: 10 },
            },
            scc: { enabled: true },
        },
    });

    // --- 01: clean baseline - core + feature areas, no cross-links -----
    for (let i = 0; i < CORE_COUNT; i++) {
        write(dir, `src/core/core${i}.ts`, `export function fnCore${i}(): number {\n    return ${i};\n}\n`);
    }
    for (let a = 0; a < AREA_COUNT; a++) {
        const coreIdx = a % CORE_COUNT;
        writeChain(dir, `features/area${a}`, `a${a}_`, AREA_SIZE, (i) =>
            i === 0
                ? { imports: [`import { fnCore${coreIdx} } from '../../core/core${coreIdx}';`], calls: [`fnCore${coreIdx}()`] }
                : null
        );
    }
    commit(dir, `01: clean baseline - ${CORE_COUNT} core modules + ${AREA_COUNT} feature areas of ${AREA_SIZE} modules each, no cross-area findings`);

    // --- 02: growth - a few more areas, still clean --------------------
    for (let a = AREA_COUNT; a < AREA_COUNT + 3; a++) {
        const coreIdx = a % CORE_COUNT;
        writeChain(dir, `features/area${a}`, `a${a}_`, AREA_SIZE, (i) =>
            i === 0
                ? { imports: [`import { fnCore${coreIdx} } from '../../core/core${coreIdx}';`], calls: [`fnCore${coreIdx}()`] }
                : null
        );
    }
    commit(dir, '02: growth - add 3 more feature areas, still no cross-area findings');

    // --- 03: introduce a batch of new cross-boundary findings -----------
    // Each of areas 0-9's LAST file reaches directly into a LATER area's
    // internal (non-entry) file - a real cross-boundary edge per the
    // relationClassifier's own rule (different top-level "area", not a
    // shallow same-area reach), 10 new findings in one deterministic batch.
    for (let a = 0; a < 10; a++) {
        const targetArea = a + 10;
        const lastFile = AREA_SIZE - 1;
        write(
            dir,
            `src/features/area${a}/a${a}_${lastFile}.ts`,
            `import { fna${targetArea}_5 } from '../area${targetArea}/a${targetArea}_5';\n\n` +
                `export function fna${a}_${lastFile}(): number {\n    return ${lastFile} + fna${targetArea}_5();\n}\n`
        );
    }
    commit(dir, '03: introduce 10 new cross-boundary findings (areas 0-9 each reach into a later area\'s internals)');

    // --- 04: introduce a new cycle --------------------------------------
    writeChain(dir, 'features/cycleA', 'cy_', 4);
    closeRing(dir, 'features/cycleA', 'cy_', 4);
    write(
        dir,
        'src/features/area0/a0_0.ts',
        `import { fna0_1 } from './a0_1';\n` +
            `import { fnCore0 } from '../../core/core0';\n` +
            `import { fncy_0 } from '../cycleA/cy_0';\n\n` +
            `export function fna0_0(): number {\n    return 0 + fna0_1() + fnCore0() + fncy_0();\n}\n`
    );
    commit(dir, '04: introduce a new cycle (features/cycleA, 4 modules), reached from area0');

    // --- 05: introduce deep-internal findings ---------------------------
    // area15's file0 reaches 3 levels into area16's own internal
    // subfolder instead of its shallow entry point - a deep-internal
    // finding (residualDepth >= deepInternalResidualDepth), distinct from
    // the plain cross-boundary reaches added at commit 03.
    write(
        dir,
        'src/features/area16/internal/deep/nested.ts',
        `export function fna16Nested(): number {\n    return 999;\n}\n`
    );
    write(
        dir,
        'src/features/area15/a15_0.ts',
        `import { fna15_1 } from './a15_1';\n` +
            `import { fnCore0 } from '../../core/core0';\n` +
            `import { fna16Nested } from '../area16/internal/deep/nested';\n\n` +
            `export function fna15_0(): number {\n    return 0 + fna15_1() + fnCore0() + fna16Nested();\n}\n`
    );
    commit(dir, '05: introduce a deep-internal finding (area15 reaches 3 levels into area16/internal/deep, not area16\'s shallow entry point)');

    // --- 06: partial fix - remove half the cross-boundary findings ------
    for (let a = 0; a < 5; a++) {
        const lastFile = AREA_SIZE - 1;
        write(
            dir,
            `src/features/area${a}/a${a}_${lastFile}.ts`,
            `export function fna${a}_${lastFile}(): number {\n    return ${lastFile};\n}\n`
        );
    }
    commit(dir, '06: partial fix - areas 0-4 no longer reach into a later area (5 of the 10 cross-boundary findings from commit 03 removed)');

    // --- 07: remove the cycle -------------------------------------------
    // Breaking the ring itself (cy_3 no longer imports back to cy_0) is
    // what actually removes the SCC - SCC detection runs over the WHOLE
    // graph regardless of reachability from any particular caller, so
    // merely having area0 stop importing cycleA (leaving the 4-module
    // ring's own closing edge intact) would NOT remove the cycle, only
    // make it unreached from area0. area0 also reverts to its
    // pre-commit-04 form, matching cyclic-app's own established pattern
    // for "remove a cycle by breaking one edge of the ring".
    write(dir, 'src/features/cycleA/cy_3.ts', `export function fncy_3(): number {\n    return 3;\n}\n`);
    write(
        dir,
        'src/features/area0/a0_0.ts',
        `import { fna0_1 } from './a0_1';\n` +
            `import { fnCore0 } from '../../core/core0';\n\n` +
            `export function fna0_0(): number {\n    return 0 + fna0_1() + fnCore0();\n}\n`
    );
    commit(dir, '07: fix - break cycleA\'s ring (cy_3 no longer imports cy_0) and area0 no longer depends on cycleA, removing the cycle introduced at commit 04');

    // --- 08: more growth --------------------------------------------------
    for (let a = AREA_COUNT + 3; a < AREA_COUNT + 6; a++) {
        const coreIdx = a % CORE_COUNT;
        writeChain(dir, `features/area${a}`, `a${a}_`, AREA_SIZE, (i) =>
            i === 0
                ? { imports: [`import { fnCore${coreIdx} } from '../../core/core${coreIdx}';`], calls: [`fnCore${coreIdx}()`] }
                : null
        );
    }
    commit(dir, '08: growth - add 3 more feature areas');

    // --- 09: a second, independent batch of findings --------------------
    for (let a = 20; a < 23; a++) {
        const targetArea = a + 3;
        write(
            dir,
            `src/features/area${a}/a${a}_0.ts`,
            `import { fna${a}_1 } from './a${a}_1';\n` +
                `import { fnCore${a % CORE_COUNT} } from '../../core/core${a % CORE_COUNT}';\n` +
                `import { fna${targetArea}_3 } from '../area${targetArea}/a${targetArea}_3';\n\n` +
                `export function fna${a}_0(): number {\n    return 0 + fna${a}_1() + fnCore${a % CORE_COUNT}() + fna${targetArea}_3();\n}\n`
        );
    }
    commit(dir, '09: introduce a second, independent batch of 3 new cross-boundary findings (areas 20-22 each reach into a later area)');

    // --- 10: fix the second batch ----------------------------------------
    for (let a = 20; a < 23; a++) {
        write(
            dir,
            `src/features/area${a}/a${a}_0.ts`,
            `import { fna${a}_1 } from './a${a}_1';\n` +
                `import { fnCore${a % CORE_COUNT} } from '../../core/core${a % CORE_COUNT}';\n\n` +
                `export function fna${a}_0(): number {\n    return 0 + fna${a}_1() + fnCore${a % CORE_COUNT}();\n}\n`
        );
    }
    commit(dir, '10: fix - the 3 findings introduced at commit 09 are all removed');

    return dir;
}

genRegressionLarge();
console.log(`Generated: ${FIXTURE_NAME} (test-projects-scale/${FIXTURE_NAME}) - 10 commits`);
