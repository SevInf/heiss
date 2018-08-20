import { createText } from './createText.mjs';
import { hot } from '/@hmr';

createText();

hot(import.meta.url).accept(['./createText.mjs'], () => {
    createText();
});
