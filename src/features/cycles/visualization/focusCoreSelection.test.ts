import { selectFocusCore } from './focusCoreSelection';
import type { FocusEdgeRef } from './focusNeighbourSelection';

const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${String(i).padStart(2, '0')}`);

function ring(members: string[]): FocusEdgeRef[] {
    return members.map((id, i) => ({ source: id, target: members[(i + 1) % members.length]! }));
}

// hub <-> partner plus a long detour hub -> via00 -> ... -> via46 -> hub.
function shortCycleWithDetour(): { members: string[]; edges: FocusEdgeRef[] } {
    const via = ids('via', 47);
    return {
        members: ['hub', 'partner', ...via],
        edges: [
            { source: 'hub', target: 'partner' },
            { source: 'partner', target: 'hub' },
            { source: 'hub', target: via[0]! },
            ...via.slice(0, -1).map((id, i) => ({ source: id, target: via[i + 1]! })),
            { source: via[via.length - 1]!, target: 'hub' },
        ],
    };
}

function expectDistinctMembers(result: string[], members: string[]) {
    expect(new Set(result).size).toBe(result.length);
    for (const id of result) {
        expect(members).toContain(id);
    }
}

describe('selectFocusCore', () => {
    it.each(['hub', 'partner', 'via10', 'via46'])(
        'fills the budget even when the shortest cycle through the start is 2 nodes (start: %s)',
        (start) => {
            const { members, edges } = shortCycleWithDetour();

            const result = selectFocusCore(members, edges, start, 40);

            expect(result).toHaveLength(40);
            expect(result[0]).toBe(start);
            expectDistinctMembers(result, members);
        },
    );

    it('caps a ring at the budget', () => {
        const members = ids('r', 45);

        const result = selectFocusCore(members, ring(members), 'r00', 40);

        expect(result).toHaveLength(40);
        expectDistinctMembers(result, members);
    });

    it('returns every member when the SCC fits the budget', () => {
        const members = ids('r', 12);

        expect(new Set(selectFocusCore(members, ring(members), 'r05', 40))).toEqual(new Set(members));
    });

    it('does not depend on member or edge order', () => {
        const { members, edges } = shortCycleWithDetour();

        const forward = selectFocusCore(members, edges, 'hub', 40);
        const reversed = selectFocusCore([...members].reverse(), [...edges].reverse(), 'hub', 40);

        expect(reversed).toEqual(forward);
    });

    it('still fills the budget when excluded members cut the rest off (e.g. by the Area filter)', () => {
        // Two groups with no edge between them among the remaining members.
        const groupA = ids('a', 10);
        const groupB = ids('b', 50);
        const edges = [...ring(groupA), ...ring(groupB)];

        const result = selectFocusCore([...groupA, ...groupB], edges, 'a00', 40);

        expect(result).toHaveLength(40);
        expectDistinctMembers(result, [...groupA, ...groupB]);
    });

    it('ignores edges to non-members and self-loops, and falls back when the start is not a member', () => {
        const members = ids('r', 45);
        const edges = [...ring(members), { source: 'r00', target: 'outside' }, { source: 'r01', target: 'r01' }];

        const result = selectFocusCore(members, edges, 'outside', 40);

        expect(result).toHaveLength(40);
        expectDistinctMembers(result, members);
    });
});
