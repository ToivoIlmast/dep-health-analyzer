const HTML_ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

/**
 * Escapes a string for safe interpolation into HTML text/attribute content.
 * Any value that can contain arbitrary free text from outside dep-health
 * itself (a commit message, a file/directory name) must go through this
 * before being embedded in a generated report - otherwise a crafted commit
 * message or filename (e.g. containing `<script>...</script>`) executes
 * when the report is opened in a browser.
 */
export function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] as string);
}
