// Shared helpers for generating test-projects/ fixtures. Not part of the
// analyzer itself - purely used by the one-off generator scripts under
// scripts/gen-*.mjs to build the external validation corpus.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd(), 'test-projects');

export function projectDir(name) {
    return path.join(ROOT, name);
}

export function freshRepo(name) {
    const dir = projectDir(name);
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
