import { generateHmrProxy } from '../src/generateHmrProxy';
import { readdirSync, readFileSync } from 'fs';
import { parse } from 'acorn';
import * as path from 'path';

describe('generateHmrProxy', () => {
    const fixturesBasePath = path.join(__dirname, 'fixtures', 'generateHmrProxy');
    const fixtures = readdirSync(fixturesBasePath);

    for (const fixture of fixtures) {
        test(path.basename(fixture, '.mjs'), () => {
            const source = readFileSync(path.join(fixturesBasePath, fixture), 'utf8');
            const proxy = generateHmrProxy(source, `/${fixture}`);

            expect(() => parse(proxy, { sourceType: 'module' })).not.toThrow();
            expect(proxy).toMatchSnapshot();
        });
    }
});
