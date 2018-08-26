import { URL } from 'url';
import { parseModule } from './parseModule';
import { ExportNamedDeclaration, FunctionDeclaration, VariableDeclaration, ClassDeclaration, Pattern } from 'estree';

type NameCallback = (name: string) => void;
class HMRProxyGenerator {
    private source: string;
    private originalUrl: URL;

    // map from export name to alias
    private proxiedExports: Map<string, string> = new Map();
    private usedNames: Set<string> = new Set();
    private imports: Set<string> = new Set();
    private mutableVarNames: Set<string> = new Set();
    private exportsMutableBindings = false;

    constructor(source: string, originalUrl: URL) {
        this.source = source;
        this.originalUrl = originalUrl;
    }

    generate(): string {
        const program = parseModule(this.source);
        for (const statement of program.body) {
            switch (statement.type) {
                case 'VariableDeclaration':
                    this.registerMutableNames(statement);
                    break;
                case 'ExportNamedDeclaration':
                    this.proxyNamedDeclaration(statement);
                    break;
                case 'ExportDefaultDeclaration':
                    this.proxyName('default', '_default');
                    break;
                case 'ImportDeclaration':
                    this.imports.add(this.resolveImport(statement.source.value as string));
                    break;
            }
        }

        if (!this.isReloadable()) {
            return this.generateNonReloadableProxy();
        }

        if (this.proxiedExports.size === 0) {
            return this.generateNoExportsProxy();
        }
        return this.generateExportsProxy();
    }

    private registerMutableNames(declaration: VariableDeclaration) {
        if (declaration.kind === 'const') {
            return;
        }
        this.forEachDeclaredVariable(declaration, name => this.mutableVarNames.add(name));
    }

    private isReloadable(): boolean {
        if (this.exportsMutableBindings) {
            return false;
        }
        for (const name of this.proxiedExports.keys()) {
            if (this.mutableVarNames.has(name)) {
                return false;
            }
        }
        return true;
    }

    private resolveImport(relativeImport: string): string {
        return new URL(relativeImport, this.originalUrl).href;
    }

    private proxyNamedDeclaration(exportDeclaration: ExportNamedDeclaration) {
        if (exportDeclaration.declaration) {
            this.proxyDeclaration(exportDeclaration.declaration);
        }
        for (const specifier of exportDeclaration.specifiers) {
            this.proxyName(specifier.exported.name);
        }
    }

    private proxyDeclaration(declaration: VariableDeclaration | FunctionDeclaration | ClassDeclaration) {
        if (declaration.type === 'VariableDeclaration') {
            if (declaration.kind !== 'const') {
                this.exportsMutableBindings = true;
                return;
            }
            this.forEachDeclaredVariable(declaration, name => this.proxyName(name));
        } else {
            // class or function
            this.proxyName(declaration.id!.name);
        }
    }

    private forEachDeclaredVariable(declaration: VariableDeclaration, callback: NameCallback) {
        for (const variableDeclaration of declaration.declarations) {
            this.forEachDeclaredName(variableDeclaration.id, callback);
        }
    }

    private forEachDeclaredName(pattern: Pattern, callback: NameCallback) {
        switch (pattern.type) {
            case 'Identifier':
                callback(pattern.name);
                break;
            case 'ObjectPattern':
                pattern.properties.forEach(property => this.forEachDeclaredName(property.value, callback));
                break;
            case 'ArrayPattern':
                pattern.elements.forEach(element => this.forEachDeclaredName(element, callback));
                break;
            case 'RestElement':
                this.forEachDeclaredName(pattern.argument, callback);
                break;
            case 'AssignmentPattern':
                this.forEachDeclaredName(pattern.left, callback);
                break;
            default:
                throw new TypeError(`Unknown pattern type ${pattern.type}`);
        }
    }

    private proxyName(name: string, alias: string = name) {
        if (this.usedNames.has(alias)) {
            alias = this.getUniqueName(alias);
        }
        this.usedNames.add(alias);
        this.proxiedExports.set(name, alias);
    }

    private generateNonReloadableProxy(): string {
        return [
            `export * from "${this.originalUrl}?mtime=0";`,
            `import { registry } from "/@hmr/api";`,
            '',
            'registry.registerModule(',
            `    "${this.originalUrl}",`,
            '    [],',
            '    []',
            ').markAsNonReloadable();'
        ].join('\n');
    }

    private generateNoExportsProxy(): string {
        return [
            `import "${this.originalUrl}?mtime=0";`,
            `import { registry } from "/@hmr/api";`,
            '',
            'registry.registerModule(',
            `    "${this.originalUrl}",`,
            '    [],',
            `    ${JSON.stringify(Array.from(this.imports))}`,
            ');'
        ].join('\n');
    }

    private generateExportsProxy(): string {
        const exportNames = [];
        const imports = [];
        const assignments = [];
        const reexports = [];
        const reassignments = [];
        const registryVarName = this.getUniqueName('registry');
        const registryImport =
            registryVarName === 'registry'
                ? `import { registry } from "/@hmr/api";`
                : `import { registry as ${registryVarName} } from "/@hmr/api"`;
        for (const [proxiedName, importAlias] of this.proxiedExports) {
            exportNames.push(proxiedName);
            if (proxiedName === importAlias) {
                imports.push(`    ${proxiedName}`);
            } else {
                imports.push(`    ${proxiedName} as ${importAlias}`);
            }

            const localVariableName = this.getUniqueName(importAlias);
            assignments.push(`let ${localVariableName} = ${importAlias};`);
            reexports.push(`    ${localVariableName} as ${proxiedName}`);
            reassignments.push(`        ${localVariableName} = updated.${proxiedName};`);
        }

        return [
            'import {',
            imports.join(',\n'),
            `} from '${this.originalUrl}?mtime=0';`,
            registryImport,
            assignments.join('\n'),
            '',
            'export {',
            reexports.join(',\n'),
            '};',
            '',
            `${registryVarName}.registerModule(`,
            `    ${JSON.stringify(this.originalUrl)},`,
            `    ${JSON.stringify(exportNames)},`,
            `    ${JSON.stringify(Array.from(this.imports))},`,
            `    (updated) => {`,
            reassignments.join('\n'),
            '    }',
            ');'
        ].join('\n');
    }

    private getUniqueName(desiredName: string): string {
        if (!this.usedNames.has(desiredName)) {
            this.usedNames.add(desiredName);
            return desiredName;
        }

        let idx = 0;
        let name;
        do {
            name = `${desiredName}${idx++}`;
        } while (this.usedNames.has(name));

        this.usedNames.add(name);
        return name;
    }
}

export function generateHmrProxy(source: string, originalUrl: URL): string {
    const generator = new HMRProxyGenerator(source, originalUrl);
    return generator.generate();
}
