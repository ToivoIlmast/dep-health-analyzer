// Large-scale cycles fixture ("cycles-large") - see test-projects-scale/README.md
// for why this lives outside test-projects/ (kept out of
// scripts/validate-test-projects.mjs's fixture-discovery loop and
// `npm run test-projects:generate`'s existing runtime - both stay exactly
// as fast as before). Reuses scripts/test-projects-toolkit.mjs's existing
// write/commit/config helpers and its new writeChain()/closeRing() - no
// second file-writing/git mechanism.
//
// Purpose: the main fixture for MANUALLY looking at the Graph view (see
// `npm run dev:cycle-map:large`) on something bigger and more varied than
// large-cycle-app's own 19-module, 2-cycle shape - roughly 600 modules,
// ~20 independent cycles of deliberately different sizes/shapes, and one
// genuinely large (50-module) SCC, laid out as a realistic-looking
// layered app (core utils -> shared -> feature areas -> one composing
// entry point) rather than a flat pile of identical A -> B -> C -> A
// rings.
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

const FIXTURE_NAME = 'cycles-large';

// --- Layer sizes -----------------------------------------------------------
const CORE_COUNT = 20; // independent leaf utilities, no internal deps
const SHARED_COUNT = 15; // each depends on 1-2 core modules

// Plain (acyclic) feature areas - the bulk of the module count, giving the
// graph a realistic "many similar features" shape around the cycles.
const PLAIN_AREA_COUNT = 30;
const PLAIN_FILES_PER_AREA = 15;

// Cycle recipe: deliberately varied sizes/shapes, not N copies of the same
// ring. "count" is how many separate areas get a cycle of that "size"
// (each one is its own independent SCC - Kosaraju finds them as distinct
// components as long as no edge accidentally bridges two of them together
// in both directions, which this generator never does: all cross-area
// edges below point from a HIGHER-numbered, later-built area back to an
// EARLIER one only, one-way).
const CYCLE_RECIPES = [
    { size: 2, count: 10 }, // simple direct back-and-forth cycles
    { size: 3, count: 5 },
    { size: 5, count: 3 },
    { size: 8, count: 2 }, // one of these two also gets an extra chord (see below) - a real SCC that isn't just a bare ring
];
const BIG_SCC_SIZE = 50; // the "at least one genuinely large SCC" requirement

function coreModule(i) {
    return `fnCore${i}`;
}

function sharedModule(j) {
    return `fnShared${j}`;
}

function genCyclesLarge() {
    const dir = freshRepo(FIXTURE_NAME, SCALE_ROOT);
    writePackageJson(dir, { name: FIXTURE_NAME, version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    // --- core: independent leaf utilities, no dependencies of their own ---
    for (let i = 0; i < CORE_COUNT; i++) {
        write(dir, `src/core/core${i}.ts`, `export function ${coreModule(i)}(): number {\n    return ${i};\n}\n`);
    }

    // --- shared: each depends on 1-2 core modules (deterministic pick) ----
    for (let j = 0; j < SHARED_COUNT; j++) {
        const a = j % CORE_COUNT;
        const b = (j * 7 + 3) % CORE_COUNT;
        write(
            dir,
            `src/shared/shared${j}.ts`,
            `import { ${coreModule(a)} } from '../core/core${a}';\n` +
                `import { ${coreModule(b)} } from '../core/core${b}';\n\n` +
                `export function ${sharedModule(j)}(): number {\n    return ${coreModule(a)}() + ${coreModule(b)}();\n}\n`
        );
    }
    commit(dir, `baseline: ${CORE_COUNT} core utilities + ${SHARED_COUNT} shared modules, no cycles yet`);

    // --- plain feature areas: realistic bulk, deliberately acyclic --------
    // Each area's file0 depends on a shared module; files 1..N-1 form a
    // short local chain back to file0. Every 4th area's file0 ALSO reaches
    // into an EARLIER area's file0 (areaIndex -> areaIndex-4, strictly
    // decreasing) - a one-way cross-feature edge for structural realism,
    // never able to close a cycle since it always points to a
    // lower-numbered, already-built area.
    for (let a = 0; a < PLAIN_AREA_COUNT; a++) {
        const sharedIdx = a % SHARED_COUNT;
        const crossAreaIdx = a >= 4 && a % 4 === 0 ? a - 4 : null;
        for (let f = 0; f < PLAIN_FILES_PER_AREA; f++) {
            const isEntry = f === 0;
            const importLines = [];
            const callParts = [String(f)];

            if (f < PLAIN_FILES_PER_AREA - 1) {
                importLines.push(`import { fnArea${a}_${f + 1} } from './file${f + 1}';`);
                callParts.push(`fnArea${a}_${f + 1}()`);
            }
            if (isEntry) {
                importLines.push(`import { ${sharedModule(sharedIdx)} } from '../../shared/shared${sharedIdx}';`);
                callParts.push(`${sharedModule(sharedIdx)}()`);
                if (crossAreaIdx !== null) {
                    importLines.push(`import { fnArea${crossAreaIdx}_0 } from '../area${crossAreaIdx}/file0';`);
                    callParts.push(`fnArea${crossAreaIdx}_0()`);
                }
            }

            write(
                dir,
                `src/features/area${a}/file${f}.ts`,
                `${importLines.join('\n')}\n\nexport function fnArea${a}_${f}(): number {\n    return ${callParts.join(' + ')};\n}\n`
            );
        }
    }
    commit(dir, `add ${PLAIN_AREA_COUNT} plain feature areas (${PLAIN_AREA_COUNT * PLAIN_FILES_PER_AREA} modules) - realistic layered bulk, no cycles`);

    // --- cycle areas: one dedicated area per recipe entry, each its own
    // independent SCC -------------------------------------------------------
    let cycleAreaIndex = 0;
    const cycleSummaries = [];

    for (const recipe of CYCLE_RECIPES) {
        for (let n = 0; n < recipe.count; n++) {
            const areaName = `cycle${cycleAreaIndex}`;
            const folder = `features/${areaName}`;
            const prefix = `c${cycleAreaIndex}_`;

            writeChain(dir, folder, prefix, recipe.size);
            closeRing(dir, folder, prefix, recipe.size);

            // Give every cycle member real external dependencies (Ce) via
            // its own already-established shared import - and, for the
            // FIRST member of each cycle, a real external dependent (Ca)
            // by having one plain area's own entry point call into it.
            // Mirrors large-cycle-app's own ring0 (many real external
            // deps) and entry.ts (a real external caller) at a larger,
            // more varied scale instead of one single hand-picked case.
            const sharedIdx = cycleAreaIndex % SHARED_COUNT;
            write(
                dir,
                `src/${folder}/${prefix}0.ts`,
                `import { fn${prefix}1 } from './${prefix}1';\n` +
                    `import { ${sharedModule(sharedIdx)} } from '../../shared/shared${sharedIdx}';\n\n` +
                    `export function fn${prefix}0(): number {\n    return 0 + fn${prefix}1() + ${sharedModule(sharedIdx)}();\n}\n`
            );

            cycleSummaries.push({ area: areaName, size: recipe.size, folder, prefix });
            cycleAreaIndex += 1;
        }
    }

    // One of the two 8-node cycles also gets an extra internal chord (a
    // second, non-adjacent internal edge) - the same SCC, but a real one
    // with more edges than a bare ring, not "just a bigger version of the
    // same shape" as every other cycle here.
    const chordCycle = cycleSummaries.find((c) => c.size === 8);
    if (chordCycle) {
        const { folder, prefix, size } = chordCycle;
        const midA = Math.floor(size / 2) - 1;
        const midB = Math.floor(size / 2) + 1;
        write(
            dir,
            `src/${folder}/${prefix}${midA}.ts`,
            `import { fn${prefix}${midA + 1} } from './${prefix}${midA + 1}';\n` +
                `import { fn${prefix}${midB} } from './${prefix}${midB}';\n\n` +
                `export function fn${prefix}${midA}(): number {\n    return ${midA} + fn${prefix}${midA + 1}() + fn${prefix}${midB}();\n}\n`
        );
    }

    commit(
        dir,
        `add ${cycleAreaIndex} independent cycle areas (sizes ${CYCLE_RECIPES.map((r) => `${r.count}x${r.size}`).join(', ')}) - one 8-node cycle also has an extra internal chord, a real SCC beyond a bare ring`
    );

    // --- the one genuinely large SCC ---------------------------------------
    const bigFolder = 'features/bigring';
    const bigPrefix = 'big';
    writeChain(dir, bigFolder, bigPrefix, BIG_SCC_SIZE);
    closeRing(dir, bigFolder, bigPrefix, BIG_SCC_SIZE);
    // Same "real external deps + a real external caller" treatment as the
    // smaller cycles, scaled to this fixture's own single big member.
    write(
        dir,
        `src/${bigFolder}/${bigPrefix}0.ts`,
        `import { fn${bigPrefix}1 } from './${bigPrefix}1';\n` +
            `import { ${sharedModule(0)} } from '../../shared/shared0';\n\n` +
            `export function fn${bigPrefix}0(): number {\n    return 0 + fn${bigPrefix}1() + ${sharedModule(0)}();\n}\n`
    );
    commit(dir, `add one large ${BIG_SCC_SIZE}-module ring cycle (bigring) - the fixture's one genuinely large SCC`);

    // --- one composing entry point, reaching into several areas + both
    // large structures - and one plain area's file0 that calls into the
    // big ring and one of the small cycles, giving those cycle members a
    // real external caller (Ca) from OUTSIDE their own cycle. -----------
    write(
        dir,
        'src/features/area1/file0.ts',
        `import { fnArea1_1 } from './file1';\n` +
            `import { ${sharedModule(1 % SHARED_COUNT)} } from '../../shared/shared${1 % SHARED_COUNT}';\n` +
            `import { fnbig0 } from '../bigring/big0';\n` +
            `import { fnc0_0 } from '../cycle0/c0_0';\n\n` +
            `export function fnArea1_0(): number {\n    return 0 + fnArea1_1() + ${sharedModule(1 % SHARED_COUNT)}() + fnbig0() + fnc0_0();\n}\n`
    );
    write(
        dir,
        'src/entry.ts',
        `import { fnArea0_0 } from './features/area0/file0';\n` +
            `import { fnArea1_0 } from './features/area1/file0';\n` +
            `import { fnbig0 } from './features/bigring/big0';\n\n` +
            `export function run(): number {\n    return fnArea0_0() + fnArea1_0() + fnbig0();\n}\n`
    );
    commit(dir, 'wire area1 (a plain feature) into the big ring and cycle0, and add one composing entry.ts - a realistic single root reaching the whole graph');

    return { dir, cycleCount: cycleAreaIndex + 1 };
}

const { cycleCount } = genCyclesLarge();
console.log(`Generated: ${FIXTURE_NAME} (test-projects-scale/${FIXTURE_NAME}) - ${cycleCount} independent cycles`);
