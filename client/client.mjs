class HMRClient {
    constructor() {
        this.listeners = new Map();
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
        if (!this.listeners.has(url)) {
            window.location.reload();
            return;
        }
        const updatedModule = await import(`${url}?mtime=${mtime}`);
        this.listeners.get(url)(updatedModule);

        // TODO: reload when exports change
        if (!this.updateListener) {
            window.location.reload();
        }

        this.updateListener();
    }

    registerModule(url, callback) {
        this.listeners.set(url, callback);
    }

    onUpdate(callback) {
        this.updateListener = callback;
    }
}

const client = new HMRClient();
client.connect();

export { client };
