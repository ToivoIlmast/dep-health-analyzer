// fast-glob's own README is explicit: "results are returned in **arbitrary
// order**" - not a coincidence of this particular filesystem, a documented
// contract. discoverFiles() must not pass that arbitrary order straight
// through, since everything downstream (scanProject's node/edge insertion
// order, findSCCs' Kosaraju traversal over graph.edges.keys(), SCC ids,
// colours, "SCC #N") derives from it (F20, AUDIT_v0.11.0.md).
//
// A real (non-mocked) fast-glob call against a real temp directory can't
// reliably reproduce "arbitrary order" on demand in a test - the whole
// point is it's unspecified, not deterministic-but-different each run. So
// this file mocks fast-glob directly to hand back a deliberately
// non-sorted array, proving discoverFiles() normalizes it regardless of
// what the underlying traversal returned. It's a separate file from
// discover.test.ts (which needs the REAL fast-glob against real temp
// directories for everything else) specifically so this file-level mock
// doesn't disable that real behavior for every other discovery test.
import path from 'node:path';

jest.mock('fast-glob', () => jest.fn());

import fg from 'fast-glob';
import { discoverFiles } from './discover';

const mockedFg = fg as unknown as jest.Mock;

describe('discoverFiles sort order (F20)', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('returns files in sorted order even when the underlying glob returns them in reverse order', async () => {
        mockedFg.mockResolvedValue([
            '/project/src/z.ts',
            '/project/src/m.ts',
            '/project/src/a.ts',
        ]);

        const result = await discoverFiles('/project');

        expect(result).toEqual([
            path.normalize('/project/src/a.ts'),
            path.normalize('/project/src/m.ts'),
            path.normalize('/project/src/z.ts'),
        ]);
    });

    it('returns files in sorted order when the underlying glob returns them in an arbitrary, non-alphabetical order', async () => {
        mockedFg.mockResolvedValue([
            '/project/src/m.ts',
            '/project/src/a.ts',
            '/project/src/z.ts',
            '/project/src/b.ts',
        ]);

        const result = await discoverFiles('/project');

        expect(result).toEqual([
            path.normalize('/project/src/a.ts'),
            path.normalize('/project/src/b.ts'),
            path.normalize('/project/src/m.ts'),
            path.normalize('/project/src/z.ts'),
        ]);
    });

    it('produces the identical array (deep equal, in order) across repeated calls, regardless of the order the underlying glob happens to return', async () => {
        mockedFg.mockResolvedValueOnce(['/project/src/z.ts', '/project/src/a.ts']);
        mockedFg.mockResolvedValueOnce(['/project/src/a.ts', '/project/src/z.ts']);

        const first = await discoverFiles('/project');
        const second = await discoverFiles('/project');

        expect(first).toEqual(second);
    });
});
