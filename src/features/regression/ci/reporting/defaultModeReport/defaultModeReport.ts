import { DependencyInsight } from '../../../types';
import { aggregation } from './aggregation';

type DefaltReportType = {
    delta: DependencyInsight[];
};

export function defaultModeReport(arg: DefaltReportType): void {
    const { delta } = arg;

    aggregation({ delta });
}
