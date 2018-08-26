import { createText, removeText } from './createText.mjs';
import { hot } from '/@hmr/api';

createText();

hot(import.meta.url)
    .dispose(() => removeText())
    .selfAccept();
