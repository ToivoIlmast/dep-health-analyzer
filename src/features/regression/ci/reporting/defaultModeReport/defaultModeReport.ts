import { DependencyInsight } from '../../../types';
import { aggregation } from './aggregation';
import { printFindings } from './printFindings';

type DefaltReportType = {
    delta: DependencyInsight[];
};

export function defaultModeReport(arg: DefaltReportType): void {
    const { delta } = arg;

    const finding = aggregation({ delta });
    printFindings(finding);
}
