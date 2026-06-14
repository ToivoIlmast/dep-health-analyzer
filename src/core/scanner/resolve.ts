import { debug } from '../logger/logger';
import fs from 'node:fs';
import path from 'node:path';
import { TsConfigPaths } from './types';

const extensions = ['.ts', '.tsx', '.js', '.jsx'];

function resolveFile(base: string): string | null {
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
