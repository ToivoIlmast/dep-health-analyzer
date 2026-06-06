const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve('static/assets');
const target = path.resolve('dist/assets');

fs.mkdirSync(target, { recursive: true });

for (const file of fs.readdirSync(source)) {
    fs.copyFileSync(path.join(source, file), path.join(target, file));
}

console.log('Assets copied');
