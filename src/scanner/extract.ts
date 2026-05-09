import { Project } from 'ts-morph';

const project = new Project({
    skipAddingFilesFromTsConfig: true,
});

export function extractImports(filePath: string): string[] {
    const sourceFile = project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath);

    const imports = sourceFile.getImportDeclarations().map((i) => i.getModuleSpecifierValue());

    const exports = sourceFile
        .getExportDeclarations()
        .map((e) => e.getModuleSpecifierValue())
        .filter(Boolean) as string[];

    return [...imports, ...exports];
}
