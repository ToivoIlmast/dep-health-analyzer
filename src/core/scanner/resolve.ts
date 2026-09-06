import { debug } from '../logger/logger';
import fs from 'node:fs';
import path from 'node:path';
import { TsConfigPaths } from './types';

const extensions = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * TypeScript's "nodenext"/"node16" module resolution requires relative
 * ESM imports to name the *compiled output* extension, not the source
 * file on disk - `import { x } from './util.js'` legitimately refers to
 * `./util.ts`. Maps each such output extension to the source extension(s)
 * that could produce it, checked before generic extension-appending so a
 * project that genuinely has a same-named real `.js`/`.jsx`/etc. file
 * (already handled by the exact-match check above this) isn't affected.
 */
const SOURCE_EXTENSIONS_FOR_OUTPUT_EXTENSION: Record<string, string[]> = {
    '.js': ['.ts', '.tsx'],
    '.jsx': ['.tsx'],
    '.mjs': ['.mts'],
    '.cjs': ['.cts'],
};

function resolveOutputExtensionSpecifier(base: string): string | null {
    const outputExt = path.extname(base);
    const sourceExtensions = SOURCE_EXTENSIONS_FOR_OUTPUT_EXTENSION[outputExt];

    if (!sourceExtensions) {
        return null;
    }

    const withoutExt = base.slice(0, -outputExt.length);

    for (const sourceExt of sourceExtensions) {
        const candidate = `${withoutExt}${sourceExt}`;

        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return path.normalize(candidate);
        }
    }

    return null;
}

function resolveFile(base: string): string | null {
    if (fs.existsSync(base) && fs.statSync(base).isFile()) {
        return path.normalize(base);
    }

    const outputExtensionMatch = resolveOutputExtensionSpecifier(base);

    if (outputExtensionMatch) {
        return outputExtensionMatch;
    }

    for (const ext of extensions) {
        const candidate = `${base}${ext}`;

        if (fs.existsSync(candidate)) {
            return path.normalize(candidate);
        }
    }

    for (const ext of extensions) {
        const candidate = path.join(base, `index${ext}`);

        if (fs.existsSync(candidate)) {
            return path.normalize(candidate);
        }
    }

    return null;
}

function resolveAlias(specifier: string, tsconfig: TsConfigPaths | null): string | null {
    if (!tsconfig) {
        return null;
    }

    const baseUrl = tsconfig.baseUrl ?? '.';

    for (const [alias, targets] of Object.entries(tsconfig.paths)) {
        const hasWildcard = alias.endsWith('/*');
        const aliasPrefix = hasWildcard ? alias.slice(0, -2) : alias;

        if (hasWildcard) {
            if (!specifier.startsWith(`${aliasPrefix}/`)) {
                continue;
            }

            const remainder = specifier.slice(aliasPrefix.length + 1);

            for (const target of targets) {
                const targetPrefix = target.endsWith('/*') ? target.slice(0, -2) : target;

                const base = path.resolve(tsconfig.baseDir, baseUrl, targetPrefix, remainder);

                const resolved = resolveFile(base);

                if (resolved) {
                    return resolved;
                }
            }
        } else {
            if (specifier !== alias) {
                continue;
            }

            for (const target of targets) {
                const base = path.resolve(tsconfig.baseDir, baseUrl, target);

                const resolved = resolveFile(base);

                if (resolved) {
                    return resolved;
                }
            }
        }
    }

    return null;
}

type ResolveImportType = {
    fromFile: string;
    specifier: string;
    tsconfig?: TsConfigPaths | null;
};

export function resolveImport(args: ResolveImportType): string | null {
    const { fromFile, specifier, tsconfig = null } = args;
    if (specifier.startsWith('.')) {
        const dir = path.dirname(fromFile);
        const base = path.resolve(dir, specifier);

        return resolveFile(base);
    }

    const aliasResolved = resolveAlias(specifier, tsconfig);

    if (aliasResolved) {
        return aliasResolved;
    }

    debug('EXTERNAL SKIP:', specifier);

    return null;
}
