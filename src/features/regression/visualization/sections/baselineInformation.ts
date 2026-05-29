type BaselineInformationType = {
    target: string;
    baselineRef: string;
};

export function baselineInformation(args: BaselineInformationType): string {
    const { baselineRef, target } = args;
    const generatedAt = new Intl.DateTimeFormat('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date());

    return `
        <h2>Baseline Information</h2>

        <p><strong>Target:</strong> ${target}</p>
        <p><strong>Baseline:</strong> ${baselineRef}</p>
        <p><strong>Generated:</strong> ${generatedAt}</p>  
    `;
}
