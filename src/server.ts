'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import sane = require('sane');
import Koa from 'koa';
import route from 'koa-route';
import koaStatic from 'koa-static';
import koaWebsocket = require('koa-websocket');
import * as WebSocket from 'ws';
import { generateProxyMiddleware } from './generateProxyMiddleware';

const enum MessageType {
    CHANGE = 'change'
}

interface Message {
    type: MessageType.CHANGE;
    url: string;
    mtime: number;
}

const examplePath = path.resolve(__dirname, '..', 'example');
const clientPath = path.resolve(__dirname, '..', 'client', 'client.mjs');

class Server {
    private sockets: Set<WebSocket>;
    private app: koaWebsocket.App;

    constructor() {
        this.sockets = new Set();
        this.app = koaWebsocket(new Koa());
    }

    async start() {
        this.app.use(
            route.get('/@hmr', context => {
                context.response.type = 'application/javascript';
                context.response.body = fs.createReadStream(clientPath);
            })
        );
        this.app.ws.use(
            route.all('/@hmr/socket', context => {
                const websocket = (context as koaWebsocket.MiddlewareContext).websocket;
                this.sockets.add(websocket);
                websocket.on('close', () => {
                    console.log('socket disconnected');
                    this.sockets.delete(websocket);
                });
            })
        );
        this.app.use(generateProxyMiddleware({ rootPath: examplePath }));
        this.app.use(koaStatic(examplePath));
        await this.app.listen(8080);

        const watcher = sane(examplePath);
        watcher.on('change', (filepath, root, stat) => {
            this.broadcast({
                type: MessageType.CHANGE,
                // TODO: generate from config
                url: `http://localhost:8080/${filepath}`,
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
