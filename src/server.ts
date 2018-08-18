'use strict';

import * as path from 'path';
import sane = require('sane');
import Koa from 'koa';
import route from 'koa-route';
import koaStatic from 'koa-static';
import koaWebsocket = require('koa-websocket');
import { generateProxyMiddleware } from './generateProxyMiddleware';

const enum MessageType {
    CHANGE = 'change'
}

interface Message {
    type: MessageType.CHANGE;
    url: string;
    mtime: number;
}

class Server {
    // TODO: websocket type
    private sockets: Set<any>;
    private app: koaWebsocket.App;

    constructor() {
        this.sockets = new Set();
        this.app = koaWebsocket(new Koa());
    }

    async start() {
        this.app.ws.use(
            route.all('/__hmr', context => {
                const websocket = (context as koaWebsocket.MiddlewareContext).websocket;
                this.sockets.add(websocket);
                websocket.on('close', () => {
                    console.log('socket disconnected');
                    this.sockets.delete(websocket);
                });
            })
        );

        const staticPath = path.resolve(__dirname, '..', 'static');
        this.app.use(generateProxyMiddleware({ rootPath: staticPath }));
        this.app.use(koaStatic(staticPath));
        await this.app.listen(8080);

        const watcher = sane(staticPath);
        watcher.on('change', (filepath, root, stat) => {
            this.broadcast({
                type: MessageType.CHANGE,
                url: `/${filepath}`,
                mtime: stat.mtimeMs
            });
        });
    }

    broadcast(message: Message) {
        const stringified = JSON.stringify(message);
        for (const socket of this.sockets) {
            socket.send(stringified);
        }
    }
}

const server = new Server();
server.start();
