const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv').default;
const standaloneCode = require('ajv/dist/standalone').default;

const schemaPath = path.resolve('src/app/config/config.schema.json');
const outputPath = path.resolve('src/app/config/validateConfig.generated.js');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({
    code: { source: true, esm: false },
    allErrors: true,
});

const validate = ajv.compile(schema);
const moduleCode = standaloneCode(ajv, validate);

fs.writeFileSync(outputPath, moduleCode);

console.log('Config validator generated:', outputPath);
