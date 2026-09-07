import { freshRepo, write, commit, writePackageJson, writeDepHealthConfig, writeTsconfig, gitignoreNodeModules } from './test-projects-toolkit.mjs';

// ---------------------------------------------------------------------------
// mts-cts - regression fixture for a real, previously-undetected false
// negative: `.mts`/`.cts` are TypeScript's per-file module-format overrides
// (used regardless of the package's own "type" field, e.g. one file that
// must stay pure ESM, or one that must stay CJS for a legacy interop shim,
// inside an otherwise uniform package) - a real, if less common, pattern in
// published TypeScript libraries. `resolve.ts` already maps a `.mjs`/`.cjs`
// specifier to a real `.mts`/`.cts` source file, but until that file was
// itself scanned as source (not just a resolution target), its own outgoing
// imports - including ones completing a real cycle - went undetected.
// ---------------------------------------------------------------------------
function genMtsCts() {
    const dir = freshRepo('mts-cts');
    writePackageJson(dir, { name: 'mts-cts', version: '1.0.0', private: true, type: 'module', devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir, { compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' } });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/core.ts', `export function core(): string {\n    return 'core';\n}\n`);
    write(dir, 'src/logger.ts', `export function log(msg: string): void {\n    console.log(msg);\n}\n`);
    commit(dir, 'baseline: plain .ts core and logger, no .mts/.cts yet');

    write(
        dir,
        'src/esmBoundary.mts',
        `// Forced to pure ESM output via the .mts extension, independent of the\n` +
            `// package's own "type" field - e.g. this module uses a pure-ESM-only\n` +
            `// dependency elsewhere in a real project. Written as .mts, imported\n` +
            `// through its nodenext output specifier (./core.js), same as any other\n` +
            `// relative import under "module": "NodeNext".\n` +
            `import { core } from './core.js';\n\n` +
            `export function esmOnly(): string {\n    return 'esm:' + core();\n}\n`
    );
    commit(dir, 'add src/esmBoundary.mts, a file forced to ESM output, depending on core.ts');

    write(
        dir,
        'src/cjsBoundary.cts',
        `// Forced to CJS output via the .cts extension - e.g. a legacy interop\n` +
            `// shim that must stay require()-able even in an otherwise ESM package.\n` +
            `import { core } from './core.js';\n\n` +
            `export function cjsOnly(): string {\n    return 'cjs:' + core();\n}\n`
    );
    commit(dir, 'add src/cjsBoundary.cts, a file forced to CJS output, depending on core.ts');

    write(
        dir,
        'src/core.ts',
        `import { esmOnly } from './esmBoundary.mjs';\n\n` +
            `export function core(): string {\n    void esmOnly;\n    return 'core';\n}\n`
    );
    commit(dir, 'introduce a real cycle: core.ts -> esmBoundary.mts -> core.ts (via a .mjs specifier)');

    write(dir, 'src/core.ts', `export function core(): string {\n    return 'core';\n}\n`);
    commit(dir, 'fix: core.ts no longer depends on esmBoundary.mts, cycle removed');

    write(
        dir,
        'src/core.ts',
        `import { cjsOnly } from './cjsBoundary.cjs';\n\n` +
            `export function core(): string {\n    void cjsOnly;\n    return 'core';\n}\n`
    );
    commit(dir, 'introduce a second real cycle: core.ts -> cjsBoundary.cts -> core.ts (via a .cjs specifier) - left in place');

    write(
        dir,
        'src/index.ts',
        `import { esmOnly } from './esmBoundary.mjs';\n` +
            `import { cjsOnly } from './cjsBoundary.cjs';\n` +
            `import { log } from './logger.js';\n\n` +
            `log(esmOnly());\n` +
            `log(cjsOnly());\n`
    );
    commit(dir, 'add src/index.ts, an entry point wiring both boundary modules together');

    return dir;
}

genMtsCts();
console.log('Generated: mts-cts');
