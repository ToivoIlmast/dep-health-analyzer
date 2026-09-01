import { Project } from 'ts-morph';

const project = new Project({
    skipAddingFilesFromTsConfig: true,
});

export function extractImports(filePath: string): string[] {
    const cachedSourceFile = project.getSourceFile(filePath);

    if (cachedSourceFile) {
        cachedSourceFile.refreshFromFileSystemSync();
    }

    const sourceFile = cachedSourceFile ?? project.addSourceFileAtPath(filePath);

    const imports = sourceFile.getImportDeclarations().map((i) => i.getModuleSpecifierValue());

    const exports = sourceFile
        .getExportDeclarations()
        .map((e) => e.getModuleSpecifierValue())
        .filter(Boolean) as string[];

    return [...imports, ...exports];
}
