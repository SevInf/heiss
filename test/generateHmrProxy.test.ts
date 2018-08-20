import { generateHmrProxy } from '../src/generateHmrProxy';
import { parseModule } from '../src/parseModule';
import { readdirSync, readFileSync } from 'fs';
import * as path from 'path';
import injectDynamicImportPlugin from 'acorn-dynamic-import/lib/inject';

describe('generateHmrProxy', () => {
    const fixturesBasePath = path.join(__dirname, 'fixtures', 'generateHmrProxy');
    const fixtures = readdirSync(fixturesBasePath);

    for (const fixture of fixtures) {
        test(path.basename(fixture, '.mjs'), () => {
            const source = readFileSync(path.join(fixturesBasePath, fixture), 'utf8');
            const proxy = generateHmrProxy(source, new URL(fixture, 'http://example.com'));

            expect(() => parseModule(proxy)).not.toThrow();
            expect(proxy).toMatchSnapshot();
        });
    }
});
