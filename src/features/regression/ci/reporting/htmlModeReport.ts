import fs from 'node:fs';
import path from 'node:path';

import { DependencyInsight } from '@features/regression/types';

type HtmlReportType = {
    isHtml: boolean;
    delta: DependencyInsight[];
};

export function htmlModeReport(arg: HtmlReportType): void {
    const { isHtml, delta } = arg;

    if (!isHtml) return;

    const rows = delta
        .map((item) => {
            const reasoning = item.reasoning.map((reason) => `<li>${reason}</li>`).join('');

            return `
                <tr>
                    <td class="${item.relation}">${item.relation}</td>
                    <td>${item.interpretation}</td>
                    <td>${item.from}</td>
                    <td>${item.to}</td>
                    <td>${item.commonDepth}</td>
                    <td>${item.residualDepth}</td>
                    <td>${item.commonParent}</td>
                    <td>
                        <ul>
                            ${reasoning}
                        </ul>
                    </td>
                </tr>
                `;
        })
        .join('');

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
        <meta charset="UTF-8" />
        
        <title>dep-health report</title>
        
        <style>
        body {
            font-family: Arial, sans-serif;
            padding: 24px;
            background: #111827;
            color: #f3f4f6;
            line-height: 1.5;
        }
        
        h1 {
            margin-bottom: 8px;
        }
        
        h2 {
            margin-top: 40px;
        }
        
        p {
            color: #d1d5db;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            background: #1f2937;
            margin-top: 24px;
        }
        
        th,
        td {
            border: 1px solid #374151;
            padding: 12px;
            vertical-align: top;
            text-align: left;
        }
        
        th {
            background: #111827;
        }
        
        tr:nth-child(even) {
            background: #18212f;
        }
        
        ul {
            margin: 0;
            padding-left: 18px;
        }
        
        code {
            background: #0f172a;
            padding: 2px 6px;
            border-radius: 4px;
            color: #93c5fd;
        }
        
        .section {
            margin-top: 32px;
            padding: 20px;
            background: #1f2937;
            border: 1px solid #374151;
            border-radius: 8px;
        }
        
        .internal {
            color: #34d399;
            font-weight: bold;
        }
        
        .sibling {
            color: #60a5fa;
            font-weight: bold;
        }
        
        .cross-boundary {
            color: #f87171;
            font-weight: bold;
        }
        
        .deep-internal {
            color: #fbbf24;
            font-weight: bold;
        }
        </style>
        </head>
        
        <body>
        
        <h1>dep-health architectural report</h1>
        
        <p>
        Generated findings: ${delta.length}
        </p>
        
        <div class="section">
            <h2>Architectural relation guide</h2>
        
            <table>
                <thead>
                    <tr>
                        <th>Relation</th>
                        <th>Meaning</th>
                    </tr>
                </thead>
        
                <tbody>
                    <tr>
                        <td class="sibling">sibling</td>
                        <td>
                            Modules located in the same parent directory.
                        </td>
                    </tr>
        
                    <tr>
                        <td class="internal">internal</td>
                        <td>
                            Dependency inside a shared structural area.
                        </td>
                    </tr>
        
                    <tr>
                        <td class="deep-internal">deep-internal</td>
                        <td>
                            Dependency reaches deeply into nested internal structure.
                        </td>
                    </tr>
        
                    <tr>
                        <td class="cross-boundary">cross-boundary</td>
                        <td>
                            Dependency crosses structural area boundary.
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h2>Heuristics explanation</h2>
        
            <p>
                <strong>Common Depth</strong><br />
                Number of shared path segments between modules.
            </p>
        
            <p>
                <strong>Residual Depth</strong><br />
                Structural distance after path divergence.
            </p>
        
            <p>
                <strong>Common Parent</strong><br />
                Shared structural area detected between modules.
            </p>
        </div>
        
        <div class="section">
            <h2>Disclaimer</h2>
        
            <p>
                These findings are heuristic-based architectural signals,
                not strict architectural violations.
            </p>
        
            <p>
                dep-health does not know project-specific architecture rules
                unless explicit boundaries are configured.
            </p>
        </div>
        
        <h2>Architectural Findings</h2>
        
        <table>
        <thead>
        <tr>
            <th>Relation</th>
            <th>Interpretation</th>
            <th>From</th>
            <th>To</th>
            <th>Common Depth</th>
            <th>Residual Depth</th>
            <th>Common Parent</th>
            <th>Reasoning</th>
        </tr>
        </thead>
        
        <tbody>
        ${rows}
        </tbody>
        </table>
        
        </body>
        </html>
        `;

    const reportPath = path.resolve('dep-health-regression-report.html');
    fs.writeFileSync(reportPath, html);
    console.log(`HTML report generated: ${reportPath}`);
}
