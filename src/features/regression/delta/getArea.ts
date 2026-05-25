export function getArea(file: string, depth = 2): string {
    const normalized = file.replaceAll('\\', '/');

    const parts = normalized.split('/');

    console.log('parts:', parts.slice(0, depth).join('/'));

    return parts.slice(0, depth).join('/');
}
