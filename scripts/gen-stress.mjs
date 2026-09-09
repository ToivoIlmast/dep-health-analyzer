import { freshRepo, write, commit, writePackageJson, writeDepHealthConfig, writeTsconfig, gitignoreNodeModules } from './test-projects-toolkit.mjs';

// ---------------------------------------------------------------------------
// cyclic-app - cycles are deliberately introduced AND removed across history
// ---------------------------------------------------------------------------
function genCyclicApp() {
    const dir = freshRepo('cyclic-app');
    writePackageJson(dir, { name: 'cyclic-app', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/a.ts', `export function a(): string {\n    return 'a';\n}\n`);
    write(dir, 'src/b.ts', `export function b(): string {\n    return 'b';\n}\n`);
    write(dir, 'src/c.ts', `export function c(): string {\n    return 'c';\n}\n`);
    commit(dir, 'baseline: three independent modules, no cycles');

    write(dir, 'src/a.ts', `import { b } from './b';\n\nexport function a(): string {\n    return 'a' + b();\n}\n`);
    write(dir, 'src/b.ts', `import { c } from './c';\n\nexport function b(): string {\n    return 'b' + c();\n}\n`);
    write(dir, 'src/c.ts', `import { a } from './a';\n\nexport function c(): string {\n    return 'c' + a();\n}\n`);
    commit(dir, 'introduce a 3-node cycle: a -> b -> c -> a');

    write(dir, 'src/c.ts', `export function c(): string {\n    return 'c';\n}\n`);
    write(dir, 'src/b.ts', `import { c } from './c';\n\nexport function b(): string {\n    return 'b' + c();\n}\n`);
    write(dir, 'src/a.ts', `import { b } from './b';\n\nexport function a(): string {\n    return 'a' + b();\n}\n`);
    commit(dir, 'remove the 3-node cycle by breaking the c -> a edge (a -> b -> c remains, one-way)');

    write(dir, 'src/d.ts', `export function d(): string {\n    return 'd';\n}\n`);
    write(dir, 'src/e.ts', `import { d } from './d';\n\nexport function e(): string {\n    return 'e' + d();\n}\n`);
    commit(dir, 'add d.ts + e.ts, no cycle yet');

    write(dir, 'src/d.ts', `import { e } from './e';\n\nexport function d(): string {\n    return 'd' + e();\n}\n`);
    commit(dir, 'introduce a direct 2-node cycle: d <-> e');

    write(dir, 'src/d.ts', `export function d(): string {\n    return 'd';\n}\n`);
    commit(dir, 'remove the d <-> e cycle');

    write(dir, 'src/features/checkout/checkout.ts', `export function checkout(): string {\n    return 'checkout';\n}\n`);
    write(dir, 'src/shared/pricing.ts', `export function price(): number {\n    return 10;\n}\n`);
    commit(dir, 'add features/checkout and shared/pricing, no relation yet');

    write(dir, 'src/shared/pricing.ts', `import { checkout } from '../features/checkout/checkout';\n\nexport function price(): number {\n    void checkout;\n    return 10;\n}\n`);
    write(dir, 'src/features/checkout/checkout.ts', `import { price } from '../../shared/pricing';\n\nexport function checkout(): string {\n    return 'checkout:' + price();\n}\n`);
    commit(dir, 'introduce a feature -> shared -> feature cycle (a shared module reaching back into a feature)');

    write(dir, 'src/shared/pricing.ts', `export function price(): number {\n    return 10;\n}\n`);
    commit(dir, 'fix: shared/pricing no longer depends on features/checkout, cycle removed');

    write(dir, 'src/types/node.ts', `import type { Edge } from './edge';\n\nexport interface Node {\n    edges: Edge[];\n}\n`);
    write(dir, 'src/types/edge.ts', `import type { Node } from './node';\n\nexport interface Edge {\n    target: Node;\n}\n`);
    commit(dir, 'add a TypeScript type-only cycle (types/node <-> types/edge) - stays for validation');

    return dir;
}

// ---------------------------------------------------------------------------
// nightmare-app - extreme synthetic stress test; the name describes the
// structural pattern only, not a claim about what the analyzer should say
// ---------------------------------------------------------------------------
function genNightmareApp() {
    const dir = freshRepo('nightmare-app');
    writePackageJson(dir, { name: 'nightmare-app', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    const N = 18;
    for (let i = 0; i < N; i++) {
        write(dir, `src/module${i}.ts`, `export function fn${i}(): number {\n    return ${i};\n}\n`);
    }
    commit(dir, `baseline: ${N} independent modules`);

    // A big ring: module0 -> module1 -> ... -> module(N-1) -> module0
    for (let i = 0; i < N; i++) {
        const next = (i + 1) % N;
        write(dir, `src/module${i}.ts`, `import { fn${next} } from './module${next}';\n\nexport function fn${i}(): number {\n    return ${i} + fn${next}();\n}\n`);
    }
    commit(dir, `wire up a ${N}-module ring cycle (module0 -> module1 -> ... -> module0)`);

    // Add a shared "god module" that many others reach into, and that reaches back
    write(dir, 'src/shared/hub.ts', `export const hub = { calls: 0 };\n\nexport function ping(): void {\n    hub.calls += 1;\n}\n`);
    for (let i = 0; i < 8; i++) {
        const content = `import { ping } from './shared/hub';\nimport { fn${(i + 1) % N} } from './module${(i + 1) % N}';\n\nping();\n\nexport function fn${i}(): number {\n    return ${i} + fn${(i + 1) % N}();\n}\n`;
        write(dir, `src/module${i}.ts`, content);
    }
    write(dir, 'src/shared/hub.ts', `import { fn0 } from '../module0';\n\nexport const hub = { calls: 0 };\n\nexport function ping(): void {\n    hub.calls += 1;\n    void fn0;\n}\n`);
    commit(dir, 'add a shared "hub" module reached by 8 modules, which itself reaches back into module0 (mutual dependency concentration)');

    // Deep chain
    for (let i = 0; i < 10; i++) {
        const dirsDeep = Array.from({ length: i + 1 }, (_, j) => `level${j}`).join('/');
        const prevImport = i === 0 ? null : `../level${i - 1 >= 0 ? '' : ''}`;
        write(dir, `src/deep/${dirsDeep}/node.ts`, i === 0
            ? `export function deep0(): number {\n    return 0;\n}\n`
            : `import { deep${i - 1} } from '../node';\n\nexport function deep${i}(): number {\n    return ${i} + deep${i - 1}();\n}\n`);
        void prevImport;
    }
    commit(dir, 'add a 10-level-deep dependency chain under src/deep/');

    // Cross-directory concentration: many files across many folders reach into shared/hub and each other
    for (let i = 0; i < 6; i++) {
        write(dir, `src/areaA/a${i}.ts`, `import { ping } from '../shared/hub';\nimport { b${i} } from '../areaB/b${(i + 1) % 6}';\n\nping();\n\nexport function a${i}(): number {\n    return b${i}();\n}\n`);
        write(dir, `src/areaB/b${i}.ts`, `import { ping } from '../shared/hub';\n\nping();\n\nexport function b${i}(): number {\n    return ${i};\n}\n`);
    }
    commit(dir, 'add areaA/areaB with cross-directory fan-out into each other and shared/hub');

    // A fix pass: break part of the ring to reduce (not eliminate) entanglement
    write(dir, 'src/module0.ts', `import { ping } from './shared/hub';\n\nping();\n\nexport function fn0(): number {\n    return 0;\n}\n`);
    commit(dir, 'partial fix: module0 no longer depends on module1, breaking the 18-module ring entirely (the remaining max SCC of 2 is the separate shared/hub <-> module0 dependency)');

    // Then more findings added afterward
    for (let i = 10; i < 14; i++) {
        write(dir, `src/module${i}.ts`, `import { fn${i - 1} } from './module${i - 1}';\nimport { ping } from './shared/hub';\n\nping();\n\nexport function fn${i}(): number {\n    return ${i} + fn${i - 1}();\n}\n`);
        commit(dir, `add module${i}, extending the chain further and touching the shared hub again`);
    }

    return dir;
}

// ---------------------------------------------------------------------------
// large-cycle-app - a focused, static (not history-walking) fixture for
// exactly the shapes cyclic-app/nightmare-app don't leave standing at HEAD:
// a genuinely large SCC, a cycle member with many real external
// dependencies, and two independent cycles reachable from one shared
// caller. nightmare-app's own big ring is deliberately broken by its
// "partial fix" commit (see its README) - it exists to stress-test
// regression/history's behavior AS the graph is cleaned up over time, not
// to leave a large SCC sitting at HEAD for a static graph-visualization
// check to find.
// ---------------------------------------------------------------------------
function genLargeCycleApp() {
    const dir = freshRepo('large-cycle-app');
    writePackageJson(dir, { name: 'large-cycle-app', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    const LEAF_COUNT = 6;
    for (let i = 0; i < LEAF_COUNT; i++) {
        write(dir, `src/leaf/leaf${i}.ts`, `export function leaf${i}(): number {\n    return ${i};\n}\n`);
    }
    commit(dir, `baseline: ${LEAF_COUNT} independent leaf modules`);

    // A 7-node ring: ring0 -> ring1 -> ... -> ring6 -> ring0 - large enough
    // to be a meaningfully "big" SCC (the rest of the corpus tops out at 3
    // nodes - same-directory-complex), small enough to stay a minimal,
    // focused fixture rather than nightmare-app's much larger stress shape.
    const RING_SIZE = 7;
    for (let i = 0; i < RING_SIZE; i++) {
        const next = (i + 1) % RING_SIZE;
        write(dir, `src/ring/ring${i}.ts`, `import { fn${next} } from './ring${next}';\n\nexport function fn${i}(): number {\n    return ${i} + fn${next}();\n}\n`);
    }
    commit(dir, `wire up a ${RING_SIZE}-module ring cycle (ring0 -> ring1 -> ... -> ring0) - one large SCC`);

    // ring0 additionally depends on all 6 leaf modules, on top of its one
    // cycle-internal dependency (ring1) - a cycle member with a large
    // number of real external dependencies (Ce = 7: 6 leaves + 1 cycle
    // partner), not just the 1-2 external deps the corpus's other cycle
    // fixtures (flat-app, messy-app) already cover.
    const leafImports = Array.from({ length: LEAF_COUNT }, (_, i) => `import { leaf${i} } from '../leaf/leaf${i}';`).join('\n');
    const leafCalls = Array.from({ length: LEAF_COUNT }, (_, i) => `leaf${i}()`).join(' + ');
    write(
        dir,
        'src/ring/ring0.ts',
        `${leafImports}\nimport { fn1 } from './ring1';\n\nexport function fn0(): number {\n    return fn1() + ${leafCalls};\n}\n`
    );
    commit(dir, 'ring0 (a member of the 7-node cycle) also depends on all 6 leaf modules - a cycle member with many real external dependencies');

    // A second, small, independent 2-node cycle - structurally separate
    // from the ring (no edge connects the two SCCs to each other), but
    // both are reached from one shared entry.ts, so this fixture also
    // covers two related (not just arbitrarily disconnected) cycles
    // coexisting in the same graph.
    write(dir, 'src/pair/left.ts', `import { right } from './right';\n\nexport function left(): string {\n    return 'left' + right();\n}\n`);
    write(dir, 'src/pair/right.ts', `import { left } from './left';\n\nexport function right(): string {\n    return 'right';\n}\n`);
    write(
        dir,
        'src/entry.ts',
        `import { fn0 } from './ring/ring0';\nimport { left } from './pair/left';\n\nexport function run(): string {\n    return fn0() + left();\n}\n`
    );
    commit(dir, 'add a second, independent 2-node cycle (pair/left <-> pair/right); both cycles are reachable from one shared entry.ts');

    return dir;
}

genCyclicApp();
genNightmareApp();
genLargeCycleApp();
console.log('Generated: cyclic-app, nightmare-app, large-cycle-app');
