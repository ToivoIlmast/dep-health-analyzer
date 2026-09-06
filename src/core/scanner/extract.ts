import { Project } from 'ts-morph';

const project = new Project({
    skipAddingFilesFromTsConfig: true,
});

export type ExtractImportsOptions = {
    /**
     * `import type { X } from '...'` and `export type { X } from '...'` are
     * fully erased at compile time - they produce no runtime dependency at
     * all. Excluded by default so a cycle/cross-boundary reach that exists
     * purely at the type level (zero coupling in compiled/bundled output)
     * isn't flagged identically to a genuine runtime one.
     */
    includeTypeOnlyImports?: boolean;
};

export function extractImports(filePath: string, options: ExtractImportsOptions = {}): string[] {
    const { includeTypeOnlyImports = false } = options;

    const cachedSourceFile = project.getSourceFile(filePath);

    if (cachedSourceFile) {
        cachedSourceFile.refreshFromFileSystemSync();
    }

    const sourceFile = cachedSourceFile ?? project.addSourceFileAtPath(filePath);

    const imports = sourceFile
        .getImportDeclarations()
        .filter((i) => includeTypeOnlyImports || !i.isTypeOnly())
        .map((i) => i.getModuleSpecifierValue());

    const exports = sourceFile
        .getExportDeclarations()
        .filter((e) => includeTypeOnlyImports || !e.isTypeOnly())
        .map((e) => e.getModuleSpecifierValue())
        .filter(Boolean) as string[];

    return [...imports, ...exports];
}
