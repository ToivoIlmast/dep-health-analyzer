import fs from 'node:fs';
import path from 'node:path';

import { DependencyInsight } from '@features/regression/types';
import { buildRegressionHtmlTemplate } from './template';

type HtmlReportType = {
    delta: DependencyInsight[];
    outputPath: string;
    target: string;
    baselineRef: string;
    currentScannedFiles: number;
    baselineScannedFiles: number;
};

export function htmlModeReport(args: HtmlReportType): void {
    const { delta, outputPath, target, baselineRef, currentScannedFiles, baselineScannedFiles } =
        args;

    const html = buildRegressionHtmlTemplate({
        delta,
        target,
        baselineRef,
        currentScannedFiles,
        baselineScannedFiles,
    });

    const resolvedPath = path.resolve(outputPath);
    const directory = path.dirname(resolvedPath);

    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(resolvedPath, html);

    console.log(
        `\nHTML report:\n\u001B]8;;file://${resolvedPath}\u0007${resolvedPath}\u001B]8;;\u0007`
    );
}
