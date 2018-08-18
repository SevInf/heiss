import fs from 'fs-extra';
import * as path from 'path';
import { Middleware } from 'koa';
import { generateHmrProxy } from './generateHmrProxy';

interface Options {
    rootPath: string;
}
export function generateProxyMiddleware(options: Options): Middleware {
    return async (context, next) => {
        const requestPath = context.request.path;
        const filePath = path.join(options.rootPath, requestPath);

        if (requestPath === '/hmr-client.mjs' || context.request.query.mtime) {
            context.response.set('Content-Type', 'application/javascript');
            context.response.body = fs.createReadStream(filePath);
            return;
        }

        let content;
        try {
            content = await fs.readFile(filePath, 'utf8');
        } catch (e) {
            // TODO: enoent only
            return next();
        }

        context.response.set('Content-Type', 'application/javascript');
        context.response.body = generateHmrProxy(content, context.request.url);
    };
}
