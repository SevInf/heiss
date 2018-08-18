import { createText } from './createText.mjs';
import { client } from '/@hmr';

createText();

client.onUpdate(() => {
    createText();
});
