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

    .warning {
        color: #f87171;
    }

    .info {
        color: #60a5fa;
    }

    .success {
        color: #34d399;
    }

    .deep {
        color: #fbbf24;
    }

    .risk-high {
        background: rgba(248, 113, 113, 0.12);
        border-color: #f87171;
        color: #f87171;
    }
    
    .risk-moderate {
        background: rgba(251, 191, 36, 0.12);
        border-color: #fbbf24;
        color: #fbbf24;
    }
    
    .risk-low {
        background: rgba(52, 211, 153, 0.12);
        border-color: #34d399;
        color: #34d399;
    }

    .risk-banner {
        margin-top: 16px;
        padding: 14px 18px;
        border-radius: 8px;
        font-size: 18px;
        font-weight: bold;
        border: 1px solid;
    }
`;
