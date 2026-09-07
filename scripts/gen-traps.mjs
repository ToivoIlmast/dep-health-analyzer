import { freshRepo, write, commit, writePackageJson, writeDepHealthConfig, writeTsconfig, gitignoreNodeModules } from './test-projects-toolkit.mjs';

// ---------------------------------------------------------------------------
// same-directory-complex - proves same directory must not automatically mean
// safe/good: a real cycle exists entirely within one flat folder.
// ---------------------------------------------------------------------------
function genSameDirectoryComplex() {
    const dir = freshRepo('same-directory-complex');
    writePackageJson(dir, { name: 'same-directory-complex', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/a.ts', `export function a(): string {\n    return 'a';\n}\n`);
    write(dir, 'src/b.ts', `export function b(): string {\n    return 'b';\n}\n`);
    write(dir, 'src/c.ts', `export function c(): string {\n    return 'c';\n}\n`);
    write(dir, 'src/d.ts', `export function d(): string {\n    return 'd';\n}\n`);
    commit(dir, 'baseline: four independent files, all in the same directory');

    write(dir, 'src/a.ts', `import { b } from './b';\n\nexport function a(): string {\n    return 'a' + b();\n}\n`);
    write(dir, 'src/b.ts', `import { c } from './c';\n\nexport function b(): string {\n    return 'b' + c();\n}\n`);
    write(dir, 'src/c.ts', `import { a } from './a';\n\nexport function c(): string {\n    return 'c' + a();\n}\n`);
    commit(dir, 'wire up a real cycle a -> b -> c -> a, entirely within one flat directory');

    write(dir, 'src/d.ts', `import { a } from './a';\nimport { c } from './c';\n\nexport function d(): string {\n    return 'd' + a() + c();\n}\n`);
    commit(dir, 'd depends on two members of the cycle - still all one directory, still one relation type (sibling)');

    return dir;
}

// ---------------------------------------------------------------------------
// deep-but-valid - proves path depth must not automatically mean a violation
// ---------------------------------------------------------------------------
function genDeepButValid() {
    const dir = freshRepo('deep-but-valid');
    writePackageJson(dir, { name: 'deep-but-valid', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/features/commerce/checkout/payment/adapters/stripe/stripeAdapter.ts', `export function charge(amount: number): boolean {\n    return amount > 0;\n}\n`);
    commit(dir, 'baseline: a deeply nested adapter file, five levels under features/');

    write(
        dir,
        'src/features/commerce/checkout/payment/paymentService.ts',
        `import { charge } from './adapters/stripe/stripeAdapter';\n\nexport function pay(amount: number): boolean {\n    return charge(amount);\n}\n`
    );
    commit(dir, 'add paymentService one level up, importing the deep adapter - ordinary for this layout');

    write(
        dir,
        'src/features/commerce/checkout/checkoutService.ts',
        `import { pay } from './payment/paymentService';\n\nexport function checkout(amount: number): boolean {\n    return pay(amount);\n}\n`
    );
    commit(dir, 'add checkoutService, one more level up the same feature tree');

    write(
        dir,
        'src/features/commerce/commerceFacade.ts',
        `import { checkout } from './checkout/checkoutService';\n\nexport function buy(amount: number): boolean {\n    return checkout(amount);\n}\n`
    );
    commit(dir, 'add commerceFacade at the feature root, importing several levels deep - normal for this project shape');

    write(
        dir,
        'src/features/commerce/checkout/payment/adapters/paypal/paypalAdapter.ts',
        `export function charge(amount: number): boolean {\n    return amount > 0;\n}\n`
    );
    write(
        dir,
        'src/features/commerce/checkout/payment/paymentService.ts',
        `import { charge as stripeCharge } from './adapters/stripe/stripeAdapter';\nimport { charge as paypalCharge } from './adapters/paypal/paypalAdapter';\n\nexport function pay(amount: number, provider: 'stripe' | 'paypal' = 'stripe'): boolean {\n    return provider === 'stripe' ? stripeCharge(amount) : paypalCharge(amount);\n}\n`
    );
    commit(dir, 'add a second deep adapter (paypal) alongside stripe - still the same deep, valid shape');

    return dir;
}

// ---------------------------------------------------------------------------
// cross-boundary-but-valid - proves cross-boundary relation is an
// observation, not a verdict: these reaches are a natural, expected part of
// this fixture's own design (features depending on core/services layers).
// ---------------------------------------------------------------------------
function genCrossBoundaryButValid() {
    const dir = freshRepo('cross-boundary-but-valid');
    writePackageJson(dir, { name: 'cross-boundary-but-valid', version: '1.0.0', private: true, devDependencies: { typescript: '^5.6.0' } });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/core/database.ts', `export function query(sql: string): unknown[] {\n    void sql;\n    return [];\n}\n`);
    write(dir, 'src/services/userRepository.ts', `import { query } from '../core/database';\n\nexport function findUsers(): unknown[] {\n    return query('SELECT * FROM users');\n}\n`);
    commit(dir, 'baseline: core/database + services/userRepository (services -> core)');

    write(dir, 'src/services/orderRepository.ts', `import { query } from '../core/database';\n\nexport function findOrders(): unknown[] {\n    return query('SELECT * FROM orders');\n}\n`);
    commit(dir, 'add services/orderRepository, also reaching into core (the same intended pattern)');

    write(dir, 'src/controllers/userController.ts', `import { findUsers } from '../services/userRepository';\n\nexport function listUsers(): unknown[] {\n    return findUsers();\n}\n`);
    write(dir, 'src/controllers/orderController.ts', `import { findOrders } from '../services/orderRepository';\n\nexport function listOrders(): unknown[] {\n    return findOrders();\n}\n`);
    commit(dir, 'add controllers -> services (another expected boundary crossing for this layered shape)');

    write(dir, 'src/features/reporting/reportBuilder.ts', `import { findUsers } from '../../services/userRepository';\nimport { findOrders } from '../../services/orderRepository';\n\nexport function buildReport() {\n    return { users: findUsers(), orders: findOrders() };\n}\n`);
    commit(dir, 'add features/reporting, deliberately reaching into two different services - a normal aggregation pattern');

    return dir;
}

genSameDirectoryComplex();
genDeepButValid();
genCrossBoundaryButValid();
console.log('Generated: same-directory-complex, deep-but-valid, cross-boundary-but-valid');
