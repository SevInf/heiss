import { parse } from 'acorn';
import {
    ExportNamedDeclaration,
    FunctionDeclaration,
    VariableDeclaration,
    ClassDeclaration,
    VariableDeclarator
} from 'estree';

class HMRProxyGenerator {
    private source: string;
    private proxiedExports: Array<string> = [];
    private usedNames: Set<string> = new Set();
    private originalUrl: string;

    constructor(source: string, originalUrl: string) {
        this.source = source;
        this.originalUrl = originalUrl;
    }

    generate(): string {
        const program = parse(this.source, { sourceType: 'module' });
        for (const statement of program.body) {
            if (statement.type === 'ExportNamedDeclaration') {
                this.proxyNamedDeclaration(statement);
            } else if (statement.type === 'ExportDefaultDeclaration') {
                this.proxyName('default');
            }
        }

        if (this.proxiedExports.length === 0) {
            return this.source;
        }
        return this.generateProxyModule();
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
            for (const variableDeclaration of declaration.declarations) {
                this.proxyVariableDeclarator(variableDeclaration);
            }
        } else {
            // class or function
            this.proxyName(declaration.id!.name);
        }
    }

    private proxyVariableDeclarator(variable: VariableDeclarator) {
        switch (variable.id.type) {
            case 'Identifier':
                this.proxyName(variable.id.name);
                break;
            // TODO: destructuring
        }
    }

    private proxyName(name: string) {
        this.usedNames.add(name);
        this.proxiedExports.push(name);
    }

    private generateProxyModule(): string {
        // TODO: default is reserverd word
        const lines = [];
        lines.push('import {');
        for (const name of this.proxiedExports) {
            lines.push(`    ${name}`);
        }
        lines.push(`} from '${this.originalUrl}?mtime=0';`);
        lines.push();
        const clientVarName = this.getUniqueName('client');
        lines.push(`import { ${clientVarName} } from "/@hmr";`);

        const proxyVarNames: Map<string, string> = new Map();
        for (const name of this.proxiedExports) {
            const varName = this.getUniqueName(name);
            proxyVarNames.set(name, varName);
            lines.push(`let ${varName} = ${name};`);
        }
        lines.push('');
        lines.push('export {');

        for (const name of this.proxiedExports) {
            lines.push(`    ${proxyVarNames.get(name)} as ${name}`);
        }

        lines.push('};');
        lines.push('');

        lines.push(`${clientVarName}.registerModule("${this.originalUrl}", (updated) => {`);
        for (const name of this.proxiedExports) {
            const varName = proxyVarNames.get(name);
            lines.push(`    ${varName} = updated.${name};`);
        }
        lines.push('});');

        return lines.join('\n');
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

export function generateHmrProxy(source: string, originalUrl: string): string {
    const generator = new HMRProxyGenerator(source, originalUrl);
    return generator.generate();
}
