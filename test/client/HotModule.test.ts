import { HotModule, ReloadResult } from '../../src/client/HotModule';

const moduleUrl = 'http://example.com/module1.mjs';

describe('HotModule', () => {
    function mockLoader(exports = {}) {
        return jest.fn().mockResolvedValue(exports);
    }

    it('does not reload if it is marked as non-reloadable', async () => {
        const module = new HotModule(moduleUrl, []);
        module.markAsNonReloadable();

        const loader = mockLoader();

        expect(await module.reload(123, loader)).toBe(ReloadResult.FAILED);
        expect(loader).not.toBeCalled();
    });

    it('calls dispose listener', async () => {
        const module = new HotModule(moduleUrl, []);
        const dispose = jest.fn();

        await module.reload(123, mockLoader(), dispose);

        expect(dispose).toBeCalled();
    });

    it('reloads the module with the new mtime', async () => {
        const module = new HotModule(moduleUrl, []);
        const loader = mockLoader();

        await module.reload(123, loader);

        expect(loader).toBeCalledWith(`${moduleUrl}?mtime=123`);
    });

    it('does not updates the export and fails when exports change', async () => {
        const updateExports = jest.fn();
        const module = new HotModule(moduleUrl, ['oldName'], updateExports);
        const loader = mockLoader({ newName: 'value' });

        expect(await module.reload(123, loader)).toBe(ReloadResult.FAILED);
        expect(updateExports).not.toBeCalled();
    });

    it('does not updates the export and fails when exports count change', async () => {
        const updateExports = jest.fn();
        const module = new HotModule(moduleUrl, ['exportName'], updateExports);
        const newExports = { exportName: 'value', otherExportName: 'value' };
        const loader = mockLoader(newExports);

        expect(await module.reload(123, loader)).toBe(ReloadResult.FAILED);
        expect(updateExports).not.toBeCalled();
    });

    it('updates the exports and succeeds when export names stayed the same', async () => {
        const updateExports = jest.fn();
        const module = new HotModule(moduleUrl, ['exportName'], updateExports);
        const newExports = { exportName: 'value' };
        const loader = mockLoader(newExports);

        expect(await module.reload(123, loader)).toBe(ReloadResult.UPDATED);
        expect(updateExports).toBeCalledWith(newExports);
    });

    it('skips the update (but does not fail) when mtimes did not change', async () => {
        const module = new HotModule(moduleUrl, []);

        const loader = mockLoader();
        await module.reload(123, loader);
        loader.mockReset();

        expect(await module.reload(123, loader)).toBe(ReloadResult.UP_TO_DATE);
        expect(loader).not.toBeCalled();
    });
});
