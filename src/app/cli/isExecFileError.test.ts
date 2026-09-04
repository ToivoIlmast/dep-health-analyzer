import { isExecFileError } from './isExecFileError';

describe('isExecFileError', () => {
    it('returns true for an Error with a numeric status', () => {
        const err = Object.assign(new Error('Command failed: git rev-parse'), { status: 128 });

        expect(isExecFileError(err)).toBe(true);
    });

    it('returns false for a plain Error with no status', () => {
        expect(isExecFileError(new Error('boom'))).toBe(false);
    });

    it('returns false when status is not a number', () => {
        const err = Object.assign(new Error('boom'), { status: 'not-a-number' });

        expect(isExecFileError(err)).toBe(false);
    });

    it('returns false for a non-Error value', () => {
        expect(isExecFileError({ status: 128 })).toBe(false);
        expect(isExecFileError('a string')).toBe(false);
        expect(isExecFileError(null)).toBe(false);
        expect(isExecFileError(undefined)).toBe(false);
    });
});
