import { freshRepo, write, commit, writePackageJson, writeDepHealthConfig, gitignoreNodeModules } from './test-projects-toolkit.mjs';

function packageJsonFor(name, deps = {}) {
    return { name: `@corpus/${name}`, version: '1.0.0', private: true, main: 'src/index.ts', dependencies: deps };
}

function packageTsconfig(refs = []) {
    return {
        extends: '../../tsconfig.base.json',
        compilerOptions: { baseUrl: '.', outDir: 'dist' },
        include: ['src/**/*'],
        references: refs.map((r) => ({ path: `../${r}` })),
    };
}

// ---------------------------------------------------------------------------
// monorepo-npm
// ---------------------------------------------------------------------------
function genMonorepoNpm() {
    const dir = freshRepo('monorepo-npm');
    writePackageJson(dir, { name: 'monorepo-npm', version: '1.0.0', private: true, workspaces: ['packages/*'] });
    write(dir, 'tsconfig.base.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, composite: true } }, null, 2) + '\n');
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'packages/shared/package.json', JSON.stringify(packageJsonFor('shared'), null, 2) + '\n');
    write(dir, 'packages/shared/tsconfig.json', JSON.stringify(packageTsconfig(), null, 2) + '\n');
    write(dir, 'packages/shared/src/types.ts', `export interface Id {\n    value: number;\n}\n`);
    write(dir, 'packages/shared/src/index.ts', `export * from './types';\n`);
    commit(dir, 'baseline: npm workspaces root + packages/shared');

    write(dir, 'packages/core/package.json', JSON.stringify(packageJsonFor('core', { '@corpus/shared': '*' }), null, 2) + '\n');
    write(dir, 'packages/core/tsconfig.json', JSON.stringify(packageTsconfig(['shared']), null, 2) + '\n');
    write(dir, 'packages/core/src/engine.ts', `import type { Id } from '@corpus/shared';\n\nexport function process(id: Id): string {\n    return 'processed-' + id.value;\n}\n`);
    write(dir, 'packages/core/src/index.ts', `export * from './engine';\n`);
    commit(dir, 'add packages/core, depending on packages/shared via workspace alias');

    write(dir, 'packages/ui/package.json', JSON.stringify(packageJsonFor('ui', { '@corpus/core': '*' }), null, 2) + '\n');
    write(dir, 'packages/ui/tsconfig.json', JSON.stringify(packageTsconfig(['core']), null, 2) + '\n');
    write(dir, 'packages/ui/src/Widget.ts', `import { process } from '@corpus/core';\n\nexport function renderWidget(id: number): string {\n    return process({ value: id });\n}\n`);
    write(dir, 'packages/ui/src/index.ts', `export * from './Widget';\n`);
    commit(dir, 'add packages/ui, depending on packages/core');

    write(dir, 'packages/cli/package.json', JSON.stringify(packageJsonFor('cli', { '@corpus/core': '*', '@corpus/ui': '*' }), null, 2) + '\n');
    write(dir, 'packages/cli/tsconfig.json', JSON.stringify(packageTsconfig(['core', 'ui']), null, 2) + '\n');
    write(dir, 'packages/cli/src/index.ts', `import { process } from '@corpus/core';\nimport { renderWidget } from '@corpus/ui';\n\nexport function main() {\n    console.log(renderWidget(1), process({ value: 2 }));\n}\n`);
    commit(dir, 'add packages/cli depending on both core and ui (fan-in across packages)');

    return dir;
}

// ---------------------------------------------------------------------------
// monorepo-pnpm
// ---------------------------------------------------------------------------
function genMonorepoPnpm() {
    const dir = freshRepo('monorepo-pnpm');
    writePackageJson(dir, { name: 'monorepo-pnpm', version: '1.0.0', private: true });
    write(dir, 'pnpm-workspace.yaml', `packages:\n  - 'packages/*'\n`);
    write(dir, 'tsconfig.base.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true, composite: true } }, null, 2) + '\n');
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'packages/shared/package.json', JSON.stringify(packageJsonFor('shared'), null, 2) + '\n');
    write(dir, 'packages/shared/tsconfig.json', JSON.stringify(packageTsconfig(), null, 2) + '\n');
    write(dir, 'packages/shared/src/types.ts', `export interface Id {\n    value: number;\n}\n`);
    write(dir, 'packages/shared/src/index.ts', `export * from './types';\n`);
    commit(dir, 'baseline: pnpm workspace root + packages/shared');

    write(dir, 'packages/core/package.json', JSON.stringify(packageJsonFor('core', { '@corpus/shared': 'workspace:*' }), null, 2) + '\n');
    write(dir, 'packages/core/tsconfig.json', JSON.stringify(packageTsconfig(['shared']), null, 2) + '\n');
    write(dir, 'packages/core/src/engine.ts', `import type { Id } from '@corpus/shared';\n\nexport function process(id: Id): string {\n    return 'processed-' + id.value;\n}\n`);
    write(dir, 'packages/core/src/index.ts', `export * from './engine';\n`);
    commit(dir, 'add packages/core using pnpm workspace:* protocol dependency on shared');

    write(dir, 'packages/cli/package.json', JSON.stringify(packageJsonFor('cli', { '@corpus/core': 'workspace:*' }), null, 2) + '\n');
    write(dir, 'packages/cli/tsconfig.json', JSON.stringify(packageTsconfig(['core']), null, 2) + '\n');
    write(dir, 'packages/cli/src/index.ts', `import { process } from '@corpus/core';\n\nexport function main() {\n    console.log(process({ value: 1 }));\n}\n`);
    commit(dir, 'add packages/cli depending on packages/core');

    return dir;
}

genMonorepoNpm();
genMonorepoPnpm();
console.log('Generated: monorepo-npm, monorepo-pnpm');
