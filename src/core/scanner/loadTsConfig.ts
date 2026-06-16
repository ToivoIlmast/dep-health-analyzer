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

function readTsConfig(configPath: string): TsConfigJsonType {
    const json = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!json.extends) {
        return json;
    }

    const parentPath = path.resolve(path.dirname(configPath), json.extends);

    const normalizedParent = parentPath.endsWith('.json') ? parentPath : `${parentPath}.json`;

    const parent = readTsConfig(normalizedParent);

    return {
        ...parent,
        ...json,
        compilerOptions: {
            ...parent.compilerOptions,
            ...json.compilerOptions,
        },
    };
}

export function loadTsConfig(root: string): TsConfigPaths | null {
    const tsconfigPath = path.join(root, 'tsconfig.json');

    if (!fs.existsSync(tsconfigPath)) {
        return null;
    }

    try {
        const json = readTsConfig(tsconfigPath);

        return {
            baseDir: path.dirname(tsconfigPath),
            baseUrl: json.compilerOptions?.baseUrl,
            paths: json.compilerOptions?.paths ?? {},
        };
    } catch {
        return null;
    }
}
