function normalize(file: string): string[] {
    return file.replaceAll('\\', '/').split('/').filter(Boolean);
}

export function getCommonDepth(from: string, to: string): number {
    const fromParts = normalize(from);
    const toParts = normalize(to);

    const minLength = Math.min(fromParts.length, toParts.length);

    let commonDepth = 0;

    for (let i = 0; i < minLength; i++) {
        const fromPart = fromParts[i];
        const toPart = toParts[i];

        if (!fromPart || !toPart) {
            break;
        }

        if (fromPart !== toPart) {
            break;
        }

        commonDepth++;
    }

    return commonDepth;
}

export function getCommonParent(from: string, to: string): string {
    const fromParts = normalize(from);
    const toParts = normalize(to);

    const minLength = Math.min(fromParts.length, toParts.length);

    const common: string[] = [];

    for (let i = 0; i < minLength; i++) {
        const fromPart = fromParts[i];
        const toPart = toParts[i];

        if (!fromPart || !toPart) {
            break;
        }

        if (fromPart !== toPart) {
            break;
        }

        common.push(fromPart);
    }

    return common.join('/');
}

export function getResidualDepth(from: string, to: string, commonDepth: number): number {
    const toParts = normalize(to);

    // remove filename
    const toDirDepth = toParts.length - 1;

    return Math.max(0, toDirDepth - commonDepth);
}
