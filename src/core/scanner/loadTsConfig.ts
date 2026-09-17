import fs from 'node:fs';
import path from 'node:path';
import { TsConfigPaths } from './types';

type TsConfigJsonType = {
    extends?: string;
    compilerOptions?: {
        baseUrl?: string;
        paths?: Record<string, string[]>;
    };
};

/**
 * A relative/absolute `extends` target resolves exactly as before -
 * relative to the extending file, `.json` appended if not already present.
 * A bare specifier (e.g. `@company/tsconfig/base`) is a package-style
 * reference and is resolved with Node's own module resolution
 * (require.resolve), starting the node_modules search from the extending
 * file's directory - the same real resolution TypeScript itself documents
 * for `extends`, and not a new resolution mechanism of its own. Throws
 * (MODULE_NOT_FOUND, or a missing relative file) when the target can't be
 * found - callers decide what "can't be found" means for them.
 */
function resolveExtendsTarget(configPath: string, specifier: string): string {
    const dir = path.dirname(configPath);

    if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
        const resolved = path.resolve(dir, specifier);

        return resolved.endsWith('.json') ? resolved : `${resolved}.json`;
    }

    return require.resolve(specifier, { paths: [dir] });
}

type ReadTsConfigResult = {
    json: TsConfigJsonType;
    // Set to the specifier that failed the moment any ancestor's `extends`
    // couldn't be resolved or read - the failure is swallowed right here
    // rather than thrown, so it can never wipe out a DESCENDANT config
    // (including the original main tsconfig.json) that was otherwise fine.
    unresolvedExtends?: string;
};

function readTsConfig(configPath: string): ReadTsConfigResult {
    const json = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!json.extends) {
        return { json };
    }

    let parent: ReadTsConfigResult;

    try {
        const parentPath = resolveExtendsTarget(configPath, json.extends);

        parent = readTsConfig(parentPath);
    } catch {
        // Parent unresolved/unreadable: this config's OWN content is still
        // good and must survive - fall back to it alone instead of letting
        // the exception propagate and discard it too.
        return { json, unresolvedExtends: json.extends };
    }

    return {
        json: {
            ...parent.json,
            ...json,
            compilerOptions: {
                ...parent.json.compilerOptions,
                ...json.compilerOptions,
            },
        },
        unresolvedExtends: parent.unresolvedExtends,
    };
}

export function loadTsConfig(root: string): TsConfigPaths | null {
    const tsconfigPath = path.join(root, 'tsconfig.json');

    if (!fs.existsSync(tsconfigPath)) {
        return null;
    }

    try {
        const { json, unresolvedExtends } = readTsConfig(tsconfigPath);

        if (unresolvedExtends) {
            console.warn(
                `Warning: tsconfig "extends" could not be resolved (${unresolvedExtends}) - continuing with tsconfig.json's own compilerOptions only.`
            );
        }

        return {
            baseDir: path.dirname(tsconfigPath),
            baseUrl: json.compilerOptions?.baseUrl,
            paths: json.compilerOptions?.paths ?? {},
        };
    } catch {
        return null;
    }
}
