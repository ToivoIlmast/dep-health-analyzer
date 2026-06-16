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
});
