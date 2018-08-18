import fs from 'fs-extra';
import * as path from 'path';
import send from 'koa-send';
import { Middleware } from 'koa';
import { generateHmrProxy } from './generateHmrProxy';

interface Options {
    rootPath: string;
}
export function generateProxyMiddleware(options: Options): Middleware {
    return async (context, next) => {
        const requestPath = context.request.path;
        if (!/\.(js|mjs)$/.test(requestPath)) {
            return next();
        }
        const filePath = path.join(options.rootPath, requestPath);

        if (context.request.query.mtime) {
            await send(context, requestPath, {
                root: options.rootPath
            });
            return;
        }

        let content;
        try {
            content = await fs.readFile(filePath, 'utf8');
        } catch (e) {
            if (e.code === 'ENOENT') {
                return next();
            }
            throw e;
        }

        context.response.set('Content-Type', 'application/javascript');
        context.response.body = generateHmrProxy(content, context.request.url);
    };
}
