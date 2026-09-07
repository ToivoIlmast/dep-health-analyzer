export const styles = `
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

    /*
     * A distinct hue per relation type for scannability, deliberately NOT
     * a good-to-bad gradient (no green="safe"/red="dangerous") - each
     * color marks a structural category, not a verdict. relation stays a
     * heuristic classification regardless of which color represents it.
     */
    .internal {
        color: #2dd4bf;
        font-weight: bold;
    }

    .sibling {
        color: #60a5fa;
        font-weight: bold;
    }

    .cross-boundary {
        color: #818cf8;
        font-weight: bold;
    }

    .deep-internal {
        color: #a78bfa;
        font-weight: bold;
    }

    .summary-grid {
        display: flex;
        gap: 16px;
        margin-top: 16px;
    }

    .summary-card {
        flex: 1;
        background: #111827;
        border: 1px solid #374151;
        border-radius: 8px;
        padding: 16px;
    }

    .summary-value {
        font-size: 28px;
        font-weight: bold;
    }

    .summary-label {
        margin-top: 8px;
        color: #9ca3af;
    }

    /* Same categorical palette as the relation table above - one color
       per relation type, not a good/bad gradient. */
    .count-cross-boundary {
        color: #818cf8;
    }

    .count-sibling {
        color: #60a5fa;
    }

    .count-internal {
        color: #2dd4bf;
    }

    .count-deep-internal {
        color: #a78bfa;
    }

    /*
     * Concentration banner: a single hue (blue) at increasing intensity
     * represents "a larger share of this change's findings are
     * cross-boundary" - a measurement of magnitude, not a red/yellow/green
     * verdict on architecture quality.
     */
    .concentration-high {
        background: rgba(59, 130, 246, 0.16);
        border-color: #3b82f6;
        color: #3b82f6;
    }

    .concentration-moderate {
        background: rgba(96, 165, 250, 0.12);
        border-color: #60a5fa;
        color: #60a5fa;
    }

    .concentration-low {
        background: rgba(147, 197, 253, 0.1);
        border-color: #93c5fd;
        color: #93c5fd;
    }

    .concentration-banner {
        margin-top: 16px;
        padding: 14px 18px;
        border-radius: 8px;
        font-size: 18px;
        font-weight: bold;
        border: 1px solid;
    }

    /*
     * Trend banner (history): highlights a directional change as worth a
     * look, without ranking one direction as better than another; "no
     * clear trend" gets the quiet/muted styling since there's nothing to
     * draw attention to.
     */
    .trend-notice {
        background: rgba(96, 165, 250, 0.12);
        border-color: #60a5fa;
        color: #60a5fa;
    }

    .trend-quiet {
        background: rgba(156, 163, 175, 0.08);
        border-color: #9ca3af;
        color: #9ca3af;
    }

    .trend-banner {
        margin-top: 16px;
        padding: 14px 18px;
        border-radius: 8px;
        font-size: 18px;
        font-weight: bold;
        border: 1px solid;
    }

    .doc-link {
        display: inline-block;
        margin-top: 4px;
        color: #60a5fa;
        font-size: 15px;
        text-decoration: none;
    }

    .doc-link:hover {
        text-decoration: underline;
    }
`;
