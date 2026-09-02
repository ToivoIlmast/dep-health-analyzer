const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve('src/app/config/validateConfig.generated.js');
const target = path.resolve('dist/app/config/validateConfig.generated.js');

fs.copyFileSync(source, target);

console.log('Config validator copied to dist:', target);
