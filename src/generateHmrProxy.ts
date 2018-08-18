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
        // TODO: deconflict client variable
        lines.push('import { client } from "/@hmr";');

        for (const name of this.proxiedExports) {
            lines.push(`let _${name} = ${name};`);
        }
        lines.push('');
        lines.push('export {');

        for (const name of this.proxiedExports) {
            lines.push(`    _${name} as ${name}`);
        }

        lines.push('};');
        lines.push('');

        lines.push(`client.registerModule("${this.originalUrl}", (updated) => {`);
        for (const name of this.proxiedExports) {
            lines.push(`    _${name} = updated.${name};`);
        }
        lines.push('});');

        return lines.join('\n');
    }
}

export function generateHmrProxy(source: string, originalUrl: string): string {
    const generator = new HMRProxyGenerator(source, originalUrl);
    return generator.generate();
}
