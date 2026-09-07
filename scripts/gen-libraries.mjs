import { freshRepo, write, commit, writePackageJson, writeDepHealthConfig, writeTsconfig, gitignoreNodeModules } from './test-projects-toolkit.mjs';

// ---------------------------------------------------------------------------
// typescript-library
// ---------------------------------------------------------------------------
function genTsLibrary() {
    const dir = freshRepo('typescript-library');
    writePackageJson(dir, {
        name: 'typescript-library', version: '1.0.0', private: true, main: 'dist/index.js', types: 'dist/index.d.ts',
        devDependencies: { typescript: '^5.6.0' },
    });
    writeTsconfig(dir, { compilerOptions: { declaration: true, module: 'CommonJS', moduleResolution: 'Node' } });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir, { features: { regression: { enabled: true, history: { enabled: true, sampleSize: 10 }, typescript: { includeTypeOnlyImports: false } }, scc: { enabled: true, typescript: { includeTypeOnlyImports: false } } } });

    write(dir, 'src/types/token.ts', `export type TokenType = 'identifier' | 'number' | 'operator';\n\nexport interface Token {\n    type: TokenType;\n    value: string;\n}\n`);
    write(dir, 'src/utils/isDigit.ts', `export function isDigit(ch: string): boolean {\n    return ch >= '0' && ch <= '9';\n}\n`);
    commit(dir, 'baseline: token types + isDigit util');

    write(dir, 'src/parser/tokenizer.ts', `import type { Token } from '../types/token';\nimport { isDigit } from '../utils/isDigit';\n\nexport function tokenize(input: string): Token[] {\n    const tokens: Token[] = [];\n    for (const ch of input) {\n        if (isDigit(ch)) {\n            tokens.push({ type: 'number', value: ch });\n        }\n    }\n    return tokens;\n}\n`);
    commit(dir, 'add tokenizer (type-only + runtime imports)');

    write(dir, 'src/parser/ast.ts', `export interface AstNode {\n    kind: string;\n    children: AstNode[];\n}\n`);
    write(dir, 'src/parser/parse.ts', `import type { Token } from '../types/token';\nimport type { AstNode } from './ast';\nimport { tokenize } from './tokenizer';\n\nexport function parse(input: string): AstNode {\n    const tokens: Token[] = tokenize(input);\n    return { kind: 'program', children: tokens.map(() => ({ kind: 'token', children: [] })) };\n}\n`);
    commit(dir, 'add ast + parse, tying tokenizer and ast together');

    write(dir, 'src/analyzer/countNodes.ts', `import type { AstNode } from '../parser/ast';\n\nexport function countNodes(node: AstNode): number {\n    return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);\n}\n`);
    write(dir, 'src/analyzer/index.ts', `export { countNodes } from './countNodes';\n`);
    commit(dir, 'add analyzer module with its own barrel file');

    write(dir, 'src/parser/index.ts', `export { parse } from './parse';\nexport * from './ast';\n`);
    write(dir, 'src/index.ts', `export * from './parser';\nexport * from './analyzer';\nexport * from './types/token';\n`);
    commit(dir, 'add barrel files: parser/index.ts and the public API in src/index.ts');

    write(dir, 'src/parser/cache.ts', `import { parse } from './parse';\n\nexport function cachedParse(input: string) {\n    return parse(input);\n}\n`);
    write(dir, 'src/parser/parse.ts', `import type { Token } from '../types/token';\nimport type { AstNode } from './ast';\nimport { tokenize } from './tokenizer';\nimport { cachedParse } from './cache';\n\nexport function parse(input: string): AstNode {\n    void cachedParse;\n    const tokens: Token[] = tokenize(input);\n    return { kind: 'program', children: tokens.map(() => ({ kind: 'token', children: [] })) };\n}\n`);
    commit(dir, 'introduce a cycle: parse.ts <-> cache.ts (a realistic caching-layer mistake)');

    write(dir, 'src/parser/cache.ts', `export function cachedParse(_input: string) {\n    return { kind: 'cached', children: [] };\n}\n`);
    commit(dir, 'fix: break the parse.ts/cache.ts cycle by making cache.ts self-contained');

    return dir;
}

// ---------------------------------------------------------------------------
// typescript-cli
// ---------------------------------------------------------------------------
function genTsCli() {
    const dir = freshRepo('typescript-cli');
    writePackageJson(dir, {
        name: 'typescript-cli', version: '1.0.0', private: true, bin: { 'ts-cli': 'dist/cli.js' },
        devDependencies: { typescript: '^5.6.0' },
    });
    writeTsconfig(dir, { compilerOptions: { module: 'CommonJS', moduleResolution: 'Node' } });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir, { features: { regression: { enabled: true, history: { enabled: true, sampleSize: 10 }, typescript: { includeTypeOnlyImports: false } }, scc: { enabled: true, typescript: { includeTypeOnlyImports: false } } } });

    write(dir, 'src/config/types.ts', `export interface CliConfig {\n    verbose: boolean;\n}\n`);
    write(dir, 'src/config/loadConfig.ts', `import type { CliConfig } from './types';\n\nexport function loadConfig(): CliConfig {\n    return { verbose: false };\n}\n`);
    commit(dir, 'baseline: config types + loadConfig');

    write(dir, 'src/core/scan.ts', `export function scan(dir: string): string[] {\n    return [dir];\n}\n`);
    write(dir, 'src/commands/scanCommand.ts', `import { scan } from '../core/scan';\nimport { loadConfig } from '../config/loadConfig';\n\nexport function runScan(dir: string) {\n    const config = loadConfig();\n    return { files: scan(dir), verbose: config.verbose };\n}\n`);
    commit(dir, 'add core/scan + commands/scanCommand');

    write(dir, 'src/output/printer.ts', `export function print(lines: string[]): void {\n    for (const line of lines) console.log(line);\n}\n`);
    write(dir, 'src/commands/scanCommand.ts', `import { scan } from '../core/scan';\nimport { loadConfig } from '../config/loadConfig';\nimport { print } from '../output/printer';\n\nexport function runScan(dir: string) {\n    const config = loadConfig();\n    const files = scan(dir);\n    print(files);\n    return { files, verbose: config.verbose };\n}\n`);
    commit(dir, 'scanCommand now also prints via output/printer (cross-directory dependency)');

    write(dir, 'src/utils/args.ts', `export function parseArgs(argv: string[]): Record<string, string> {\n    const result: Record<string, string> = {};\n    for (const arg of argv) {\n        const [key, value] = arg.split('=');\n        if (key) result[key] = value ?? '';\n    }\n    return result;\n}\n`);
    write(dir, 'src/cli.ts', `import { parseArgs } from './utils/args';\nimport { runScan } from './commands/scanCommand';\n\nconst args = parseArgs(process.argv.slice(2));\nrunScan(args.dir ?? '.');\n`);
    commit(dir, 'add utils/args + cli.ts entry point');

    return dir;
}

genTsLibrary();
genTsCli();
console.log('Generated: typescript-library, typescript-cli');
