import { getCommonDepth } from '../getCommonDepth';

function normalize(file: string): string[] {
    return file.replaceAll('\\', '/').split('/').filter(Boolean);
}

export function getCommonParent(from: string, to: string): string {
    const fromParts = normalize(from);
    const commonDepth = getCommonDepth(from, to);

    return fromParts.slice(0, commonDepth).join('/');
}

export function getResidualDepth(from: string, to: string, commonDepth: number): number {
    const toParts = normalize(to);

    // remove filename
    const toDirDepth = toParts.length - 1;

    return Math.max(0, toDirDepth - commonDepth);
}
