/**
 * JSON.stringify does not escape a closing script tag - a value containing
 * that literal sequence (e.g. a file named with an embedded closing script
 * tag followed by a new opening one) breaks out of the enclosing <script>
 * block when the JSON is embedded directly inline in a generated HTML
 * report, regardless of how well-formed the JSON itself is. Replacing every
 * '<' with its six-character unicode escape sequence neutralizes this
 * without changing the parsed value - both JSON.parse and the browser's own
 * JS parser decode that escape sequence back to a literal '<' at runtime,
 * so only the raw HTML source (which the browser scans for tag boundaries
 * before any JS parsing happens) never sees an actual '<' character.
 */
export function safeJsonForScript(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}
