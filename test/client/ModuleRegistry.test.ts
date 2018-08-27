import { ModuleRegistry } from '../../src/client/ModuleRegistry';
import { IHotModule, ReloadResult } from '../../src/client/HotModule';

const moduleUrl1 = 'http://example.com/module1.mjs';
const moduleUrl2 = 'http://example.com/module2.mjs';

describe('module registry', () => {
    let fullReload;
    let moduleLoader;
    let registry;
    beforeEach(() => {
        fullReload = jest.fn();
        moduleLoader = jest.fn().mockResolvedValue({});
        registry = new ModuleRegistry({
            fullReload,
            moduleLoader,
            moduleFactory(url) {
                const module: IHotModule = {
                    markAsNonReloadable: jest.fn(),
                    reload: jest.fn()
                };
                return module;
            }
        });
    });

    it('does not do anything when module is not registred', async () => {
        await registry.update(moduleUrl1, 123);

        expect(fullReload).not.toBeCalled();
        expect(moduleLoader).not.toBeCalled();
    });

    it('does full page reload when there is no accept handler', async () => {
        registry.registerModule(moduleUrl1, [], []);
        await registry.update(moduleUrl1, 123);

        expect(fullReload).toBeCalled();
    });

    it('does not do full page reload when there is an accept listener', async () => {
        registry.registerModule(moduleUrl1, [], []);
        registry.accept(moduleUrl1, jest.fn());
        await registry.update(moduleUrl1, 123);

        expect(fullReload).not.toBeCalled();
    });

    it('reloads module when there is an accept listener', async () => {
        const module = registry.registerModule(moduleUrl1, [], []);
        registry.accept(moduleUrl1, jest.fn());
        await registry.update(moduleUrl1, 123);

        expect(module.reload).toBeCalledWith(123, moduleLoader, undefined);
    });

    it('calls dispose listener during reload', async () => {
        const module = registry.registerModule(moduleUrl1, [], []);
        const disposeMock = jest.fn();

        module.reload.mockImplementation((mtime, loader, dispose) => dispose());
        registry.dispose(moduleUrl1, disposeMock);
        registry.accept(moduleUrl1, jest.fn());
        await registry.update(moduleUrl1, 123);

        expect(disposeMock).toHaveBeenCalledTimes(1);
    });

    it('removes dispose listener after calling it', async () => {
        const module = registry.registerModule(moduleUrl1, [], []);
        module.reload.mockImplementationOnce((mtime, loader, dispose) => dispose());
        registry.dispose(moduleUrl1, jest.fn());
        registry.accept(moduleUrl1, jest.fn());

        await registry.update(moduleUrl1, 123);
        await registry.update(moduleUrl1, 321);

        expect(module.reload).toHaveBeenLastCalledWith(321, moduleLoader, undefined);
    });

    it('preserves dispose listener, added during reload', async () => {
        const module = registry.registerModule(moduleUrl1, [], []);

        const disposeMock = jest.fn();
        module.reload.mockImplementation((mtime, loader, dispose) => {
            dispose();
            registry.dispose(moduleUrl1, disposeMock);
        });
        registry.dispose(moduleUrl1, disposeMock);
        registry.accept(moduleUrl1, jest.fn());
        await registry.update(moduleUrl1, 123);
        await registry.update(moduleUrl1, 321);

        expect(disposeMock).toHaveBeenCalledTimes(2);
    });

    it('does full page reload when module reload fails', async () => {
        const module = registry.registerModule(moduleUrl1, [], []);
        module.reload.mockResolvedValue(ReloadResult.FAILED);
        registry.accept(moduleUrl1, jest.fn());

        await registry.update(moduleUrl1, 123);

        expect(fullReload).toBeCalled();
    });

    it('does not call accept when module reload fails', async () => {
        const module = registry.registerModule(moduleUrl1, [], []);
        const accept = jest.fn();
        module.reload.mockResolvedValue(ReloadResult.FAILED);
        registry.accept(moduleUrl1, accept);

        await registry.update(moduleUrl1, 123);

        expect(accept).not.toBeCalled();
    });

    it('calls accept when module reload succeds', async () => {
        const module = registry.registerModule(moduleUrl1, [], []);
        const accept = jest.fn();
        module.reload.mockResolvedValue(ReloadResult.UPDATED);
        registry.accept(moduleUrl1, accept);

        await registry.update(moduleUrl1, 123);

        expect(accept).toBeCalled();
    });

    it('updates the parent if it has an accept listener', async () => {
        const module1 = registry.registerModule(moduleUrl1, [], [moduleUrl2]);
        module1.reload.mockResolvedValue(ReloadResult.UPDATED);
        const module2 = registry.registerModule(moduleUrl2, [], []);
        module2.reload.mockResolvedValue(ReloadResult.UPDATED);

        const accept = jest.fn();
        registry.accept(moduleUrl1, accept);

        await registry.update(moduleUrl2, 123);

        expect(module2.reload).toBeCalled();
        expect(module1.reload).toBeCalled();
        expect(accept).toBeCalled();
    });

    it('handles circular dependencies', async () => {
        const module1 = registry.registerModule(moduleUrl1, [], [moduleUrl2]);
        const module2 = registry.registerModule(moduleUrl2, [], [moduleUrl1]);

        await registry.update(moduleUrl2, 123);

        expect(fullReload).toBeCalled();
    });
});
