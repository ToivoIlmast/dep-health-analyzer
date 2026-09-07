import { freshRepo, write, move, commit, writePackageJson, writeDepHealthConfig, writeTsconfig, gitignoreNodeModules } from './test-projects-toolkit.mjs';

function genHistoryLaboratory() {
    const dir = freshRepo('history-laboratory');
    writePackageJson(dir, { name: 'history-laboratory', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir, {
        features: {
            regression: { enabled: true, history: { enabled: true, sampleSize: 12 }, typescript: { includeTypeOnlyImports: false } },
            scc: { enabled: true, typescript: { includeTypeOnlyImports: false } },
        },
    });

    // 01 - clean baseline
    write(dir, 'src/core/logger.ts', `export function log(msg: string): void {\n    console.log(msg);\n}\n`);
    commit(dir, '01: clean baseline - a single logger module');

    // 02 - add module
    write(dir, 'src/models/user.ts', `export interface User {\n    id: number;\n    name: string;\n}\n`);
    commit(dir, '02: add module - User model, unrelated to logger so far');

    // 03 - add dependency
    write(dir, 'src/services/userService.ts', `import type { User } from '../models/user';\nimport { log } from '../core/logger';\n\nexport function createUser(id: number, name: string): User {\n    log('creating user');\n    return { id, name };\n}\n`);
    commit(dir, '03: add dependency - userService depends on both models/user and core/logger');

    // 04 - introduce cycle
    write(dir, 'src/services/orderService.ts', `import { createUser } from './userService';\n\nexport function placeOrder(userId: number, item: string) {\n    return { user: createUser(userId, 'unknown'), item };\n}\n`);
    write(dir, 'src/services/userService.ts', `import type { User } from '../models/user';\nimport { log } from '../core/logger';\nimport { placeOrder } from './orderService';\n\nexport function createUser(id: number, name: string): User {\n    log('creating user');\n    void placeOrder;\n    return { id, name };\n}\n`);
    commit(dir, '04: introduce cycle - userService <-> orderService');

    // 05 - remove cycle
    write(dir, 'src/services/userService.ts', `import type { User } from '../models/user';\nimport { log } from '../core/logger';\n\nexport function createUser(id: number, name: string): User {\n    log('creating user');\n    return { id, name };\n}\n`);
    commit(dir, '05: remove cycle - userService no longer references orderService');

    // 06 - add type-only dependency
    write(dir, 'src/dto/orderDto.ts', `import type { User } from '../models/user';\n\nexport interface OrderDto {\n    user: User;\n    item: string;\n}\n`);
    commit(dir, '06: add type-only dependency - dto/orderDto depends on models/user only via `import type`');

    // 07 - move files
    move(dir, 'src/models/user.ts', 'src/domain/models/user.ts');
    write(dir, 'src/services/userService.ts', `import type { User } from '../domain/models/user';\nimport { log } from '../core/logger';\n\nexport function createUser(id: number, name: string): User {\n    log('creating user');\n    return { id, name };\n}\n`);
    write(dir, 'src/dto/orderDto.ts', `import type { User } from '../domain/models/user';\n\nexport interface OrderDto {\n    user: User;\n    item: string;\n}\n`);
    commit(dir, '07: move files - models/user.ts relocated under domain/models/');

    // 08 - introduce cross-directory dependency
    write(dir, 'src/features/reporting/userReport.ts', `import { log } from '../../core/logger';\nimport { createUser } from '../../services/userService';\n\nexport function reportOnNewUser(id: number, name: string) {\n    log('reporting');\n    return createUser(id, name);\n}\n`);
    commit(dir, '08: introduce cross-directory dependency - features/reporting reaches into both core and services');

    // 09 - refactor
    write(dir, 'src/services/userService.ts', `import type { User } from '../domain/models/user';\nimport { log } from '../core/logger';\n\nexport function createUser(id: number, name: string): User {\n    log('creating user: ' + name);\n    return { id, name };\n}\n\nexport function renameUser(user: User, name: string): User {\n    log('renaming user');\n    return { ...user, name };\n}\n`);
    commit(dir, '09: refactor - userService gains renameUser, no new cross-file dependency');

    // 10 - introduce several findings (a batch of new cross-directory/deep reaches at once)
    write(dir, 'src/services/orderService.ts', `import { createUser } from './userService';\nimport type { OrderDto } from '../dto/orderDto';\nimport { log } from '../core/logger';\n\nexport function placeOrder(userId: number, item: string): OrderDto {\n    log('placing order');\n    return { user: createUser(userId, 'unknown'), item };\n}\n`);
    write(dir, 'src/features/orders/orderSummary.ts', `import type { OrderDto } from '../../dto/orderDto';\nimport { placeOrder } from '../../services/orderService';\n\nexport function summarize(userId: number, item: string): OrderDto {\n    return placeOrder(userId, item);\n}\n`);
    write(dir, 'src/features/reporting/orderReport.ts', `import { placeOrder } from '../../services/orderService';\n\nexport function reportOnOrder(userId: number, item: string) {\n    return placeOrder(userId, item);\n}\n`);
    commit(dir, '10: introduce several findings at once - orderService reconnected, two new features added in one batch');

    // 11 - remove some findings
    write(dir, 'src/features/reporting/orderReport.ts', `export function reportOnOrder(userId: number, item: string) {\n    return { userId, item };\n}\n`);
    commit(dir, '11: remove some findings - orderReport no longer depends on services/orderService');

    // 12 - additional structural changes
    write(dir, 'src/domain/models/order.ts', `import type { User } from './user';\n\nexport interface OrderModel {\n    user: User;\n    item: string;\n}\n`);
    write(dir, 'src/dto/orderDto.ts', `import type { OrderModel } from '../domain/models/order';\n\nexport type OrderDto = OrderModel;\n`);
    commit(dir, '12: additional structural changes - dto/orderDto now re-derives from a new domain/models/order type');

    return dir;
}

genHistoryLaboratory();
console.log('Generated: history-laboratory');
