export const styles = `
    body {
        margin: 0;
        padding: 0;
        font-family: sans-serif;
    }

    #cy {
        width: 100vw;
        height: 100vh;
    }

    #toolbar {
        position: absolute;
        top: 16px;
        right: 16px;

        z-index: 999;

        display: flex;
        align-items: center;
        gap: 10px;

        background: white;

        border: 1px solid #d1d5db;
        border-radius: 8px;

        padding: 10px;
    }

    #toolbar button {
        cursor: pointer;

        border: 1px solid #d1d5db;
        border-radius: 6px;

        background: #f9fafb;

        padding: 6px 10px;
    }

    #toolbar select {
        padding: 6px 10px;
    }

    #tooltip {
        position: absolute;
        display: none;
        padding: 8px 10px;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 12px;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        white-space: nowrap;
    }

    #hint {
        position: absolute;
        top: 16px;
        left: 16px;
        width: 260px;

        padding: 12px 14px;

        background: white;
        border: 1px solid #d1d5db;
        border-radius: 8px;

        font-size: 13px;
        line-height: 1.5;
        color: #374151;

        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);

        z-index: 999;
    }
`;
