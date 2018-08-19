class HMRClient {
    constructor() {
        this.modules = new Map();
        this.updateListener = null;
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
            reloadPage();
            return;
        }
        const updatedExports = await import(`${url}?mtime=${mtime}`);
        if (exportsChanged(module.exportNames, Object.keys(updatedExports))) {
            reloadPage();
            return;
        }

        module.update(updatedExports);

        if (!this.updateListener) {
            reloadPage();
            return;
        }

        this.updateListener();
    }

    registerModule(url, exportNames, update) {
        this.modules.set(url, {
            exportNames,
            update
        });
    }

    onUpdate(callback) {
        this.updateListener = callback;
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

export { client };
