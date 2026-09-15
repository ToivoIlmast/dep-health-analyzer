// Shared helpers for generating test-projects/ fixtures. Not part of the
// analyzer itself - purely used by the one-off generator scripts under
// scripts/gen-*.mjs to build the external validation corpus.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd(), 'test-projects');

// baseDir defaults to the existing test-projects/ root for every current
// caller (none of them pass a second argument) - this is a pure additive
// extension, not a behavior change. Added so the large-scale corpus
// (scripts/gen-scale-*.mjs, test-projects-scale/) can reuse this exact same
// file-writing/git-commit machinery instead of a second, parallel toolkit,
// while still landing outside test-projects/ itself - see
// test-projects-scale/README.md for why that separation matters (keeping
// scripts/validate-test-projects.mjs's existing fixture-discovery loop,
// and `npm run test-projects:generate`'s existing runtime, exactly as fast
// as they already are).
export function projectDir(name, baseDir = ROOT) {
    return path.join(baseDir, name);
}

export function freshRepo(name, baseDir = ROOT) {
    const dir = projectDir(name, baseDir);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    sh(dir, 'git init -q');
    return dir;
}

export function write(dir, relPath, content) {
    const full = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
}

export function remove(dir, relPath) {
    fs.rmSync(path.join(dir, relPath), { force: true });
}

export function move(dir, fromRel, toRel) {
    const from = path.join(dir, fromRel);
    const to = path.join(dir, toRel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
}

export function sh(dir, cmd) {
    execSync(cmd, { cwd: dir, stdio: 'pipe' });
}

export function commit(dir, message) {
    sh(dir, 'git add -A');
    try {
        execSync(
            `git -c user.email="corpus@example.com" -c user.name="corpus-generator" commit -q -m "${message.replace(/"/g, '\\"')}"`,
            { cwd: dir, stdio: 'pipe' }
        );
    } catch {
        // nothing to commit - fine, some steps are config-only or no-ops
    }
}

export function writePackageJson(dir, fields) {
    write(dir, 'package.json', JSON.stringify(fields, null, 2) + '\n');
}

export function writeDepHealthConfig(dir, overrides = {}) {
    const base = {
        $schema: '../../src/app/config/config.schema.json',
        features: {
            regression: { enabled: true, history: { enabled: true, sampleSize: 10 } },
            scc: { enabled: true },
        },
    };
    write(dir, 'dep-health.config.json', JSON.stringify({ ...base, ...overrides }, null, 2) + '\n');
}

export function writeTsconfig(dir, overrides = {}) {
    const base = {
        compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'Bundler',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            declaration: false,
            outDir: 'dist',
        },
        include: ['src/**/*'],
    };
    write(
        dir,
        'tsconfig.json',
        JSON.stringify({ ...base, ...overrides, compilerOptions: { ...base.compilerOptions, ...(overrides.compilerOptions ?? {}) } }, null, 2) + '\n'
    );
}

export function gitignoreNodeModules(dir) {
    write(dir, '.gitignore', 'node_modules/\ndist/\n.DS_Store\n');
}

// Writes a plain linear DAG chain under src/<folder>/<prefix>0..N-1.ts,
// each module importing and calling the NEXT one (module i -> module i+1),
// the same shape/convention large-cycle-app's own ring/leaf modules and
// nightmare-app's module chain already use by hand. Generic and reusable
// (no cycle, no fixture-specific content) - added here rather than
// hand-writing the same loop again in every gen-*.mjs script that needs a
// chain of any size, including the large-scale corpus (gen-scale-*.mjs).
// extra(i) may return { imports: string[], calls: string[] } of additional
// lines for module i, for a caller that wants specific nodes along the
// chain to also reach outside it (e.g. into a shared/core module) -
// omitted entirely (not just empty) for the common case that doesn't need
// this, to keep the generated source exactly as small/plain as before.
export function writeChain(dir, folder, prefix, count, extra) {
    for (let i = 0; i < count; i++) {
        const hasNext = i + 1 < count;
        const extraLines = extra ? extra(i) : null;
        const importLines = [
            hasNext ? `import { fn${prefix}${i + 1} } from './${prefix}${i + 1}';` : null,
            ...(extraLines?.imports ?? []),
        ].filter(Boolean);
        const callParts = [String(i), hasNext ? `fn${prefix}${i + 1}()` : null, ...(extraLines?.calls ?? [])].filter(
            Boolean
        );
        const body = `export function fn${prefix}${i}(): number {\n    return ${callParts.join(' + ')};\n}\n`;
        write(dir, `src/${folder}/${prefix}${i}.ts`, importLines.length > 0 ? `${importLines.join('\n')}\n\n${body}` : body);
    }
}

// Closes a chain written by writeChain() into a ring/cycle: the LAST
// module (index count-1) gains one more import, back to module 0,
// completing module0 -> module1 -> ... -> module(count-1) -> module0. A
// separate step (not a writeChain option) because "is this a plain chain
// or a cycle" is a meaningful, deliberate choice at every call site, not
// a flag to thread through - matches how large-cycle-app's own generator
// wires its ring's closing edge as its own explicit statement.
export function closeRing(dir, folder, prefix, count) {
    const last = count - 1;
    write(
        dir,
        `src/${folder}/${prefix}${last}.ts`,
        `import { fn${prefix}0 } from './${prefix}0';\n\nexport function fn${prefix}${last}(): number {\n    return ${last} + fn${prefix}0();\n}\n`
    );
}
