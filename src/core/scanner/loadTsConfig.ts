import fs from 'node:fs';
import path from 'node:path';
import { TsConfigPaths } from './types';

export function loadTsConfig(root: string): TsConfigPaths | null {
    const tsconfigPath = path.join(root, 'tsconfig.json');

    if (!fs.existsSync(tsconfigPath)) {
        return null;
    }

    try {
        const json = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

        return {
            baseDir: path.dirname(tsconfigPath),
            baseUrl: json.compilerOptions?.baseUrl,
            paths: json.compilerOptions?.paths ?? {},
        };
    } catch {
        return null;
    }
}
