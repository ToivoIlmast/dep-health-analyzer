import { freshRepo, write, remove, move, commit, writePackageJson, writeDepHealthConfig, writeTsconfig, gitignoreNodeModules } from './test-projects-toolkit.mjs';

// ---------------------------------------------------------------------------
// vanilla-js
// ---------------------------------------------------------------------------
function genVanillaJs() {
    const dir = freshRepo('vanilla-js');
    writePackageJson(dir, { name: 'vanilla-js', version: '1.0.0', type: 'module', private: true });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/utils/logger.js', `export function log(message) {\n    console.log('[app]', message);\n}\n`);
    write(dir, 'src/app/index.js', `import { log } from '../utils/logger.js';\n\nexport function start() {\n    log('starting');\n}\n`);
    commit(dir, 'baseline: app entry point and a logging util');

    write(dir, 'src/models/user.js', `export class User {\n    constructor(id, name) {\n        this.id = id;\n        this.name = name;\n    }\n}\n`);
    commit(dir, 'add User model');

    write(
        dir,
        'src/services/userService.js',
        `import { User } from '../models/user.js';\nimport { log } from '../utils/logger.js';\n\nexport function createUser(id, name) {\n    log('creating user ' + id);\n    return new User(id, name);\n}\n`
    );
    commit(dir, 'add userService, depends on User model and logger');

    write(
        dir,
        'src/services/orderService.js',
        `import { userService } from './userServiceFacade.js';\n\nexport function placeOrder(userId, item) {\n    return { userId, item, via: userService };\n}\n`
    );
    write(dir, 'src/services/userServiceFacade.js', `import { placeOrder } from './orderService.js';\n\nexport const userService = 'facade';\nexport { placeOrder as reExportedPlaceOrder };\n`);
    commit(dir, 'introduce a cycle: orderService <-> userServiceFacade');

    write(
        dir,
        'src/services/orderService.js',
        `export function placeOrder(userId, item) {\n    return { userId, item };\n}\n`
    );
    write(dir, 'src/services/userServiceFacade.js', `export const userService = 'facade';\n`);
    commit(dir, 'fix: remove the orderService/userServiceFacade cycle');

    write(
        dir,
        'src/app/index.js',
        `import { log } from '../utils/logger.js';\nimport { createUser } from '../services/userService.js';\n\nexport function start() {\n    log('starting');\n    return createUser(1, 'Ada');\n}\n`
    );
    commit(dir, 'app entry now uses userService directly (cross-directory dependency)');

    move(dir, 'src/utils/logger.js', 'src/utils/logging/logger.js');
    write(
        dir,
        'src/app/index.js',
        `import { log } from '../utils/logging/logger.js';\nimport { createUser } from '../services/userService.js';\n\nexport function start() {\n    log('starting');\n    return createUser(1, 'Ada');\n}\n`
    );
    write(
        dir,
        'src/services/userService.js',
        `import { User } from '../models/user.js';\nimport { log } from '../utils/logging/logger.js';\n\nexport function createUser(id, name) {\n    log('creating user ' + id);\n    return new User(id, name);\n}\n`
    );
    commit(dir, 'refactor: move logger.js into utils/logging/ (deeper path)');

    write(
        dir,
        'src/services/notificationService.js',
        `import { log } from '../utils/logging/logger.js';\n\nexport function notify(user, message) {\n    log('notify ' + user.id + ': ' + message);\n}\n`
    );
    write(
        dir,
        'src/services/orderService.js',
        `import { notify } from './notificationService.js';\n\nexport function placeOrder(user, item) {\n    notify(user, 'order placed for ' + item);\n    return { user, item };\n}\n`
    );
    commit(dir, 'add notificationService; orderService now notifies on placement');

    return dir;
}

// ---------------------------------------------------------------------------
// vanilla-ts
// ---------------------------------------------------------------------------
function genVanillaTs() {
    const dir = freshRepo('vanilla-ts');
    writePackageJson(dir, { name: 'vanilla-ts', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir, {
        features: {
            regression: { enabled: true, history: { enabled: true, sampleSize: 10 }, typescript: { includeTypeOnlyImports: false } },
            scc: { enabled: true, typescript: { includeTypeOnlyImports: false } },
        },
    });

    write(dir, 'src/types/common.ts', `export interface Identifiable {\n    id: number;\n}\n\nexport type Id = number;\n`);
    write(
        dir,
        'src/models/user.ts',
        `import type { Identifiable } from '../types/common';\n\nexport interface User extends Identifiable {\n    name: string;\n}\n\nexport function makeUser(id: number, name: string): User {\n    return { id, name };\n}\n`
    );
    commit(dir, 'baseline: common types and User model');

    write(
        dir,
        'src/services/userService.ts',
        `import { makeUser, User } from '../models/user';\n\nexport function createUser(id: number, name: string): User {\n    return makeUser(id, name);\n}\n`
    );
    commit(dir, 'add userService (runtime dependency on models/user)');

    write(dir, 'src/types/order.ts', `export interface OrderShape {\n    userId: number;\n    item: string;\n}\n`);
    write(
        dir,
        'src/services/orderService.ts',
        `import type { OrderShape } from '../types/order';\n\nexport function placeOrder(order: OrderShape): OrderShape {\n    return order;\n}\n`
    );
    commit(dir, 'add order type + orderService - pure type-only dependency on types/order');

    write(dir, 'src/types/a.ts', `import type { B } from './b';\n\nexport interface A {\n    b?: B;\n}\n`);
    write(dir, 'src/types/b.ts', `import type { A } from './a';\n\nexport interface B {\n    a?: A;\n}\n`);
    commit(dir, 'introduce a type-only cycle between types/a and types/b');

    write(
        dir,
        'src/services/mixedService.ts',
        `import { createUser } from './userService';\nimport type { OrderShape } from '../types/order';\n\nexport function summarize(order: OrderShape) {\n    const user = createUser(order.userId, 'unknown');\n    return { user, item: order.item };\n}\n`
    );
    commit(dir, 'add mixedService combining a runtime import and a type-only import');

    write(
        dir,
        'src/services/notificationService.ts',
        `import { User } from '../models/user';\n\nexport function notify(user: User, message: string): void {\n    void user;\n    void message;\n}\n`
    );
    write(
        dir,
        'src/services/orderService.ts',
        `import type { OrderShape } from '../types/order';\nimport { notify } from './notificationService';\nimport { createUser } from './userService';\n\nexport function placeOrder(order: OrderShape): OrderShape {\n    notify(createUser(order.userId, 'unknown'), 'placed');\n    return order;\n}\n`
    );
    commit(dir, 'orderService gains a real runtime dependency alongside its type-only one');

    write(dir, 'src/app/index.ts', `import { summarize } from '../services/mixedService';\n\nexport function run() {\n    return summarize({ userId: 1, item: 'widget' });\n}\n`);
    commit(dir, 'add app entry point depending on services (cross-directory)');

    return dir;
}

// ---------------------------------------------------------------------------
// node-commonjs
// ---------------------------------------------------------------------------
function genNodeCommonJs() {
    const dir = freshRepo('node-commonjs');
    writePackageJson(dir, { name: 'node-commonjs', version: '1.0.0', private: true });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/utils/logger.js', `function log(message) {\n    console.log('[cjs]', message);\n}\n\nmodule.exports = { log };\n`);
    write(dir, 'src/index.js', `const { log } = require('./utils/logger');\n\nfunction start() {\n    log('starting commonjs app');\n}\n\nmodule.exports = { start };\n`);
    commit(dir, 'baseline: CommonJS entry point + logger util');

    write(dir, 'src/services/userService.js', `const { log } = require('../utils/logger');\n\nfunction createUser(id, name) {\n    log('creating user ' + id);\n    return { id, name };\n}\n\nmodule.exports = { createUser };\n`);
    commit(dir, 'add userService using require()');

    write(
        dir,
        'src/services/orderService.js',
        `const { createUser } = require('./userService');\n\nfunction placeOrder(userId, item) {\n    const user = createUser(userId, 'unknown');\n    return { user, item };\n}\n\nmodule.exports = { placeOrder };\n`
    );
    commit(dir, 'add orderService depending on userService');

    write(
        dir,
        'src/index.js',
        `const { log } = require('./utils/logger');\nconst { placeOrder } = require('./services/orderService');\n\nfunction start() {\n    log('starting commonjs app');\n    return placeOrder(1, 'widget');\n}\n\nmodule.exports = { start };\n`
    );
    commit(dir, 'entry point now uses orderService (cross-directory require)');

    return dir;
}

// ---------------------------------------------------------------------------
// node-esm
// ---------------------------------------------------------------------------
function genNodeEsm() {
    const dir = freshRepo('node-esm');
    writePackageJson(dir, { name: 'node-esm', version: '1.0.0', private: true, type: 'module' });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/utils/logger.js', `export function log(message) {\n    console.log('[esm]', message);\n}\n`);
    write(dir, 'src/index.js', `import { log } from './utils/logger.js';\n\nexport function start() {\n    log('starting native esm app');\n}\n`);
    commit(dir, 'baseline: native ESM entry point + logger');

    write(
        dir,
        'src/services/userService.js',
        `import { log } from '../utils/logger.js';\n\nexport function createUser(id, name) {\n    log('creating user ' + id);\n    return { id, name };\n}\n`
    );
    commit(dir, 'add userService');

    write(
        dir,
        'src/services/orderService.js',
        `import { createUser } from './userService.js';\n\nexport function placeOrder(userId, item) {\n    return { user: createUser(userId, 'unknown'), item };\n}\n`
    );
    commit(dir, 'add orderService depending on userService');

    remove(dir, 'src/services/userService.js');
    write(
        dir,
        'src/services/user/userService.js',
        `import { log } from '../../utils/logger.js';\n\nexport function createUser(id, name) {\n    log('creating user ' + id);\n    return { id, name };\n}\n`
    );
    write(
        dir,
        'src/services/orderService.js',
        `import { createUser } from './user/userService.js';\n\nexport function placeOrder(userId, item) {\n    return { user: createUser(userId, 'unknown'), item };\n}\n`
    );
    commit(dir, 'refactor: move userService.js into services/user/ subfolder');

    return dir;
}

genVanillaJs();
genVanillaTs();
genNodeCommonJs();
genNodeEsm();
console.log('Generated: vanilla-js, vanilla-ts, node-commonjs, node-esm');
