import fg from 'fast-glob';
import path from 'node:path';

export async function discoverFiles(root: string): Promise<string[]> {
    const files = await fg(['**/*.{js,jsx,ts,tsx}'], {
        cwd: root,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
        dot: false,
    });

    return files.map((file) => path.normalize(file));
}
