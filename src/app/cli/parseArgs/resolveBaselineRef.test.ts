import { execFileSync } from 'node:child_process';
import { resolveBaselineRef } from './resolveBaselineRef';

jest.mock('node:child_process', () => ({
    execFileSync: jest.fn(),
}));

describe('resolveBaselineRef', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    it('should return provided baseline ref', () => {
        expect(resolveBaselineRef('main')).toBe('main');
    });

    it('does not warn when an explicit baseline ref is provided', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        resolveBaselineRef('HEAD');

        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should return HEAD~1 when previous commit exists', () => {
        (execFileSync as jest.Mock).mockImplementation(() => undefined);

        expect(resolveBaselineRef()).toBe('HEAD~1');
    });

    it('does not warn when HEAD~1 resolves fine', () => {
        (execFileSync as jest.Mock).mockImplementation(() => undefined);
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        resolveBaselineRef();

        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should return HEAD when previous commit does not exist', () => {
        (execFileSync as jest.Mock).mockImplementation(() => {
            throw new Error('git error');
        });

        expect(resolveBaselineRef()).toBe('HEAD');
    });

    it('warns that the comparison falls back to HEAD itself when HEAD~1 cannot be resolved', () => {
        (execFileSync as jest.Mock).mockImplementation(() => {
            throw new Error('git error');
        });
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        resolveBaselineRef();

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('HEAD~1 could not be resolved')
        );
    });

    it('verifies a custom fallback ref instead of the hardcoded HEAD~1', () => {
        (execFileSync as jest.Mock).mockImplementation(() => undefined);

        expect(resolveBaselineRef(undefined, 'HEAD~9')).toBe('HEAD~9');
        expect(execFileSync).toHaveBeenCalledWith(
            'git',
            ['rev-parse', '--verify', 'HEAD~9'],
            expect.anything()
        );
    });

    it('mentions the custom fallback ref, not a hardcoded HEAD~1, in the warning when it cannot be resolved', () => {
        (execFileSync as jest.Mock).mockImplementation(() => {
            throw new Error('git error');
        });
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const result = resolveBaselineRef(undefined, 'HEAD~9');

        expect(result).toBe('HEAD');
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('HEAD~9 could not be resolved'));
    });
});
