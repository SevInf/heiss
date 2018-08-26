'use strict';

import * as fs from 'fs-extra';
import * as path from 'path';
import { URL } from 'url';
import sane = require('sane');
import Koa from 'koa';
import route from 'koa-route';
import koaStatic from 'koa-static';
import koaWebsocket = require('koa-websocket');
import * as WebSocket from 'ws';
import { generateProxyMiddleware } from './generateProxyMiddleware';
import { getClientCode } from './clientTemplate';
import { Message, MessageType } from './message';

export interface ServerOptions {
    port: number;
    host: string;
    directory: string;
}

export class Server {
    private sockets: Set<WebSocket>;
    private app: koaWebsocket.App;
    private options: ServerOptions;
    private rootURL: URL;

    constructor(options: ServerOptions) {
        this.sockets = new Set();
        this.options = options;
        this.rootURL = new URL(getURLString('http', options));
        this.app = koaWebsocket(new Koa());
    }

    async start() {
        const clientCode = await getClientCode(`ws://${this.options.host}:${this.options.port}/@hmr/socket`);
        this.app.use(
            route.get('/@hmr', context => {
                context.response.type = 'application/javascript';
                context.response.body = clientCode;
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
        this.app.use(generateProxyMiddleware({ rootPath: this.options.directory }));
        this.app.use(koaStatic(this.options.directory));
        await this.app.listen(this.options.port, this.options.host);
        const watcher = sane(this.options.directory);
        watcher.on('change', (filepath, root, stat) => {
            this.broadcast({
                type: MessageType.CHANGE,
                url: this.fileUrl(filepath),
                mtime: stat.mtimeMs
            });
        });
    }

    private fileUrl(filepath: string): string {
        return new URL(filepath, this.rootURL).href;
    }

    broadcast(message: Message) {
        const stringified = JSON.stringify(message);
        for (const socket of this.sockets) {
            socket.send(stringified);
        }
    }
}

function getURLString(protocol: string, options: ServerOptions) {
    return `${protocol}://${options.host}:${options.port}`;
}
