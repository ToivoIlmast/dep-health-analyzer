/**
 * How large a share of this change's findings are `cross-boundary` - a
 * measurement of concentration, not an architectural verdict. The tool
 * has no way to know whether a given cross-boundary reach is actually a
 * problem for this specific project; it can only report how much of the
 * change consists of that structural category.
 */
export type CrossBoundaryConcentration =
    | 'Low Cross-Boundary Concentration'
    | 'Moderate Cross-Boundary Concentration'
    | 'High Cross-Boundary Concentration';
