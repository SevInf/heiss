import { createText } from './createText.mjs';
import { client } from './hmr-client.mjs';

createText();

client.onUpdate(() => {
    createText();
});
