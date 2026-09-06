import { ExportDeclaration, ImportDeclaration, Project } from 'ts-morph';

const project = new Project({
    skipAddingFilesFromTsConfig: true,
});

/**
 * `import type {...}` is not the only way TypeScript fully erases an
 * import at compile time - marking every individual named specifier as
 * `type` (`import { type A, type B } from '...'`) is erased identically,
 * and is exactly what `@typescript-eslint/consistent-type-imports`'
 * `inline-type-imports` autofix produces. A default or namespace import
 * can't be marked this way, so their presence means the declaration has
 * a real value reference regardless of any named specifiers.
 */
function isImportEffectivelyTypeOnly(decl: ImportDeclaration): boolean {
    if (decl.isTypeOnly()) {
        return true;
    }

    if (decl.getDefaultImport() || decl.getNamespaceImport()) {
        return false;
    }

    const namedImports = decl.getNamedImports();

    return namedImports.length > 0 && namedImports.every((named) => named.isTypeOnly());
}

function isExportEffectivelyTypeOnly(decl: ExportDeclaration): boolean {
    if (decl.isTypeOnly()) {
        return true;
    }

    if (decl.isNamespaceExport()) {
        return false;
    }

    const namedExports = decl.getNamedExports();

    return namedExports.length > 0 && namedExports.every((named) => named.isTypeOnly());
}

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
        .filter((i) => includeTypeOnlyImports || !isImportEffectivelyTypeOnly(i))
        .map((i) => i.getModuleSpecifierValue());

    const exports = sourceFile
        .getExportDeclarations()
        .filter((e) => includeTypeOnlyImports || !isExportEffectivelyTypeOnly(e))
        .map((e) => e.getModuleSpecifierValue())
        .filter(Boolean) as string[];

    return [...imports, ...exports];
}
