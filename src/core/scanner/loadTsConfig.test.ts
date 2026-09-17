import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadTsConfig } from './loadTsConfig';

describe('loadTsConfig', () => {
    it('should return null when tsconfig does not exist', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-tsconfig-'));

        const result = loadTsConfig(root);

        expect(result).toBeNull();
    });

    it('should load baseUrl and paths', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-tsconfig-'));

        fs.writeFileSync(
            path.join(root, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    baseUrl: '.',
                    paths: {
                        '@core/*': ['src/core/*'],
                        '@shared': ['src/shared/index.ts'],
                    },
                },
            })
        );

        const result = loadTsConfig(root);

        expect(result).not.toBeNull();

        expect(result).toEqual({
            baseDir: root,
            baseUrl: '.',
            paths: {
                '@core/*': ['src/core/*'],
                '@shared': ['src/shared/index.ts'],
            },
        });
    });

    it('should return empty paths when paths are missing', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-tsconfig-'));

        fs.writeFileSync(
            path.join(root, 'tsconfig.json'),
            JSON.stringify({
                compilerOptions: {
                    baseUrl: './src',
                },
            })
        );

        const result = loadTsConfig(root);

        expect(result).not.toBeNull();

        expect(result).toEqual({
            baseDir: root,
            baseUrl: './src',
            paths: {},
        });
    });

    it('should return null for invalid tsconfig json', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-tsconfig-'));

        fs.writeFileSync(path.join(root, 'tsconfig.json'), '{ invalid json');

        const result = loadTsConfig(root);

        expect(result).toBeNull();
    });

    it('should load compilerOptions from extended tsconfig', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-tsconfig-'));

        fs.writeFileSync(
            path.join(root, 'tsconfig.base.json'),
            JSON.stringify({
                compilerOptions: {
                    baseUrl: '.',
                    paths: {
                        '@core/*': ['src/core/*'],
                    },
                },
            })
        );

        fs.writeFileSync(
            path.join(root, 'tsconfig.json'),
            JSON.stringify({
                extends: './tsconfig.base.json',
            })
        );

        const result = loadTsConfig(root);

        expect(result).toEqual({
            baseDir: root,
            baseUrl: '.',
            paths: {
                '@core/*': ['src/core/*'],
            },
        });
    });

    describe('extends (F1a)', () => {
        // What "resolved" means for this loader is exactly what it exposes:
        // baseUrl/paths (TsConfigPaths) - not arbitrary compilerOptions like
        // `strict`/`target` this project never reads. Every case below
        // proves its point through those two real, consumed properties,
        // never just "did not throw".
        let root: string;

        beforeEach(() => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-tsconfig-extends-'));
        });

        afterEach(() => {
            fs.rmSync(root, { recursive: true, force: true });
            jest.restoreAllMocks();
        });

        it('resolves a bare-specifier extends to a direct node_modules/<scope>/<name>.json file', () => {
            fs.mkdirSync(path.join(root, 'node_modules', '@test-config'), { recursive: true });
            fs.writeFileSync(
                path.join(root, 'node_modules', '@test-config', 'base.json'),
                JSON.stringify({
                    compilerOptions: {
                        baseUrl: '.',
                        paths: { '@core/*': ['src/core/*'] },
                    },
                })
            );
            fs.writeFileSync(
                path.join(root, 'tsconfig.json'),
                JSON.stringify({
                    extends: '@test-config/base',
                    compilerOptions: { strict: true },
                })
            );

            const result = loadTsConfig(root);

            expect(result).toEqual({
                baseDir: root,
                baseUrl: '.',
                paths: { '@core/*': ['src/core/*'] },
            });
        });

        it('resolves a bare-specifier extends via a package.json "main" field (real Node package-style resolution)', () => {
            fs.mkdirSync(path.join(root, 'node_modules', '@test-config', 'base'), { recursive: true });
            fs.writeFileSync(
                path.join(root, 'node_modules', '@test-config', 'base', 'package.json'),
                JSON.stringify({ main: 'tsconfig.json' })
            );
            fs.writeFileSync(
                path.join(root, 'node_modules', '@test-config', 'base', 'tsconfig.json'),
                JSON.stringify({
                    compilerOptions: {
                        baseUrl: '.',
                        paths: { '@shared/*': ['src/shared/*'] },
                    },
                })
            );
            fs.writeFileSync(
                path.join(root, 'tsconfig.json'),
                JSON.stringify({ extends: '@test-config/base' })
            );

            const result = loadTsConfig(root);

            expect(result).toEqual({
                baseDir: root,
                baseUrl: '.',
                paths: { '@shared/*': ['src/shared/*'] },
            });
        });

        it('falls back to the main tsconfig (not null) when a bare-specifier extends cannot be resolved, and warns', () => {
            fs.writeFileSync(
                path.join(root, 'tsconfig.json'),
                JSON.stringify({
                    extends: '@does-not-exist/base',
                    compilerOptions: {
                        baseUrl: '.',
                        paths: { '@app/*': ['src/*'] },
                    },
                })
            );
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const result = loadTsConfig(root);

            // The main tsconfig's OWN compilerOptions must survive - this is
            // the core F1a invariant: "main tsconfig missing" and "main
            // tsconfig's extends unresolved" are not the same failure, and
            // only the first one should ever produce null.
            expect(result).toEqual({
                baseDir: root,
                baseUrl: '.',
                paths: { '@app/*': ['src/*'] },
            });

            const warnedAboutExtends = warnSpy.mock.calls.some(
                ([message]) =>
                    typeof message === 'string' &&
                    /extends/i.test(message) &&
                    /(not|could not).*resolv/i.test(message)
            );
            expect(warnedAboutExtends).toBe(true);
        });

        it('falls back to the main tsconfig (not null) when a relative extends target does not exist on disk, and warns', () => {
            fs.writeFileSync(
                path.join(root, 'tsconfig.json'),
                JSON.stringify({
                    extends: './does-not-exist.json',
                    compilerOptions: {
                        baseUrl: '.',
                        paths: { '@app/*': ['src/*'] },
                    },
                })
            );
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const result = loadTsConfig(root);

            expect(result).toEqual({
                baseDir: root,
                baseUrl: '.',
                paths: { '@app/*': ['src/*'] },
            });
            expect(warnSpy).toHaveBeenCalled();
        });

        it('does not warn when a relative extends resolves normally', () => {
            fs.writeFileSync(
                path.join(root, 'tsconfig.base.json'),
                JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@core/*': ['src/core/*'] } } })
            );
            fs.writeFileSync(
                path.join(root, 'tsconfig.json'),
                JSON.stringify({ extends: './tsconfig.base.json' })
            );
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            const result = loadTsConfig(root);

            expect(result).toEqual({
                baseDir: root,
                baseUrl: '.',
                paths: { '@core/*': ['src/core/*'] },
            });
            expect(warnSpy).not.toHaveBeenCalled();
        });

        it('does not warn when a bare-specifier extends resolves normally', () => {
            fs.mkdirSync(path.join(root, 'node_modules', '@test-config'), { recursive: true });
            fs.writeFileSync(
                path.join(root, 'node_modules', '@test-config', 'base.json'),
                JSON.stringify({ compilerOptions: { baseUrl: '.', paths: {} } })
            );
            fs.writeFileSync(
                path.join(root, 'tsconfig.json'),
                JSON.stringify({ extends: '@test-config/base' })
            );
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            loadTsConfig(root);

            expect(warnSpy).not.toHaveBeenCalled();
        });
    });
});
