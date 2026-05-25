export function getCommonDepth(from: string, to: string): number {
    const fromParts = from.replaceAll('\\', '/').split('/').filter(Boolean);

    const toParts = to.replaceAll('\\', '/').split('/').filter(Boolean);

    const minLength = Math.min(fromParts.length, toParts.length);

    let commonDepth = 0;

    for (let i = 0; i < minLength; i++) {
        if (fromParts[i] !== toParts[i]) {
            break;
        }

        commonDepth++;
    }

    return commonDepth;
}
