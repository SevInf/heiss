import fs from 'fs-extra';
import * as path from 'path';

const clientPath = path.resolve(__dirname, '..', 'client', 'client.js');
export async function getClientCode(websocketUrl: string): Promise<string> {
    const code = await fs.readFile(clientPath, 'utf8');
    return code.replace('__WEBSOCKET_URL__', JSON.stringify(websocketUrl));
}
