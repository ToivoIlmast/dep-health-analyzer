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

    it('should normalize equivalent dependency paths across different roots', () => {
        const current = createScanResult(
            [
                [
                    '/workspace/project/src/features/users/UserService.ts',
                    ['/workspace/project/src/features/users/UserRepository.ts'],
                ],
            ],
            '/workspace/project/src'
        );

        const baseline = createScanResult(
            [
                [
                    '/tmp/worktree/project/src/features/users/UserService.ts',
                    ['/tmp/worktree/project/src/features/users/UserRepository.ts'],
                ],
            ],
            '/tmp/worktree/project/src'
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

    it('should detect differences when dependencies are normalized against different roots', () => {
        const current = createScanResult(
            [
                [
                    '/workspace/project/src/features/users/UserService.ts',
                    ['/workspace/project/src/features/users/UserRepository.ts'],
                ],
            ],
            '/workspace/project'
        );

        const baseline = createScanResult(
            [
                [
                    '/tmp/worktree/project/src/features/users/UserService.ts',
                    ['/tmp/worktree/project/src/features/users/UserRepository.ts'],
                ],
            ],
            '/tmp/worktree/project/src'
        );

        const result = calculateDependencyDelta({
            current,
            baseline,
        });

        expect(result.added.length).toBeGreaterThan(0);
        expect(result.removed.length).toBeGreaterThan(0);
    });

    it('should not match dependencies normalized against different roots', () => {
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
            '/project/.dep-health-analyzer/worktree/demo-project/src' // <--- it is broken on purpose
        );

        const result = calculateDependencyDelta({
            current,
            baseline,
        });

        expect(result).not.toEqual({
            added: [],
            removed: [],
        });
    });
});
