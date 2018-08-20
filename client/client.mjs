class HMRClient {
    constructor() {
        this.modules = new Map();
        this.acceptListeners = new Map();
        // module graph where key is module url and
        // value is a set of all the modules who import it
        this.reverseModuleGraph = new Map();
    }

    connect() {
        const websocket = new WebSocket('ws://localhost:8080/@hmr/socket');
        websocket.addEventListener('message', event => {
            const parsed = JSON.parse(event.data);
            switch (parsed.type) {
                case 'change':
                    this.check(parsed);
                    break;
            }
        });
    }

    async check({ url, mtime }) {
        const module = this.modules.get(url);
        if (!module) {
            // if module was not loaded, we don't need to reload anything
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
        acceptCallback();
    }

    async reloadModule(url, mtime) {
        const module = this.modules.get(url);
        const updatedExports = await import(`${url}?mtime=${mtime}`);
        if (exportsChanged(module.exportNames, Object.keys(updatedExports))) {
            return false;
        }
        if (typeof module.update === 'function') {
            module.update(updatedExports);
        }
        return true;
    }

    findModulesForUpdate(changedModuleUrl, visited = new Set()) {
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

    registerModule(url, exportNames, imports, update) {
        for (const importName of imports) {
            this.registerModuleParent(importName, url);
        }
        this.modules.set(url, {
            exportNames,
            update
        });
    }

    registerModuleParent(root, parent) {
        if (!this.reverseModuleGraph.has(root)) {
            this.reverseModuleGraph.set(root, new Set());
        }
        this.reverseModuleGraph.get(root).add(parent);
    }

    accept(moduleUrl, callback) {
        this.acceptListeners.set(moduleUrl, callback);
    }
}

function reloadPage() {
    window.location.reload();
}

function exportsChanged(originalExports, newExports) {
    if (originalExports.length !== newExports.length) {
        return true;
    }
    return !originalExports.every(name => newExports.includes(name));
}

const client = new HMRClient();
client.connect();

function hot(moduleUrl) {
    return {
        accept(dependecies, callback) {
            for (const dependecy of dependecies) {
                client.accept(new URL(dependecy, moduleUrl).href, callback);
            }
        }
    };
}

export { client, hot };
