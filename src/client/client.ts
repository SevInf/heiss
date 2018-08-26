import { Message, MessageType } from '../server/message';

type AcceptListener = () => void;
type DisposeListener = () => void;
type ModuleUpdater = (newExports: any) => void;

interface Module {
    exportNames: Array<string>;
    isReloadable: boolean;
    update?: (newExports: any) => void;
}

class HMRClient {
    private modules: Map<string, Module> = new Map();
    private acceptListeners: Map<string, AcceptListener> = new Map();
    private disposeListeners: Map<string, DisposeListener> = new Map();

    // module graph where key is module url and
    // value is a set of all the modules who import it
    private reverseModuleGraph: Map<string, Set<string>> = new Map();

    connect() {
        const websocket = new WebSocket(__WEBSOCKET_URL__);
        websocket.addEventListener('message', event => {
            const parsed = JSON.parse(event.data);
            switch (parsed.type) {
                case MessageType.CHANGE:
                    this.check(parsed);
                    break;
            }
        });
    }

    async check({ url, mtime }: Message) {
        const module = this.modules.get(url);
        if (!module) {
            // if module was not loaded, we don't need to reload anything
            return;
        }
        if (!module.isReloadable) {
            reloadPage();
            return;
        }

        const toReload = this.findModulesForUpdate(url);
        if (!toReload) {
            reloadPage();
            return;
        }
        for (const moduleToReload of toReload) {
            if (!(await this.reloadModule(moduleToReload, mtime))) {
                reloadPage();
                return;
            }
        }

        const acceptCallback = this.acceptListeners.get(toReload[toReload.length - 1]);
        acceptCallback!();
    }

    private async reloadModule(url: string, mtime: number) {
        const module = this.modules.get(url);
        if (!module) {
            return false;
        }
        const dispose = this.disposeListeners.get(url);
        if (dispose) {
            dispose();
            this.disposeListeners.delete(url);
        }
        const updatedExports = await import(`${url}?mtime=${mtime}`);
        if (exportsChanged(module.exportNames, Object.keys(updatedExports))) {
            return false;
        }
        if (typeof module.update === 'function') {
            module.update(updatedExports);
        }
        return true;
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

    registerModule(url: string, exportNames: Array<string>, imports: Array<string>, update?: ModuleUpdater) {
        for (const importName of imports) {
            this.registerModuleParent(importName, url);
        }
        this.modules.set(url, {
            exportNames,
            isReloadable: true,
            update
        });
    }

    registerNonReloadableModule(url: string) {
        this.modules.set(url, {
            exportNames: [],
            isReloadable: false
        });
    }

    private registerModuleParent(root: string, parent: string) {
        let parents = this.reverseModuleGraph.get(root);
        if (!parents) {
            parents = new Set();
            this.reverseModuleGraph.set(root, parents);
        }
        parents.add(parent);
    }

    accept(moduleUrl: string, callback: AcceptListener) {
        this.acceptListeners.set(moduleUrl, callback);
    }

    dispose(moduleUrl: string, callback: DisposeListener) {
        this.disposeListeners.set(moduleUrl, callback);
    }
}

function reloadPage() {
    window.location.reload();
}

function exportsChanged(originalExports: string[], newExports: string[]): boolean {
    if (originalExports.length !== newExports.length) {
        return true;
    }
    return !originalExports.every(name => newExports.includes(name));
}

const client = new HMRClient();
client.connect();

function hot(moduleUrl: string) {
    const originalModuleUrl = getOriginalUrl(moduleUrl);
    return {
        accept(dependecies: string[], callback: AcceptListener) {
            for (const dependecy of dependecies) {
                client.accept(new URL(dependecy, originalModuleUrl).href, callback);
            }
            return this;
        },

        dispose(callback: DisposeListener) {
            client.dispose(originalModuleUrl, callback);
            return this;
        },

        selfAccept() {
            client.accept(originalModuleUrl, () => {});
            return this;
        }
    };
}

function getOriginalUrl(url: string): string {
    const urlObject = new URL(url);
    urlObject.searchParams.delete('mtime');
    return urlObject.href;
}

export { client, hot };
