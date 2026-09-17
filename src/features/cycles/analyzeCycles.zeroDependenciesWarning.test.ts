import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MODES } from '@shared/types';

// Same constraint as analyzeCycles.unresolvedImports.test.ts: `./metrics/report`
// imports the ESM-only `chalk`, unparseable by Jest's CJS transform.
jest.mock('./metrics/report', () => ({ printMetricsSummary: jest.fn() }));

import { analyzeCycles } from './analyzeCycles';

// F1b: a Stage 0 plan item ("a warning when dependencies === 0 && scannedFiles
// > 0") that F1 did not implement - F1 built `unresolvedImports` (a specific
// diagnosis: THIS relative import failed to resolve), but a project that
// scans real files and finds zero dependencies for an entirely different
// reason - e.g. a CommonJS project using require(), which extractImports()
// never even looks at, so nothing is ever "unresolved" - still printed a
// silent "Dependencies: 0" with no diagnostic at all. Real scanProject, real
// resolver - only the chalk-dependent report printer above is mocked.
describe('analyzeCycles - zero-dependencies warning (F1b)', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-analyzecycles-zerodeps-'));
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
        jest.restoreAllMocks();
    });

    const baseArgs = {
        failOn: 'info' as const,
        enableHtmlReport: false,
        htmlReportOutputPath: path.join('.', 'unused.html'),
    };

    it('warns that analysis may be incomplete for a real CommonJS-style project with 0 detected dependencies', async () => {
        // require()/module.exports - extractImports() only visits ts-morph's
        // ImportDeclaration/ExportDeclaration nodes, so this produces zero
        // extracted specifiers, zero edges, "Dependencies: 0" - even though
        // the dependency file genuinely exists on disk.
        fs.writeFileSync(
            path.join(root, 'a.js'),
            `const dep = require('./dep');\nmodule.exports = dep;\n`
        );
        fs.writeFileSync(path.join(root, 'dep.js'), `module.exports = 1;\n`);

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        await analyzeCycles({ ...baseArgs, target: root, mode: MODES.COMPACT });

        const warnedIncomplete = warnSpy.mock.calls.some(
            ([message]) =>
                typeof message === 'string' &&
                /no dependencies/i.test(message) &&
                /incomplete/i.test(message)
        );
        expect(warnedIncomplete).toBe(true);
    });

    it('does not warn when real dependencies are found (Case 2)', async () => {
        fs.writeFileSync(
            path.join(root, 'a.ts'),
            `import { b } from './b';\nexport const a = b;\n`
        );
        fs.writeFileSync(path.join(root, 'b.ts'), `export const b = 1;\n`);

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        await analyzeCycles({ ...baseArgs, target: root, mode: MODES.COMPACT });

        const warnedIncomplete = warnSpy.mock.calls.some(
            ([message]) => typeof message === 'string' && /no dependencies/i.test(message)
        );
        expect(warnedIncomplete).toBe(false);
    });

    it('does not warn when there are no scanned files at all (Case 3)', async () => {
        // root exists but is empty - scannedFiles === 0, dependencies === 0.
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        await analyzeCycles({ ...baseArgs, target: root, mode: MODES.COMPACT });

        const warnedIncomplete = warnSpy.mock.calls.some(
            ([message]) => typeof message === 'string' && /no dependencies/i.test(message)
        );
        expect(warnedIncomplete).toBe(false);
    });

    // Important per the task: F1's unresolvedImports warning and F1b's
    // warning diagnose DIFFERENT causes and must be able to fire together -
    // neither should suppress the other. A file whose only import is a
    // relative one that fails to resolve produces BOTH an unresolvedImports
    // entry AND dependencyCount === 0 (the failed import never becomes an
    // edge), simultaneously.
    it('shows both the unresolvedImports warning and the zero-dependencies warning together, without either suppressing the other', async () => {
        fs.writeFileSync(
            path.join(root, 'a.ts'),
            `import { missing } from './does-not-exist';\nexport const a = missing;\n`
        );

        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        await analyzeCycles({ ...baseArgs, target: root, mode: MODES.COMPACT });

        const messages = warnSpy.mock.calls.map(([message]) => message).filter(
            (m): m is string => typeof m === 'string'
        );

        expect(messages.some((m) => /unresolved import/i.test(m))).toBe(true);
        expect(messages.some((m) => /no dependencies/i.test(m) && /incomplete/i.test(m))).toBe(true);
    });
});
