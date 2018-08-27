# heiss

Static server, which implements hot module replacement for native ES2015
modules.

**Warning**: This is an early prototype. It serves more as a playground for
various ideas then as a finished stable tool.

## Limitations

Due to the nature of implementation, it is not possible to hot reload modules in
the following cases:

- export names or their count have changed.
- module, that exports mutable variable bindings (`let` or `const`).

## Requirements

Server part requires node.js 8 or greater.

For the client to work properly, you'll need the browser which natively
supports:

- [ES2015 modules](https://caniuse.com/#feat=es6-module)
- [Dynamic import](https://caniuse.com/#feat=es6-module-dynamic-import)
- `import.meta`

## Command-line

```
heiss <rootDirectory>
```

Starts a static server, serving the files from `<rootDirectory>`. Hot reloading
will be available for every `.js` or `.mjs` file (see limitations sections
above).

You can change hostname or port of the server with `--host` and `--port`
arguments respectively.

## HMR API

API is served as `/@hmr/api` module. The main function you'll need is `hot`. It
accepts current module url as a parameter and returns object with the following
methods:

- `accept(dependencies: string[], updateCallback)` — called when any of the
  specified dependencies change. `dependencies` can be either absolute or
  relative URLs. Inside the `updateCallback` all imports will be already updated
  to their new values, there is no need to re-import anything:

  ```js
  import { init } from './init.mjs';
  import { hot } from '/@hmr/api';

  init();

  hot(import.meta.url).accept(['./init.mjs'], () => {
    init();
  });
  ```

- `selfAccept()` — marks current-module as self-accepting. In this case, current
  module will be automatically re-evaluted when it or any of its dependecies
  change:

  ```js
  import { init } from './init.mjs';
  import { hot } from '/@hmr/api';

  init();

  hot(import.meta.url).selfAccept();
  ```

- `dispose(callback)` — called when current module is about to unload. Can be
  used for cleaning up any side-effects:

  ```js
  import { addWidgetToDocument, removeWidgetFromDocument } from './widget.mjs';
  import { hot } from '/@hmr/api';

  addWidgetToDocument();

  hot(import.meta.url).dispose(() => removeWidgetFromDocument());
  ```

## Example in the repo

```
npm install
npm start
```

After that, open http://localhost:8080 in any supported browser support and edit
'example/text.mjs'
