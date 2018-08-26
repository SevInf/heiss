import { Message, MessageType } from '../server/message';
import { ModuleRegistry, NotificationCallback } from './ModuleRegistry';
import { HotModule, ModuleUpdater } from './HotModule';

const registry = new ModuleRegistry({
    fullReload: () => window.location.reload(),
    moduleLoader: url => import(url),
    moduleFactory(url: string, exportNames: string[], updateExports?: ModuleUpdater) {
        return new HotModule(url, exportNames, updateExports);
    }
});

const websocket = new WebSocket(__WEBSOCKET_URL__);
websocket.addEventListener('message', event => {
    const parsed = JSON.parse(event.data);
    switch (parsed.type) {
        case MessageType.CHANGE:
            registry.update(parsed.url, parsed.mtime);
            break;
    }
});

function hot(moduleUrl: string) {
    const originalModuleUrl = getOriginalUrl(moduleUrl);
    return {
        accept(dependecies: string[], callback: NotificationCallback) {
            for (const dependecy of dependecies) {
                registry.accept(new URL(dependecy, originalModuleUrl).href, callback);
            }
            return this;
        },

        dispose(callback: NotificationCallback) {
            registry.dispose(originalModuleUrl, callback);
            return this;
        },

        selfAccept() {
            // tslint:disable-next-line:no-empty
            registry.accept(originalModuleUrl, () => {});
            return this;
        }
    };
}

function getOriginalUrl(url: string): string {
    const urlObject = new URL(url);
    urlObject.searchParams.delete('mtime');
    return urlObject.href;
}

export { registry as client, hot };
