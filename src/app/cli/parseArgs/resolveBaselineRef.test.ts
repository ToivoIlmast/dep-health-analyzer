import { execSync } from 'node:child_process';
import { resolveBaselineRef } from './resolveBaselineRef';

jest.mock('node:child_process', () => ({
    execSync: jest.fn(),
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
        (execSync as jest.Mock).mockImplementation(() => undefined);

        expect(resolveBaselineRef()).toBe('HEAD~1');
    });

    it('does not warn when HEAD~1 resolves fine', () => {
        (execSync as jest.Mock).mockImplementation(() => undefined);
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        resolveBaselineRef();

        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should return HEAD when previous commit does not exist', () => {
        (execSync as jest.Mock).mockImplementation(() => {
            throw new Error('git error');
        });

        expect(resolveBaselineRef()).toBe('HEAD');
    });

    it('warns that the comparison falls back to HEAD itself when HEAD~1 cannot be resolved', () => {
        (execSync as jest.Mock).mockImplementation(() => {
            throw new Error('git error');
        });
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        resolveBaselineRef();

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('HEAD~1 could not be resolved')
        );
    });
});
