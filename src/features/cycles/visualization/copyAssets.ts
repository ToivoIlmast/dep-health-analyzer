import fs from 'node:fs';
import path from 'node:path';

export function copyAssets(reportDirectory: string): void {
    const candidates = [
        path.join(__dirname, '../../../assets'),
        path.resolve(process.cwd(), 'static/assets'),
    ];
    const source = candidates.find(fs.existsSync);

    if (!source) {
        throw new Error(`Assets directory not found. Tried:\n${candidates.join('\n')}`);
    }

    const target = path.join(reportDirectory, 'assets');

    fs.mkdirSync(target, {
        recursive: true,
    });

    for (const file of fs.readdirSync(source)) {
        fs.copyFileSync(path.join(source, file), path.join(target, file));
    }
}
