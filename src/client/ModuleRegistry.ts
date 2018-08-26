import { IHotModule, ModuleLoader, ModuleUpdater, DisposeListener, ReloadResult } from './HotModule';
export type NotificationCallback = () => void;

type ModuleFactory = (url: string, exportNames: string[], updateExports?: ModuleUpdater) => IHotModule;
export interface RegistryOptions {
    fullReload: NotificationCallback;
    moduleLoader: ModuleLoader;
    moduleFactory: ModuleFactory;
}

export class ModuleRegistry {
    private modules: Map<string, IHotModule> = new Map();

    // accept and dispose listeners are stored outside of module class
    // because they can be set before module is registred
    private acceptListeners: Map<string, NotificationCallback> = new Map();
    private disposeListeners: Map<string, DisposeListener> = new Map();

    // module graph where key is module url and
    // value is a set of all the modules who import it
    private reverseModuleGraph: Map<string, Set<string>> = new Map();
    private fullReload: NotificationCallback;
    private moduleLoader: ModuleLoader;
    private moduleFactory: ModuleFactory;

    constructor(options: RegistryOptions) {
        this.fullReload = options.fullReload;
        this.moduleLoader = options.moduleLoader;
        this.moduleFactory = options.moduleFactory;
    }

    async update(url: string, mtime: number) {
        const module = this.modules.get(url);
        if (!module) {
            // if module was not loaded, we don't need to reload anything
            return;
        }

        const toReload = this.findModulesForUpdate(url);
        if (!toReload) {
            this.fullReload();
            return;
        }
        for (const moduleToReload of toReload) {
            const reloadResult = await this.reloadModule(moduleToReload, mtime);
            if (reloadResult === ReloadResult.FAILED) {
                this.fullReload();
                return;
            }
        }

        const acceptCallback = this.acceptListeners.get(toReload[toReload.length - 1]);
        acceptCallback!();
    }

    private findModulesForUpdate(changedModuleUrl: string, visited: Set<string> = new Set()): string[] | null {
        if (visited.has(changedModuleUrl)) {
            return null;
        }
        visited.add(changedModuleUrl);
        if (this.acceptListeners.has(changedModuleUrl)) {
            return [changedModuleUrl];
        }
        const parents = this.reverseModuleGraph.get(changedModuleUrl);
        if (!parents) {
            return null;
        }
        for (const parent of parents) {
            const parentUpdates = this.findModulesForUpdate(parent, visited);
            if (parentUpdates) {
                return [changedModuleUrl, ...parentUpdates];
            }
        }
        return null;
    }

    private async reloadModule(moduleUrl: string, mtime: number): Promise<ReloadResult> {
        const module = this.modules.get(moduleUrl);
        if (!module) {
            return ReloadResult.FAILED;
        }

        const result = module.reload(mtime, this.moduleLoader, this.disposeListeners.get(moduleUrl));
        this.disposeListeners.delete(moduleUrl);
        return result;
    }

    registerModule(url: string, exportNames: string[], imports: string[], update?: ModuleUpdater): IHotModule {
        for (const importName of imports) {
            this.registerModuleParent(importName, url);
        }
        const module = this.moduleFactory(url, exportNames, update);
        this.modules.set(url, module);
        return module;
    }

    private registerModuleParent(root: string, parent: string) {
        let parents = this.reverseModuleGraph.get(root);
        if (!parents) {
            parents = new Set();
            this.reverseModuleGraph.set(root, parents);
        }
        parents.add(parent);
    }

    accept(moduleUrl: string, callback: NotificationCallback) {
        this.acceptListeners.set(moduleUrl, callback);
    }

    dispose(moduleUrl: string, callback: DisposeListener) {
        this.disposeListeners.set(moduleUrl, callback);
    }
}
