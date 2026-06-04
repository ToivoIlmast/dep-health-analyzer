import path from 'node:path';
import { ScanResult } from 'core/graph/types';
import { calculateDependencyDelta } from './dependencyDelta';

describe('calculateDependencyDelta', () => {
    const createScanResult = (edges: Array<[string, string[]]>, root: string): ScanResult => ({
        graph: {
            nodes: new Set(edges.flatMap(([from, deps]) => [from, ...deps])),
            edges: new Map(edges.map(([from, deps]) => [from, new Set(deps)])),
        },
        scannedFiles: 0,
        root,
    });

    const currentRoot = process.cwd();
    const baselineRoot = path.resolve('.dep-health-analyzer');

    it('should return empty delta for identical graphs', () => {
        const current = createScanResult(
            [[`${currentRoot}/src/a.ts`, [`${currentRoot}/src/b.ts`]]],
            currentRoot
        );

        const baseline = createScanResult(
            [[`${baselineRoot}/src/a.ts`, [`${baselineRoot}/src/b.ts`]]],
            baselineRoot
        );

        const result = calculateDependencyDelta({
            current,
            baseline,
        });

        expect(result).toEqual({
            added: [],
            removed: [],
        });
    });

    it('should detect added dependency', () => {
        const current = createScanResult(
            [[`${currentRoot}/src/a.ts`, [`${currentRoot}/src/b.ts`]]],
            currentRoot
        );

        const baseline = createScanResult([], baselineRoot);

        const result = calculateDependencyDelta({
            current,
            baseline,
        });

        expect(result.added).toEqual([
            {
                from: 'src/a.ts',
                to: 'src/b.ts',
            },
        ]);

        expect(result.removed).toEqual([]);
    });

    it('should detect removed dependency', () => {
        const current = createScanResult([], currentRoot);

        const baseline = createScanResult(
            [[`${baselineRoot}/src/a.ts`, [`${baselineRoot}/src/b.ts`]]],
            baselineRoot
        );

        const result = calculateDependencyDelta({
            current,
            baseline,
        });

        expect(result.removed).toEqual([
            {
                from: 'src/a.ts',
                to: 'src/b.ts',
            },
        ]);

        expect(result.added).toEqual([]);
    });

    it('should detect added and removed dependencies', () => {
        const current = createScanResult(
            [[`${currentRoot}/src/a.ts`, [`${currentRoot}/src/c.ts`]]],
            currentRoot
        );

        const baseline = createScanResult(
            [[`${baselineRoot}/src/a.ts`, [`${baselineRoot}/src/b.ts`]]],
            baselineRoot
        );

        const result = calculateDependencyDelta({
            current,
            baseline,
        });

        expect(result).toEqual({
            added: [
                {
                    from: 'src/a.ts',
                    to: 'src/c.ts',
                },
            ],
            removed: [
                {
                    from: 'src/a.ts',
                    to: 'src/b.ts',
                },
            ],
        });
    });

    it('should treat worktree and current project paths as the same file', () => {
        const current = createScanResult(
            [
                [
                    '/project/demo-project/src/app/bootstrap.ts',
                    ['/project/demo-project/src/features/users/UserController.ts'],
                ],
            ],
            '/project/demo-project'
        );

        const baseline = createScanResult(
            [
                [
                    '/project/.dep-health-analyzer/worktree/demo-project/src/app/bootstrap.ts',
                    [
                        '/project/.dep-health-analyzer/worktree/demo-project/src/features/users/UserController.ts',
                    ],
                ],
            ],
            '/project/.dep-health-analyzer/worktree/demo-project'
        );

        const result = calculateDependencyDelta({
            current,
            baseline,
        });

        expect(result).toEqual({
            added: [],
            removed: [],
        });
    });
});
