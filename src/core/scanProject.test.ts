import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanProject } from './scanProject';

describe('scanProject', () => {
    it('should include scan root in result', async () => {
        const projectRoot = path.join('nonexistent-project');
        const scanRoot = path.join(projectRoot, 'src');

        const result = await scanProject({
            projectRoot,
            scanRoot,
        });

        expect(result.root).toBe(path.resolve(scanRoot));
    });

    describe('includeTypeOnlyImports', () => {
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-scanproject-typeonly-'));
            fs.writeFileSync(path.join(root, 'a.ts'), `import type { B } from './b';\nexport type A = { b?: B };\n`);
            fs.writeFileSync(path.join(root, 'b.ts'), `import type { A } from './a';\nexport type B = { a?: A };\n`);
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
        });

        it('excludes a cycle that exists purely through type-only imports by default', async () => {
            const result = await scanProject({ projectRoot: root, scanRoot: root });

            let edgesCount = 0;
            for (const deps of result.graph.edges.values()) {
                edgesCount += deps.size;
            }

            expect(edgesCount).toBe(0);
        });

        it('includes it when includeTypeOnlyImports is true', async () => {
            const result = await scanProject({
                projectRoot: root,
                scanRoot: root,
                includeTypeOnlyImports: true,
            });

            let edgesCount = 0;
            for (const deps of result.graph.edges.values()) {
                edgesCount += deps.size;
            }

            expect(edgesCount).toBe(2);
        });
    });
});
