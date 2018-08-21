# Hot module reloading with native modules

## Browser support

For demo to work properly, you'll need the browser which natively supports:
* [ES2015 modules](https://caniuse.com/#feat=es6-module)
* [Dynamic import](https://caniuse.com/#feat=es6-module-dynamic-import)
* `import.meta`

## Testing

```
npm install
npm start
```

After that, open http://localhost:8080 in any supported browser support and edit 'example/text.mjs'

## Warning

This is a prototype. Expect a lot of things to be broken.