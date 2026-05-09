import fs from 'node:fs';
import path from 'node:path';
import { debug } from '../logger';

const extensions = ['.ts', '.tsx', '.js', '.jsx'];

export function resolveImport(fromFile: string, specifier: string): string | null {
    // TODO:
    // support tsconfig paths / aliases
    if (!specifier.startsWith('.')) {
        debug('EXTERNAL SKIP:', specifier);
        return null;
    }

    const dir = path.dirname(fromFile);
    const base = path.resolve(dir, specifier);

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
