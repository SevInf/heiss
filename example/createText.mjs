import { text } from './text.mjs';
import { hot } from '/@hmr';

export function createText() {
    const header = document.createElement('h1');
    header.textContent = text;
    document.body.appendChild(header);
}

export function removeText() {
    const header = document.querySelector('h1');
    document.body.removeChild(header);
}
