import path from 'node:path';

// report.ts imports the ESM-only `chalk` (confirmed directly: importing it
// unmocked under Jest fails with "Cannot use import statement outside a
// module", the same constraint documented for F2/F1's own real-scanner
// tests). Mocking chalk itself (not the whole report module) lets this
// file exercise printMetricsSummary's real sorting/formatting logic while
// keeping asserted console.log output free of ANSI escape codes.
jest.mock('chalk', () => ({
    __esModule: true,
    default: {
        red: (s: string) => s,
        yellow: (s: string) => s,
        green: (s: string) => s,
    },
}));

import { printMetricsSummary } from './report';
import { ModuleMetrics } from './types';

function metric(ca: number, ce: number): ModuleMetrics {
    const instability = ca + ce === 0 ? 0 : Number((ce / (ca + ce)).toFixed(2));
    return { ca, ce, instability };
}

describe('printMetricsSummary', () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        logSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function loggedLines(): string {
        return logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    }

    it('shows most unstable modules first', () => {
        const metrics = new Map([
            [path.join(process.cwd(), 'src', 'stable.ts'), metric(10, 0)],
            [path.join(process.cwd(), 'src', 'unstable.ts'), metric(0, 10)],
        ]);

        printMetricsSummary({ metrics, limit: 2 });

        const output = loggedLines();
        const unstableIdx = output.indexOf('unstable.ts');
        const stableIdx = output.indexOf('stable.ts');

        expect(unstableIdx).toBeGreaterThan(-1);
        expect(unstableIdx).toBeLessThan(stableIdx);
    });

    // F17: two files sharing a basename in different directories must not
    // become indistinguishable in the report - path.basename(file) alone
    // ("index.ts" for both) makes it impossible to tell which module is
    // actually unstable.
    describe('meaningful names for same-basename files in different directories (F17)', () => {
        it('shows a root-relative path, not a bare basename, for each module', () => {
            const metrics = new Map([
                [path.join(process.cwd(), 'src', 'foo', 'index.ts'), metric(0, 10)],
                [path.join(process.cwd(), 'src', 'bar', 'index.ts'), metric(10, 0)],
            ]);

            printMetricsSummary({ metrics, limit: 2 });

            const output = loggedLines();

            expect(output).toContain(path.join('src', 'foo', 'index.ts'));
            expect(output).toContain(path.join('src', 'bar', 'index.ts'));
        });
    });

    // F17: ties on instability must be broken by an explicit, readable rule
    // (alphabetical by displayed name) - not by whatever order the
    // underlying Map happened to be built in, which is filesystem/discovery
    // order (`cycles-large`'s "ten file0.ts rows" from the audit's own
    // reproduction).
    describe('deterministic tie-break for equal instability (F17)', () => {
        it('orders equally-unstable modules alphabetically by their displayed name, regardless of Map insertion order', () => {
            // Inserted in reverse-alphabetical order specifically so a
            // passing test can't be explained by coincidental Map
            // iteration order matching the alphabetical expectation.
            const metrics = new Map([
                [path.join(process.cwd(), 'src', 'c.ts'), metric(0, 1)],
                [path.join(process.cwd(), 'src', 'b.ts'), metric(0, 1)],
                [path.join(process.cwd(), 'src', 'a.ts'), metric(0, 1)],
            ]);

            printMetricsSummary({ metrics, limit: 3 });

            const output = loggedLines();
            const idxA = output.indexOf(path.join('src', 'a.ts'));
            const idxB = output.indexOf(path.join('src', 'b.ts'));
            const idxC = output.indexOf(path.join('src', 'c.ts'));

            expect(idxA).toBeGreaterThan(-1);
            expect(idxA).toBeLessThan(idxB);
            expect(idxB).toBeLessThan(idxC);
        });

        it('orders equally-stable modules alphabetically by their displayed name too, independent of the unstable list\'s own order', () => {
            const metrics = new Map([
                [path.join(process.cwd(), 'src', 'c.ts'), metric(1, 0)],
                [path.join(process.cwd(), 'src', 'b.ts'), metric(1, 0)],
                [path.join(process.cwd(), 'src', 'a.ts'), metric(1, 0)],
            ]);

            printMetricsSummary({ metrics, limit: 3 });

            const output = loggedLines();
            const stableSection = output.slice(output.indexOf('Most stable modules'));
            const idxA = stableSection.indexOf(path.join('src', 'a.ts'));
            const idxB = stableSection.indexOf(path.join('src', 'b.ts'));
            const idxC = stableSection.indexOf(path.join('src', 'c.ts'));

            expect(idxA).toBeGreaterThan(-1);
            expect(idxA).toBeLessThan(idxB);
            expect(idxB).toBeLessThan(idxC);
        });
    });

    it('respects the summary limit', () => {
        const metrics = new Map([
            [path.join(process.cwd(), 'src', 'a.ts'), metric(0, 3)],
            [path.join(process.cwd(), 'src', 'b.ts'), metric(0, 2)],
            [path.join(process.cwd(), 'src', 'c.ts'), metric(0, 1)],
        ]);

        printMetricsSummary({ metrics, limit: 1 });

        const output = loggedLines();

        expect(output).toContain(path.join('src', 'a.ts'));
        expect(output).not.toContain(path.join('src', 'b.ts'));
    });

    it('handles an empty metrics map without throwing', () => {
        expect(() => printMetricsSummary({ metrics: new Map() })).not.toThrow();
    });
});
