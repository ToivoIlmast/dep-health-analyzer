import { DependencyInsight } from '../types';

const severityRank = {
    info: 1,
    warning: 2,
    error: 3,
};

type ShouldFailType = {
    findings: DependencyInsight[];
    failOn: 'info' | 'warning' | 'error';
};

export function shouldFail(args: ShouldFailType): boolean {
    const { findings, failOn } = args;
    const failLevel = severityRank[failOn];

    return findings.some((finding) => {
        const level = severityRank[finding.severity];
        return level >= failLevel;
    });
}
