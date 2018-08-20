import * as acorn from 'acorn';
import injectDynamicImportPlugin from 'acorn-dynamic-import/lib/inject';
import injectImportMetaPlugin from 'acorn-import-meta/inject';
import { Program } from 'estree';

const parse = injectImportMetaPlugin(injectDynamicImportPlugin(acorn)).parse;

export function parseModule(source: string): Program {
    return parse(source, {
        sourceType: 'module',
        plugins: {
            dynamicImport: true,
            importMeta: true
        }
    });
}
