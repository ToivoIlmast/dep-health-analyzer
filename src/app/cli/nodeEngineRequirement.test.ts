import fs from 'node:fs';
import path from 'node:path';

// dep-health-analyzer is CJS ("type": "commonjs") but `require()`s the
// ESM-only "ora" package (see generateAISummary.ts) - only possible because
// Node's require(esm) support became stable (no flag needed) in 22.12.0.
// Below that, loading the CLI throws ERR_REQUIRE_ESM. This test locks the
// declared package.json floor to that version; it cannot itself boot the
// CLI under a real pre-22.12 Node runtime (this environment only has
// 22.12+ available) - that requires a CI matrix across Node versions.
const REQUIRED_NODE_VERSION = '22.12.0';

const packageJsonPath = path.resolve(__dirname, '../../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

function parse(version: string): [number, number, number] {
    const parts = version.split('.').map(Number);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function satisfiesMinimum(version: string, minimum: string): boolean {
    const [vMajor, vMinor, vPatch] = parse(version);
    const [mMajor, mMinor, mPatch] = parse(minimum);

    if (vMajor !== mMajor) return vMajor > mMajor;
    if (vMinor !== mMinor) return vMinor > mMinor;
    return vPatch >= mPatch;
}

describe('package.json engines.node', () => {
    it(`declares a minimum of ${REQUIRED_NODE_VERSION}`, () => {
        expect(packageJson.engines).toEqual({ node: `>=${REQUIRED_NODE_VERSION}` });
    });

    it.each([
        ['22.12.0', true],
        ['22.12.1', true],
        ['22.13.0', true],
        ['23.0.0', true],
        ['24.4.2', true],
        ['22.11.9', false],
        ['22.0.0', false],
        ['20.18.1', false],
        ['18.20.4', false],
    ])('treats Node %s as supported=%s under that minimum', (version, expected) => {
        expect(satisfiesMinimum(version, REQUIRED_NODE_VERSION)).toBe(expected);
    });
});
