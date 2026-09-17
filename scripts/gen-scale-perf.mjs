// Scalability/performance fixtures - "scale-medium" (~2000 modules, several
// dependency-structure shapes, a handful of cycles) and the two "stress-10k"
// variants (~10000 modules each, acyclic and cyclic). See
// test-projects-scale/README.md for why this corpus is a sibling of
// test-projects/, not inside it. Reuses scripts/test-projects-toolkit.mjs's
// existing write/commit/config helpers and writeChain()/closeRing() - same
// generation mechanism as every other fixture in this repository, just
// applied at a larger N.
//
// Unlike cycles-large (hand-shaped for realism, since it's the one meant
// for manual visual inspection), these three exist purely to answer "does
// the analyzer still work, and how long does it take" at real scale - so
// their internal structure favors simple, fast-to-generate, easy-to-reason-
// about shapes over hand-crafted realism. Each one still mixes a few
// genuinely different dependency-structure shapes (a plain layered
// core/feature split, a wide flat fan-out area, and one long deep chain),
// per the task's own "несколько разных типов dependency structures"
// requirement - not just one repeated pattern stamped out 2000/10000 times.
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

// Builds one fixture's src/ tree in a single pass (one commit - these are
// perf fixtures, not history fixtures, so there is no benefit to spreading
// this across several commits the way cycles-large/regression-large do).
// Layout, by module count:
//   - CORE_FRACTION independent leaf utilities (no deps of their own).
//   - "flat" area: many modules that only depend on 1-2 core modules each
//     (a wide, shallow fan-out shape - the opposite of the deep chain
//     below).
//   - "layered" areas: several feature areas, each a short local chain
//     depending on one shared/core module (the same general shape
//     cycles-large's plain areas use, just without any cross-area edges,
//     to keep generation for 10000 modules simple and fast).
//   - one long "deep" chain using the REMAINING module budget - stresses
//     resolution of a long, narrow dependency path in one component,
//     structurally the opposite shape from the wide flat/layered areas.
//   - optional cycles: a fixed list of independent ring sizes, carved out
//     of the "layered" area budget (each cycle is its own small dedicated
//     area, exactly like cycles-large's cycle areas, just fewer/simpler).
function buildScaleFixture(name, { totalModules, cycleSizes = [] }) {
    const dir = freshRepo(name, SCALE_ROOT);
    writePackageJson(dir, { name, version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    const cycleModuleTotal = cycleSizes.reduce((sum, size) => sum + size, 0);
    const remaining = totalModules - cycleModuleTotal;

    const coreCount = Math.max(10, Math.round(remaining * 0.02));
    const flatCount = Math.round(remaining * 0.3);
    const deepCount = Math.round(remaining * 0.08);
    const layeredCount = remaining - coreCount - flatCount - deepCount;
    const AREA_SIZE = 20;

    // --- core: independent leaf utilities -----------------------------
    for (let i = 0; i < coreCount; i++) {
        write(dir, `src/core/core${i}.ts`, `export function fnCore${i}(): number {\n    return ${i};\n}\n`);
    }

    // --- flat: wide fan-out, each depends on 1-2 core modules ----------
    for (let i = 0; i < flatCount; i++) {
        const a = i % coreCount;
        const b = (i * 5 + 1) % coreCount;
        write(
            dir,
            `src/flat/flat${i}.ts`,
            `import { fnCore${a} } from '../core/core${a}';\n` +
                `import { fnCore${b} } from '../core/core${b}';\n\n` +
                `export function fnFlat${i}(): number {\n    return fnCore${a}() + fnCore${b}();\n}\n`
        );
    }

    // --- layered: many small feature areas, each a short local chain --
    let layeredWritten = 0;
    let areaIndex = 0;
    while (layeredWritten < layeredCount) {
        const size = Math.min(AREA_SIZE, layeredCount - layeredWritten);
        const coreIdx = areaIndex % coreCount;
        writeChain(dir, `features/area${areaIndex}`, `a${areaIndex}_`, size, (i) =>
            i === 0
                ? { imports: [`import { fnCore${coreIdx} } from '../../core/core${coreIdx}';`], calls: [`fnCore${coreIdx}()`] }
                : null
        );
        layeredWritten += size;
        areaIndex += 1;
    }

    // --- deep: one long dependency chain -------------------------------
    if (deepCount > 0) {
        writeChain(dir, 'deep', 'd', deepCount, (i) =>
            i === 0 ? { imports: [`import { fnCore0 } from '../core/core0';`], calls: ['fnCore0()'] } : null
        );
    }

    // --- cycles: independent rings, one dedicated area each ------------
    cycleSizes.forEach((size, idx) => {
        const folder = `cycles/ring${idx}`;
        const prefix = `r${idx}_`;
        writeChain(dir, folder, prefix, size);
        closeRing(dir, folder, prefix, size);
    });

    // --- one entry point tying flat/layered/deep/cycles together -------
    const entryImports = [];
    const entryCalls = [];
    if (flatCount > 0) {
        entryImports.push(`import { fnFlat0 } from './flat/flat0';`);
        entryCalls.push('fnFlat0()');
    }
    if (layeredCount > 0) {
        entryImports.push(`import { fna0_0 } from './features/area0/a0_0';`);
        entryCalls.push('fna0_0()');
    }
    if (deepCount > 0) {
        entryImports.push(`import { fnd0 } from './deep/d0';`);
        entryCalls.push('fnd0()');
    }
    cycleSizes.forEach((_, idx) => {
        entryImports.push(`import { fnr${idx}_0 } from './cycles/ring${idx}/r${idx}_0';`);
        entryCalls.push(`fnr${idx}_0()`);
    });
    write(
        dir,
        'src/entry.ts',
        `${entryImports.join('\n')}\n\nexport function run(): number {\n    return ${entryCalls.join(' + ') || '0'};\n}\n`
    );

    commit(
        dir,
        `generate ${name}: ${totalModules} modules total (core=${coreCount}, flat=${flatCount}, layered=${layeredCount} across ${areaIndex} areas, deep chain=${deepCount}, ${cycleSizes.length} cycles totaling ${cycleModuleTotal} modules)`
    );

    // A second, small growth commit - these three fixtures exist for raw
    // scale/performance timing (correctness-focused regression storytelling
    // is regression-large's own job - see gen-scale-regression.mjs), but
    // `regression`/`history` both need at least two commits to diff at all,
    // and "how long does regression/history take on a 2000/10000-module
    // repo" is one of this task's own explicit performance questions.
    // Adds ~1% more flat modules plus one deliberate new cross-boundary
    // reach (a new flat module importing directly into an existing
    // feature area's internals) - enough for a real, non-empty regression
    // diff without turning these into a second regression-correctness
    // fixture.
    const growthCount = Math.max(5, Math.round(totalModules * 0.01));
    for (let i = 0; i < growthCount; i++) {
        const idx = flatCount + i;
        const a = idx % coreCount;
        write(
            dir,
            `src/flat/flat${idx}.ts`,
            `import { fnCore${a} } from '../core/core${a}';\n\nexport function fnFlat${idx}(): number {\n    return fnCore${a}();\n}\n`
        );
    }
    if (layeredCount > 0) {
        write(
            dir,
            `src/flat/flat${flatCount + growthCount}.ts`,
            `import { fna0_0 } from '../features/area0/a0_0';\n\nexport function fnFlatNew(): number {\n    return fna0_0();\n}\n`
        );
    }
    commit(dir, `${name}: growth commit - add ${growthCount} more flat modules plus one new cross-boundary reach (flat -> features/area0 internals), for regression/history timing`);

    return dir;
}

// scale-medium: ~2000 modules, several dependency-structure shapes, a
// handful of cycles of different sizes - the task's own "fixture #2".
buildScaleFixture('scale-medium', { totalModules: 2000, cycleSizes: [2, 3, 5, 8, 12] });

// stress-10k-acyclic / stress-10k-cyclic: ~10000 modules each - the task's
// own "fixture #3", explicitly wanting both a cycle-free variant and a
// variant with cycles for stress/performance testing (not primarily a
// visual fixture - see npm run dev:cycle-map:large for that, which points
// at cycles-large instead).
buildScaleFixture('stress-10k-acyclic', { totalModules: 10000, cycleSizes: [] });
buildScaleFixture('stress-10k-cyclic', { totalModules: 10000, cycleSizes: [2, 2, 3, 5, 8, 13, 21, 34] });

console.log('Generated: scale-medium, stress-10k-acyclic, stress-10k-cyclic');
