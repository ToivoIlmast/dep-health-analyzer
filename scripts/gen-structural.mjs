import { freshRepo, write, move, commit, writePackageJson, writeDepHealthConfig, writeTsconfig, gitignoreNodeModules } from './test-projects-toolkit.mjs';

// ---------------------------------------------------------------------------
// layered-app - fixture name describes SHAPE only, not a claim of correctness
// ---------------------------------------------------------------------------
function genLayeredApp() {
    const dir = freshRepo('layered-app');
    writePackageJson(dir, { name: 'layered-app', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/domain/user.ts', `export interface User {\n    id: number;\n    name: string;\n}\n`);
    write(dir, 'src/infrastructure/userRepository.ts', `import type { User } from '../domain/user';\n\nconst store: User[] = [];\n\nexport function save(user: User): User {\n    store.push(user);\n    return user;\n}\n\nexport function findAll(): User[] {\n    return store;\n}\n`);
    commit(dir, 'baseline: domain/user + infrastructure/userRepository');

    write(dir, 'src/application/createUser.ts', `import type { User } from '../domain/user';\nimport { save } from '../infrastructure/userRepository';\n\nexport function createUser(id: number, name: string): User {\n    return save({ id, name });\n}\n`);
    commit(dir, 'add application/createUser (application -> infrastructure + domain)');

    write(dir, 'src/presentation/userController.ts', `import { createUser } from '../application/createUser';\n\nexport function handleCreateUser(id: number, name: string) {\n    return createUser(id, name);\n}\n`);
    commit(dir, 'add presentation/userController (presentation -> application)');

    write(dir, 'src/domain/order.ts', `import type { User } from './user';\n\nexport interface Order {\n    user: User;\n    total: number;\n}\n`);
    write(dir, 'src/infrastructure/orderRepository.ts', `import type { Order } from '../domain/order';\n\nconst store: Order[] = [];\n\nexport function save(order: Order): Order {\n    store.push(order);\n    return order;\n}\n`);
    write(dir, 'src/application/placeOrder.ts', `import type { Order } from '../domain/order';\nimport { save } from '../infrastructure/orderRepository';\nimport { createUser } from './createUser';\n\nexport function placeOrder(userId: number, total: number): Order {\n    const user = createUser(userId, 'unknown');\n    return save({ user, total });\n}\n`);
    commit(dir, 'add order domain/infra/application, application layer composes two use-cases');

    write(dir, 'src/presentation/orderController.ts', `import { placeOrder } from '../application/placeOrder';\n\nexport function handlePlaceOrder(userId: number, total: number) {\n    return placeOrder(userId, total);\n}\n`);
    commit(dir, 'add presentation/orderController');

    return dir;
}

// ---------------------------------------------------------------------------
// feature-oriented-app
// ---------------------------------------------------------------------------
function genFeatureOrientedApp() {
    const dir = freshRepo('feature-oriented-app');
    writePackageJson(dir, { name: 'feature-oriented-app', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/core/logger.ts', `export function log(msg: string): void {\n    console.log(msg);\n}\n`);
    write(dir, 'src/shared/types.ts', `export interface Entity {\n    id: number;\n}\n`);
    commit(dir, 'baseline: core/logger + shared/types');

    write(dir, 'src/features/users/model.ts', `import type { Entity } from '../../shared/types';\n\nexport interface UserModel extends Entity {\n    name: string;\n}\n`);
    write(dir, 'src/features/users/service.ts', `import type { UserModel } from './model';\nimport { log } from '../../core/logger';\n\nexport function createUser(id: number, name: string): UserModel {\n    log('creating user');\n    return { id, name };\n}\n`);
    commit(dir, 'add users feature (model + service)');

    write(dir, 'src/features/orders/model.ts', `import type { Entity } from '../../shared/types';\nimport type { UserModel } from '../users/model';\n\nexport interface OrderModel extends Entity {\n    user: UserModel;\n    total: number;\n}\n`);
    write(dir, 'src/features/orders/service.ts', `import type { OrderModel } from './model';\nimport { createUser } from '../users/service';\n\nexport function placeOrder(id: number, userId: number, total: number): OrderModel {\n    return { id, user: createUser(userId, 'unknown'), total };\n}\n`);
    commit(dir, 'add orders feature, depends on users feature (real cross-feature dependency)');

    write(dir, 'src/features/payments/model.ts', `import type { Entity } from '../../shared/types';\n\nexport interface PaymentModel extends Entity {\n    orderId: number;\n    amount: number;\n}\n`);
    write(dir, 'src/features/payments/service.ts', `import type { PaymentModel } from './model';\nimport { placeOrder } from '../orders/service';\n\nexport function charge(id: number, userId: number, amount: number): PaymentModel {\n    const order = placeOrder(id, userId, amount);\n    return { id, orderId: order.id, amount };\n}\n`);
    commit(dir, 'add payments feature: users -> orders -> payments chain');

    write(dir, 'src/features/orders/service.ts', `import type { OrderModel } from './model';\nimport { createUser } from '../users/service';\nimport { charge } from '../payments/service';\n\nexport function placeOrder(id: number, userId: number, total: number): OrderModel {\n    if (total > 1000) {\n        charge(id, userId, total);\n    }\n    return { id, user: createUser(userId, 'unknown'), total };\n}\n`);
    commit(dir, 'introduce a real cycle: orders -> payments -> orders (large-order auto-charge)');

    write(dir, 'src/features/orders/service.ts', `import type { OrderModel } from './model';\nimport { createUser } from '../users/service';\n\nexport function placeOrder(id: number, userId: number, total: number): OrderModel {\n    return { id, user: createUser(userId, 'unknown'), total };\n}\n`);
    commit(dir, 'fix: remove the orders/payments cycle, payments stays a one-way dependent');

    return dir;
}

// ---------------------------------------------------------------------------
// flat-app
// ---------------------------------------------------------------------------
function genFlatApp() {
    const dir = freshRepo('flat-app');
    writePackageJson(dir, { name: 'flat-app', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/utils.ts', `export function id<T>(x: T): T {\n    return x;\n}\n`);
    write(dir, 'src/user.ts', `import { id } from './utils';\n\nexport interface User {\n    id: number;\n    name: string;\n}\n\nexport function makeUser(uid: number, name: string): User {\n    return id({ id: uid, name });\n}\n`);
    commit(dir, 'baseline: utils.ts + user.ts, all flat in src/');

    write(dir, 'src/order.ts', `import { makeUser, User } from './user';\n\nexport interface Order {\n    user: User;\n    total: number;\n}\n\nexport function makeOrder(uid: number, total: number): Order {\n    return { user: makeUser(uid, 'unknown'), total };\n}\n`);
    commit(dir, 'add order.ts, same directory as user.ts');

    write(dir, 'src/payment.ts', `import { Order } from './order';\n\nexport function charge(order: Order): number {\n    return order.total;\n}\n`);
    write(dir, 'src/api.ts', `import { makeOrder } from './order';\nimport { charge } from './payment';\n\nexport function checkout(uid: number, total: number) {\n    const order = makeOrder(uid, total);\n    return charge(order);\n}\n`);
    commit(dir, 'add payment.ts + api.ts - still all in the same flat directory');

    write(dir, 'src/notification.ts', `import { checkout } from './api';\n\nexport function notifyOnCheckout(uid: number, total: number) {\n    return checkout(uid, total);\n}\n`);
    write(dir, 'src/api.ts', `import { makeOrder } from './order';\nimport { charge } from './payment';\nimport { notifyOnCheckout } from './notification';\n\nexport function checkout(uid: number, total: number) {\n    const order = makeOrder(uid, total);\n    if (total > 500) {\n        notifyOnCheckout(uid, total);\n    }\n    return charge(order);\n}\n`);
    commit(dir, 'introduce a real cycle purely between same-directory files: api.ts <-> notification.ts');

    write(dir, 'src/logging.ts', `export function logEvent(event: string): void {\n    console.log(event);\n}\n`);
    write(dir, 'src/analytics.ts', `import { logEvent } from './logging';\n\nexport function track(event: string): void {\n    logEvent('track:' + event);\n}\n`);
    write(dir, 'src/inventory.ts', `import { track } from './analytics';\n\nexport function reserve(sku: string): void {\n    track('reserve:' + sku);\n}\n`);
    commit(dir, 'add logging/analytics/inventory - more same-directory files, a real chain, no cycle here');

    return dir;
}

// ---------------------------------------------------------------------------
// messy-app
// ---------------------------------------------------------------------------
function genMessyApp() {
    const dir = freshRepo('messy-app');
    writePackageJson(dir, { name: 'messy-app', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/legacy/oldUserApi.js', `function getUser(id) {\n    return { id, name: 'legacy-user' };\n}\n\nmodule.exports = { getUser };\n`);
    commit(dir, 'baseline: legacy/oldUserApi.js (old CommonJS code nobody wants to touch)');

    write(dir, 'src/common/types.ts', `export interface User {\n    id: number;\n    name: string;\n}\n`);
    write(dir, 'src/services/userService.ts', `import type { User } from '../common/types';\n\nexport function getUser(id: number): User {\n    return { id, name: 'new-user' };\n}\n`);
    commit(dir, 'add a "proper" replacement in services/userService.ts, legacy stays for now');

    write(dir, 'src/components/UserCard.tsx', `import { getUser } from '../services/userService';\n\nexport function UserCard({ id }: { id: number }) {\n    const user = getUser(id);\n    return user.name;\n}\n`);
    write(dir, 'src/helpers/formatHelpers.ts', `export function titleCase(s: string): string {\n    return s.charAt(0).toUpperCase() + s.slice(1);\n}\n`);
    commit(dir, 'add components/UserCard + helpers/formatHelpers (helpers vs utils, already inconsistent)');

    write(dir, 'src/utils/stringUtils.ts', `import { titleCase } from '../helpers/formatHelpers';\n\nexport function displayName(name: string): string {\n    return titleCase(name);\n}\n`);
    write(dir, 'src/components/UserCard.tsx', `import { getUser } from '../services/userService';\nimport { displayName } from '../utils/stringUtils';\n\nexport function UserCard({ id }: { id: number }) {\n    const user = getUser(id);\n    return displayName(user.name);\n}\n`);
    commit(dir, 'add utils/stringUtils (now BOTH helpers/ and utils/ exist, a realistic drift)');

    write(dir, 'src/features/orders/orderService.ts', `import type { User } from '../../common/types';\nimport { getUser } from '../../services/userService';\n\nexport function placeOrder(userId: number, item: string) {\n    const user: User = getUser(userId);\n    return { user, item };\n}\n`);
    write(dir, 'src/services/notificationService.ts', `import { placeOrder } from '../features/orders/orderService';\n\nexport function notifyOrder(userId: number, item: string) {\n    return placeOrder(userId, item);\n}\n`);
    commit(dir, 'add features/orders (new-style) alongside flat services/ (old-style), plus a services -> features reach');

    write(dir, 'src/features/orders/orderService.ts', `import type { User } from '../../common/types';\nimport { getUser } from '../../services/userService';\nimport { notifyOrder } from '../../services/notificationService';\n\nexport function placeOrder(userId: number, item: string) {\n    const user: User = getUser(userId);\n    if (item === 'urgent') {\n        notifyOrder(userId, item);\n    }\n    return { user, item };\n}\n`);
    commit(dir, 'introduce a real cycle: features/orders/orderService <-> services/notificationService');

    write(dir, 'src/legacy/oldUserApi.js', `const { getUser: getUserV2 } = require('../services/userService');\n\nfunction getUser(id) {\n    return getUserV2(id);\n}\n\nmodule.exports = { getUser };\n`);
    commit(dir, 'refactoring artifact: legacy/oldUserApi.js now delegates to the new userService instead of being fully removed');

    write(dir, 'src/common/logger.ts', `export function log(msg: string): void {\n    console.log('[messy-app]', msg);\n}\n`);
    write(dir, 'src/features/orders/orderService.ts', `import type { User } from '../../common/types';\nimport { getUser } from '../../services/userService';\nimport { notifyOrder } from '../../services/notificationService';\nimport { log } from '../../common/logger';\n\nexport function placeOrder(userId: number, item: string) {\n    log('placing order');\n    const user: User = getUser(userId);\n    if (item === 'urgent') {\n        notifyOrder(userId, item);\n    }\n    return { user, item };\n}\n`);
    commit(dir, 'add common/logger, wired into orderService - one more shared dependency accreting over time');

    return dir;
}

genLayeredApp();
genFeatureOrientedApp();
genFlatApp();
genMessyApp();
console.log('Generated: layered-app, feature-oriented-app, flat-app, messy-app');
