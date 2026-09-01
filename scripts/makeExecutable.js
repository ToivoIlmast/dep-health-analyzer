const fs = require('node:fs');
const path = require('node:path');

const target = path.resolve('dist/app/cli.js');

fs.chmodSync(target, 0o755);

console.log('Made executable:', target);
