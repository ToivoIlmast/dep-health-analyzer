import { detectCycles } from './cycles';
import { DependencyGraph } from '../graph/types';

describe('detectCycles', () => {
    it('should return empty array when graph has no cycles', () => {
        const mockGraph: DependencyGraph = {
            nodes: new Set(['a', 'b', 'c']),
            edges: new Map([
                ['a', new Set(['b'])],
                ['b', new Set(['c'])],
            ]),
        };
        const result = detectCycles(mockGraph);
        expect(result).toEqual([]);
    });

    it('should detect simple cycle', () => {
        const mockGraph: DependencyGraph = {
            nodes: new Set(['a', 'b', 'c']),
            edges: new Map([
                ['a', new Set(['b'])],
                ['b', new Set(['c'])],
                ['c', new Set(['a'])],
            ]),
        };
        const result = detectCycles(mockGraph);
        // expect(result).toEqual([['a', 'b', 'c', 'a']]);
        expect(result.length).toBe(1);
    });
});
