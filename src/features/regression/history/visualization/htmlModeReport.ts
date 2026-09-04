import fs from 'node:fs';
import path from 'node:path';

import { HistoryStrategyType } from '@shared/types';
import { HistoryPoint } from '../types';
import { buildHistoryHtmlTemplate } from './template';

type HistoryHtmlReportType = {
    points: HistoryPoint[];
    strategy: HistoryStrategyType;
    target: string;
    baselineRef: string;
    outputPath: string;
};

export function htmlModeReport(args: HistoryHtmlReportType): void {
    const { points, strategy, target, baselineRef, outputPath } = args;

    const html = buildHistoryHtmlTemplate({ points, strategy, target, baselineRef });

    const resolvedPath = path.resolve(outputPath);
    const directory = path.dirname(resolvedPath);

    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(resolvedPath, html);

    console.log(
        `\nHTML report:\n\u001B]8;;file://${resolvedPath}\u0007${resolvedPath}\u001B]8;;\u0007`
    );
}
