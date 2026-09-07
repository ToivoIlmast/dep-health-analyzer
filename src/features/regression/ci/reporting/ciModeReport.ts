import { DependencyInsight } from '@features/regression/types';

const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

type CiReportType = {
    delta: DependencyInsight[];
};

export function ciModeReport(arg: CiReportType): void {
    const { delta } = arg;

    const crossBoundary = delta.filter((d) => d.relation === 'cross-boundary');
    const deepInternal = delta.filter((d) => d.relation === 'deep-internal');
    const sibling = delta.filter((d) => d.relation === 'sibling');
    const internal = delta.filter((d) => d.relation === 'internal');

    console.log('\nArchitectural CI Summary\n');
    console.log(`Cross-boundary dependencies: ${crossBoundary.length}`);
    console.log(`Deep internal traversals: ${deepInternal.length}`);
    console.log(`Sibling dependencies: ${sibling.length}`);
    console.log(`Internal dependencies: ${internal.length}`);

    const hasNotableFindings = crossBoundary.length > 0 || deepInternal.length > 0;

    if (hasNotableFindings) {
        console.log(`\n${YELLOW}Cross-boundary or deep-internal findings were introduced in this change.${RESET}\n`);
    } else {
        console.log(`\nNo cross-boundary or deep-internal findings were introduced in this change.\n`);
    }
}
