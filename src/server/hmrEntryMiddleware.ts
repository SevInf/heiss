import fs from 'fs-extra';
import { Middleware } from 'koa';
export interface Options {
    websocketURL: string;
    filePath: string;
}
export function hmrEntryMiddleware(options: Options): Middleware {
    let cachedModule: string | null = null;
    return async context => {
        context.response.type = 'application/javascript';
        if (!cachedModule) {
            cachedModule = await getClientCode(options);
        }
        context.response.body = cachedModule;
    };
}

export async function getClientCode(options: Options): Promise<string> {
    const code = await fs.readFile(options.filePath, 'utf8');
    return code.replace('__WEBSOCKET_URL__', JSON.stringify(options.websocketURL));
}
