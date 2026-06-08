import fs from 'node:fs';
import path from 'node:path';

export function copyAssets(reportDirectory: string): void {
    const source = path.resolve(__dirname, '../../../assets');
    const target = path.join(reportDirectory, 'assets');

    fs.mkdirSync(target, {
        recursive: true,
    });

    for (const file of fs.readdirSync(source)) {
        fs.copyFileSync(path.join(source, file), path.join(target, file));
    }
}
