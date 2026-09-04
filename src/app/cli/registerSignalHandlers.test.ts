jest.mock('@features/regression/utils/activeWorktreeTracker', () => ({
    getActiveWorktree: jest.fn(),
}));
jest.mock('@features/regression/utils/removeBaselineWorktree', () => ({
    removeBaselineWorktree: jest.fn(),
}));

import { getActiveWorktree } from '@features/regression/utils/activeWorktreeTracker';
import { removeBaselineWorktree } from '@features/regression/utils/removeBaselineWorktree';
import { registerSignalHandlers } from './registerSignalHandlers';

const mockedGetActiveWorktree = jest.mocked(getActiveWorktree);
const mockedRemoveBaselineWorktree = jest.mocked(removeBaselineWorktree);

function getRegisteredHandler(signal: 'SIGINT' | 'SIGTERM'): () => void {
    const onSpy = jest.spyOn(process, 'on');
    registerSignalHandlers();

    const call = onSpy.mock.calls.find(([registeredSignal]) => registeredSignal === signal);
    if (!call) {
        throw new Error(`No handler registered for ${signal}`);
    }

    return call[1] as () => void;
}

describe('registerSignalHandlers', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    it('registers a SIGINT handler', () => {
        const onSpy = jest.spyOn(process, 'on');

        registerSignalHandlers();

        expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('registers a SIGTERM handler', () => {
        const onSpy = jest.spyOn(process, 'on');

        registerSignalHandlers();

        expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('cleans up the active worktree on SIGINT when one is tracked', () => {
        mockedGetActiveWorktree.mockReturnValue('/tmp/some-worktree');
        jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
        jest.spyOn(console, 'error').mockImplementation();

        const handler = getRegisteredHandler('SIGINT');
        handler();

        expect(mockedRemoveBaselineWorktree).toHaveBeenCalledWith('/tmp/some-worktree');
        expect(process.exit).toHaveBeenCalledWith(130);
    });

    it('does not attempt cleanup on SIGINT when no worktree is tracked', () => {
        mockedGetActiveWorktree.mockReturnValue(null);
        jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        const handler = getRegisteredHandler('SIGINT');
        handler();

        expect(mockedRemoveBaselineWorktree).not.toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(130);
    });

    it('cleans up the active worktree on SIGTERM and exits with 143', () => {
        mockedGetActiveWorktree.mockReturnValue('/tmp/some-worktree');
        jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
        jest.spyOn(console, 'error').mockImplementation();

        const handler = getRegisteredHandler('SIGTERM');
        handler();

        expect(mockedRemoveBaselineWorktree).toHaveBeenCalledWith('/tmp/some-worktree');
        expect(process.exit).toHaveBeenCalledWith(143);
    });
});
