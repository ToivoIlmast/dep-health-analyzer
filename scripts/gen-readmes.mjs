// Adds a per-fixture README.md (purpose / structural characteristics /
// history events / expected observations) to every already-generated
// test-projects/* fixture, as its own trailing commit. .md files are never
// scanned by dep-health-analyzer, so this never affects any fixture's graph.
import { projectDir, write, commit } from './test-projects-toolkit.mjs';

const NOTE = `\n> These fixtures are validation environments, not architectural reference implementations.\n> Fixture and directory names (e.g. "layered", "messy", "nightmare") describe the SHAPE of the\n> dependency graph, not a claim that this shape is architecturally good or bad. "Expected analyzer\n> observations" below describe what dep-health-analyzer should detect as a structural fact - never\n> whether that fact is desirable.\n`;

const readmes = {
    'vanilla-js': {
        ecosystem: 'Plain modern JavaScript (ESM), no framework',
        purpose: 'Baseline check: ESM relative imports, multi-level directories, a cycle introduced then removed, a file move, a cross-directory dependency.',
        characteristics: [
            'src/app, src/services, src/models, src/utils/logging - a few levels deep',
            'Plain `import`/`export` ESM syntax, `.js` extensions in specifiers matching real files (not the NodeNext output-extension case - see vanilla-ts note)',
        ],
        history: [
            'A real cycle introduced between orderService.js and userServiceFacade.js, then removed one commit later',
            'logger.js moved from utils/ to utils/logging/ (a real file move mid-history)',
        ],
        observations: [
            'cycles should report 0 cycles at the final commit (the only cycle was introduced and removed); `cycles` run against the "introduce a cycle" commit directly should report exactly 1',
            'NOTE: `history` tracks regression-style relation findings (cross-boundary/sibling/deep-internal), not cycle counts - it will not itself surface the cycle appearing/disappearing; checking a cycle across history requires running `cycles` at each ref',
            'the file move commit is expected to register incremental findings in `history` output as paths change and are re-classified, not because the move itself is a violation',
        ],
    },
    'vanilla-ts': {
        ecosystem: 'Plain modern TypeScript, no framework',
        purpose: 'Core TypeScript support: `import type`, interfaces, a type-only dependency, a type-only cycle, and a service mixing runtime + type-only imports.',
        characteristics: [
            'src/types, src/models, src/services, src/app',
            'types/a.ts <-> types/b.ts form a real type-only cycle (import type only, no runtime reference)',
        ],
        history: [
            'orderService.ts is added depending ONLY on a type via `import type` (pure type-only dependency)',
            'a type-only cycle (types/a <-> types/b) is introduced and left in place',
            'mixedService.ts is added combining a runtime import and a type-only import in one file',
        ],
        observations: [
            'with `features.typescript.includeTypeOnlyImports: false` (the default), cycles should report 0 cycles (the only cycle is type-only)',
            'with `includeTypeOnlyImports: true`, cycles should report exactly 1 cycle (types/a <-> types/b)',
            'orderService.ts should show 0 runtime dependencies and 1 type-only dependency by default, matching its real (type-only) coupling to types/order.ts',
        ],
    },
    'node-commonjs': {
        ecosystem: 'Node.js, CommonJS (`require`/`module.exports`)',
        purpose: 'Confirms the analyzer does not assume an ESM-only ecosystem - CommonJS require() calls should resolve like any relative import.',
        characteristics: ['Flat src/ + src/services, all `.js`, all `require()`/`module.exports`'],
        history: ['userService added, then orderService depending on it, then the entry point wired to orderService'],
        observations: [
            'dependencies between require()d files should be visible in the graph exactly like ESM imports elsewhere in the corpus',
            '(known, already-documented limitation - see README "CommonJS `require()`... are not analyzed yet": confirm here whether this fixture shows 0 dependencies, which would demonstrate that limitation concretely rather than as an abstract claim)',
        ],
    },
    'node-esm': {
        ecosystem: 'Node.js, native ESM (`"type": "module"`)',
        purpose: 'Confirms plain native-ESM Node projects (no bundler, no framework) resolve correctly, including a file move into a subfolder.',
        characteristics: ['Flat src/ + src/services, real `"type": "module"` package.json'],
        history: ['userService added, then moved into services/user/userService.js mid-history, with its importer updated'],
        observations: ['the dependency edge from orderService to userService should persist correctly across the move, not disappear or duplicate'],
    },
    'react-js': {
        ecosystem: 'React 18, JavaScript, no TypeScript',
        purpose: 'A small but realistic React app: hooks, components, pages, services, utils, with two features sharing a hook.',
        characteristics: ['src/services, src/hooks, src/components, src/pages, src/utils', '.jsx components alongside plain .js hooks/services'],
        history: ['users feature built first (service -> hook -> component -> page), then orders feature added, whose hook (useOrders) also depends on the users feature\'s hook (useUsers) - a real cross-feature dependency'],
        observations: [
            'useOrders -> useUsers should appear as a real dependency once the orders feature is added',
            'the pages -> components -> hooks -> services chain should be fully visible across all 4 directory levels',
        ],
    },
    'react-ts': {
        ecosystem: 'React 18 + TypeScript',
        purpose: 'React + TypeScript with a real type-only cycle, a type-only dependency (Order type on User type), and a feature combining runtime + type-only imports.',
        characteristics: ['src/types, src/services, src/hooks, src/components, src/features', 'types/a.ts <-> types/b.ts is a deliberate type-only cycle unrelated to the app features (isolated, for validation only)'],
        history: ['users feature built first, then Order type added as a type-only dependent on User type, then the a/b type-only cycle introduced, then orders feature added using both a runtime import (useOrders/orderService) and inheriting a type-only one'],
        observations: [
            'cycles should be 0 by default (includeTypeOnlyImports: false) and 1 with it enabled',
            'Order type should show as a type-only dependent of User type regardless of the includeTypeOnlyImports setting for `cycles`/`regression`, since that only affects whether type-only edges are COUNTED, not whether they exist in the underlying scan',
        ],
    },
    'vue-js': {
        ecosystem: 'Vue 3, JavaScript, Options-agnostic (Composition API via `<script setup>`)',
        purpose: 'Vue idioms: composables, a plain store, .vue single-file components. Also exercises a known scanner-scope limitation.',
        characteristics: ['src/services, src/composables, src/stores, src/components, src/views', '.vue files reference composables/services from inside `<script setup>` blocks'],
        history: ['api + userService baseline, then useUsers composable, then userStore, then UserList.vue and UsersView.vue, then orderService added touching userStore'],
        observations: [
            'IMPORTANT: dep-health-analyzer\'s file discovery only globs `.js/.jsx/.ts/.tsx` (confirmed by reading src/core/scanner/discover.ts) - `.vue` files are never scanned. Any dependency that exists ONLY inside a `.vue` file\'s `<script>` block (e.g. UserList.vue -> useUsers.js) will be INVISIBLE to `cycles`/`regression`/`history`.',
            'This is an expected heuristic/scanner-scope limitation, not a bug to fix under this task - see the corpus README\'s "Problems discovered" classification.',
            'The composable/store/service layer (all real .js files) should still show a correct, complete graph among themselves',
        ],
    },
    'vue-ts': {
        ecosystem: 'Vue 3 + TypeScript',
        purpose: 'Same as vue-js, with typed composables/stores and a type-only dependency (Order type on User type).',
        characteristics: ['src/types, src/services, src/composables, src/stores, src/components'],
        history: ['User type + api + userService baseline, then useUsers composable, then userStore, then UserList.vue, then Order type (type-only dep) + orderService, then useOrders composable depending on useUsers (cross-feature)'],
        observations: [
            'same .vue scanner-scope caveat as vue-js applies here',
            'useOrders -> useUsers should be a visible real dependency between the two composables (both .ts, both scanned)',
        ],
    },
    'angular-ts': {
        ecosystem: 'Angular 18, TypeScript, decorators',
        purpose: 'Idiomatic Angular module/feature layout: shared services/guards/models, feature modules depending on shared, decorator-heavy code.',
        characteristics: ['src/app/shared (models, services, guards), src/app/features/{users,orders}'],
        history: ['UserService + User model baseline, then UsersComponent, then AuthGuard added and wired in, then orders feature (own model + service, type-only dep on shared User model), then OrdersComponent depending on both its own service and the shared UserService'],
        observations: [
            'features/orders should show both an internal dependency (own orders.service.ts) and a cross-boundary-shaped dependency into shared/services/user.service.ts',
            'decorator usage (@Injectable, @Component) should not affect import resolution - the underlying import statements are still plain ESM',
        ],
    },
    'express-js': {
        ecosystem: 'Express 4, JavaScript, CommonJS',
        purpose: 'Realistic layered backend: routes -> controllers -> services -> repositories, plus middleware/utils.',
        characteristics: ['src/routes, src/controllers, src/services, src/repositories, src/middleware, src/utils'],
        history: ['userRepository + userService baseline, then userController + userRoutes, then middleware/utils added, then the full orders feature (repository/service/controller/routes, service depends on userService), then app.js wiring everything'],
        observations: [
            'orderService -> userService should be a real, visible dependency (services depending on each other, a common backend pattern)',
            'the full 4-layer chain (routes -> controllers -> services -> repositories) should be traceable end to end',
        ],
    },
    'express-ts': {
        ecosystem: 'Express 4 + TypeScript',
        purpose: 'Same layered shape as express-js, with DTOs and a type-only dependency between DTOs.',
        characteristics: ['src/dto, src/repositories, src/services, src/controllers'],
        history: ['UserDto + userRepository + userService baseline, then userController, then OrderDto (type-only dep on UserDto), then orderRepository/orderService (runtime dep on userService + type-only on OrderDto), then orderController + app.ts'],
        observations: ['OrderDto should show as a type-only dependent of UserDto; orderService should show BOTH a runtime dependency (on userService) and a type-only one (on OrderDto) - a real mixed case'],
    },
    'nestjs-ts': {
        ecosystem: 'NestJS 10, TypeScript, decorators, modules',
        purpose: 'Idiomatic Nest module structure with a real 3-module dependency chain (users -> orders -> payments) via `imports: [...]` and constructor injection.',
        characteristics: ['src/modules/{users,orders,payments}, src/common, src/config'],
        history: ['users module (entity, dto, service, controller, module) built first, then Order entity (imports User entity as a real class, not just a type), then orders module importing UsersModule, then payments module importing OrdersModule, then common/config additions'],
        observations: [
            'a real cross-module dependency chain should be visible: payments -> orders -> users',
            'Order entity importing User entity is a REAL (not type-only) import, since Nest entities are classes used as values - this should count as a runtime dependency, not a type-only one, even though the usage looks type-like',
        ],
    },
    'nextjs-ts': {
        ecosystem: 'Next.js 14, App Router, TypeScript',
        purpose: 'App Router layout: app/ pages depending on features/, which depend on components/ and services/, plus lib/ and types/.',
        characteristics: ['app/, components/, features/, lib/, services/, types/ all at the project root (no src/)'],
        history: ['types + lib/apiClient + userService baseline, then UserList component + UsersFeature, then app/users/page.tsx, then Order type (type-only dep on User) + orderService (runtime dep on userService), then orders feature + page'],
        observations: [
            'app/users/page.tsx -> features/users/UsersFeature.tsx -> components/UserList.tsx should form a clean 3-level chain',
            'Next.js App Router file-based routing conventions (app/.../page.tsx) are NOT known to the analyzer as special - they are just regular files with regular imports; the analyzer should not need any Next-specific handling to see this correctly',
        ],
    },
    'vite-react-ts': {
        ecosystem: 'React + TypeScript + Vite',
        purpose: 'Typical Vite project layout (src/main.tsx entry, vite.config.ts at root) distinct from the plain react-ts fixture.',
        characteristics: ['vite.config.ts at root, src/lib, src/types, src/services, src/hooks, src/components, src/main.tsx'],
        history: ['apiClient + User type + userService baseline, then useUsers hook + App component + main.tsx entry'],
        observations: ['vite.config.ts itself should be scanned like any other .ts file (it has no imports relevant to the app graph, so it should appear as an isolated node with 0 edges)'],
    },
    'vite-vue-ts': {
        ecosystem: 'Vue 3 + TypeScript + Vite',
        purpose: 'Typical Vite+Vue layout (src/main.ts entry, App.vue), distinct from vue-ts.',
        characteristics: ['vite.config.ts, src/lib, src/types, src/services, src/composables, src/App.vue, src/main.ts'],
        history: ['apiClient + User type + userService baseline, then useUsers composable + App.vue + main.ts entry'],
        observations: ['same .vue scanner-scope caveat as vue-js/vue-ts applies to App.vue here'],
    },
    'svelte-ts': {
        ecosystem: 'Svelte/SvelteKit-style, TypeScript',
        purpose: 'Exercises `.svelte` files (not scanned) alongside a real `.ts` lib graph (scanned).',
        characteristics: ['src/lib (api, types, userStore, orderUtils), src/routes/+page.svelte'],
        history: ['lib/api + lib/types + lib/userStore baseline, then a SvelteKit-style route (+page.svelte, not scanned) + lib/orderUtils.ts depending on userStore'],
        observations: [
            '`.svelte` files are not scanned (same discover.ts extension list as `.vue`) - the +page.svelte file\'s dependency on lib/userStore is invisible to the analyzer',
            'lib/orderUtils.ts -> lib/userStore.ts should be a correctly visible dependency (both .ts)',
        ],
    },
    'astro-ts': {
        ecosystem: 'Astro, TypeScript',
        purpose: 'Exercises `.astro` files (not scanned) alongside scanned `.ts` utilities/content/server code.',
        characteristics: ['src/utils, src/content, src/pages/*.astro, src/components/*.astro, src/server'],
        history: ['utils/format + content/posts baseline, then .astro page + component referencing the scanned utilities (invisible dependency), then server/api.ts depending on content/posts (visible dependency)'],
        observations: [
            '`.astro` files are not scanned - PostList.astro\'s reference to utils/format.ts and index.astro\'s reference to content/posts.ts are both invisible to the analyzer',
            'server/api.ts -> content/posts.ts should be correctly visible (both .ts)',
        ],
    },
    'typescript-library': {
        ecosystem: 'TypeScript npm library (not an application)',
        purpose: 'Barrel files, public API surface, internal module dependencies, a cycle introduced via a caching layer and then fixed - relevant since dep-health-analyzer itself is this kind of project.',
        characteristics: ['src/types, src/utils, src/parser, src/analyzer, barrel index.ts files at multiple levels'],
        history: ['token types + isDigit util, then tokenizer, then ast + parse, then analyzer module with its own barrel, then parser/index.ts + top-level src/index.ts barrels, then a real cycle introduced between parse.ts and a new cache.ts, then fixed'],
        observations: [
            'the barrel files (index.ts) should show as re-export hubs with high fan-in from the top-level src/index.ts',
            'cycles should be 0 at the final commit, and exactly 1 if `cycles` is run directly against the "introduce a cycle" commit; `history` itself does not track cycles (see the corpus README) and will not surface this directly',
        ],
    },
    'typescript-cli': {
        ecosystem: 'TypeScript CLI tool',
        purpose: 'Typical CLI dependency shape: config, core, commands, output, utils, entry point.',
        characteristics: ['src/config, src/core, src/commands, src/output, src/utils, src/cli.ts'],
        history: ['config types + loadConfig baseline, then core/scan + commands/scanCommand, then output/printer wired into scanCommand, then utils/args + cli.ts entry point'],
        observations: ['cli.ts should show as the graph\'s natural entry point (high out-degree, near-zero in-degree)'],
    },
    'monorepo-npm': {
        ecosystem: 'npm workspaces monorepo',
        purpose: 'Package-to-package dependencies via workspace aliases (`@corpus/*`), each package with its own tsconfig.json extending a shared base, plus a realistic root tsconfig.json using the standard TypeScript "project references / solution style" pattern (`files: [], references: [...]`, no `baseUrl`/`paths`).',
        characteristics: ['packages/{shared,core,ui,cli}, root tsconfig.json (references-only) + tsconfig.base.json, per-package tsconfig.json with `references`'],
        history: ['shared package baseline, then core depending on shared, then ui depending on core, then cli depending on both core and ui (fan-in across packages)'],
        observations: [
            'PRECISELY-SCOPED, VERIFIED LIMITATION: `resolveAlias()` in resolve.ts resolves a bare specifier ONLY through the scanned root\'s own `tsconfig.json` `compilerOptions.paths` - never through node_modules/package.json resolution. A real npm/pnpm workspace resolves `@corpus/*` at runtime via node_modules symlinks, not via tsconfig `paths`, so even this fixture\'s realistic, idiomatic root tsconfig.json (references-only, matching TypeScript\'s own documented monorepo pattern) does not make the 4 cross-package imports resolve - only the 3 intra-package ones do (verified: `Dependencies: 3`, not 7).',
            'CONTROLLED, VERIFIED COUNTER-CASE (do not assume the opposite from this fixture): manually adding `compilerOptions.paths` mapping each `@corpus/<name>` to its real source file to this same root tsconfig.json DOES make all 4 cross-package imports resolve (verified: `Dependencies: 6`). The limitation is specifically "no node_modules-based bare-specifier resolution", not "cross-package aliases can never work" - a project that hand-maintains matching tsconfig paths is not affected.',
        ],
    },
    'monorepo-pnpm': {
        ecosystem: 'pnpm workspace monorepo',
        purpose: 'Same as monorepo-npm, using `workspace:*` protocol and pnpm-workspace.yaml, to confirm the analyzer is not npm-specific (and shares the same limitation either way).',
        characteristics: ['packages/{shared,core,cli}, pnpm-workspace.yaml, workspace:* dependency ranges'],
        history: ['shared baseline, then core depending on shared via workspace:*, then cli depending on core'],
        observations: ['same verified bare-specifier resolution limitation as monorepo-npm applies here (see its README) - the package manager (npm vs pnpm) is not the variable being tested, the lack of node_modules-based resolution is'],
    },
    'layered-app': {
        ecosystem: 'Plain TypeScript, no framework',
        purpose: 'A project with a `presentation/application/domain/infrastructure` directory shape. The name describes the shape only - see the corpus-wide neutrality note above.',
        characteristics: ['src/{presentation,application,domain,infrastructure}'],
        history: ['domain/user + infrastructure/userRepository baseline, then application/createUser, then presentation/userController, then order domain/infra/application added, then presentation/orderController'],
        observations: [
            'presentation -> application -> (domain + infrastructure) should be visible as real, distinct cross-directory dependencies',
            'these cross-directory dependencies are the EXPECTED, designed shape of this fixture - the analyzer classifying them as cross-boundary is a correct structural observation, not evidence that this fixture\'s architecture is bad (nor that it is good)',
        ],
    },
    'feature-oriented-app': {
        ecosystem: 'Plain TypeScript, no framework',
        purpose: 'A `features/*` + `shared`/`core` shape, with a real cross-feature cycle introduced and then fixed.',
        characteristics: ['src/core, src/shared, src/features/{users,orders,payments}'],
        history: ['core/logger + shared/types baseline, then users feature, then orders feature depending on users, then payments feature depending on orders (users -> orders -> payments chain), then a real cycle introduced (orders -> payments -> orders for large-order auto-charge), then fixed'],
        observations: [
            'a real 2-node cycle (orders <-> payments) should appear at the "introduce a real cycle" commit and disappear at the next one',
            'users -> orders -> payments should be a stable one-way dependency chain in both the initial and final states',
        ],
    },
    'flat-app': {
        ecosystem: 'Plain TypeScript, no framework',
        purpose: 'Directly tests: same directory must not automatically mean safe. A real cycle exists entirely within one flat src/ folder.',
        characteristics: ['everything directly under src/, no subdirectories'],
        history: ['utils + user baseline, then order, then payment + api, then a real cycle introduced between api.ts and notification.ts (both flat, same directory), then more flat files added with a real one-way chain (no cycle)'],
        observations: [
            'the api.ts <-> notification.ts cycle should be detected by `cycles` DESPITE both files sharing a directory and therefore classifying as `sibling` in `regression` - this is the direct test of "same directory != safe"',
            'if `regression`\'s `sibling` relation is ever associated with any "safe" framing in the tool\'s output, this fixture is the one to check it against',
        ],
    },
    'messy-app': {
        ecosystem: 'Mixed JS/TS, plain Node-style app',
        purpose: 'A realistically, gradually-grown project: legacy CommonJS code, inconsistent helpers/ vs utils/ naming, old and new styles coexisting, a real cycle, a refactor that leaves an artifact behind instead of cleanly finishing.',
        characteristics: ['src/legacy (.js, CommonJS), src/common, src/services, src/components, src/helpers, src/utils, src/features/orders'],
        history: [
            'legacy/oldUserApi.js baseline (old CommonJS)',
            'common/types + services/userService added as the "proper" replacement, legacy kept',
            'components/UserCard + helpers/formatHelpers added',
            'utils/stringUtils added later (so helpers/ AND utils/ both exist - a real, common inconsistency)',
            'features/orders/orderService added (new-style) alongside flat services/ (old-style)',
            'a real cycle introduced: features/orders/orderService <-> services/notificationService',
            'legacy/oldUserApi.js changed to delegate to the new userService instead of being deleted - a realistic incomplete-refactor artifact',
            'common/logger added and wired into orderService',
        ],
        observations: [
            'this fixture should show a real cycle (orderService <-> notificationService) crossing between features/ and services/ - two structurally different area names for what functions as one layer',
            'legacy/oldUserApi.js should show a real (CommonJS-limited, likely invisible per the require() limitation) dependency on the new userService, demonstrating the "refactor left old code that now silently depends on new code" pattern',
        ],
    },
    'cyclic-app': {
        ecosystem: 'Plain TypeScript, no framework',
        purpose: 'Dedicated cycle-detection stress fixture: a 3-node cycle, a 2-node cycle, and a feature<->shared cycle each introduced and then removed across history, plus a type-only cycle that stays.',
        characteristics: ['src/{a,b,c,d,e}.ts, src/features/checkout, src/shared/pricing, src/types/{node,edge}'],
        history: [
            '3-node cycle a -> b -> c -> a introduced, then removed (breaking c -> a)',
            '2-node cycle d <-> e introduced, then removed',
            'feature -> shared -> feature cycle (checkout <-> pricing) introduced, then removed',
            'a TypeScript type-only cycle (types/node <-> types/edge) added and left in place',
        ],
        observations: [
            'cycles should report 0 at the final commit for RUNTIME cycles (all three were removed); running `cycles` directly against each "introduce" commit should report 1 cycle each time',
            'NOTE: `history` tracks regression-style relation findings (cross-boundary/sibling/deep-internal), not cycle counts, so it will not itself surface these cycle-appears-then-disappears events - use `cycles` at each ref to observe them',
            'the type-only cycle should only be counted with `includeTypeOnlyImports: true`',
        ],
    },
    'nightmare-app': {
        ecosystem: 'Plain TypeScript, no framework, synthetic stress shape',
        purpose: 'Extreme structural stress test: a large ring cycle, a shared "hub" module with high fan-in AND a reach back into the ring, a 10-level-deep chain, cross-directory fan-out between two areas, a partial fix, and further modules added afterward. The name describes the pattern, not a claim the analyzer should flag it as "bad architecture".',
        characteristics: ['~40 files: src/module0..17, src/shared/hub, src/deep/level0../level9, src/areaA, src/areaB'],
        history: [
            '18 independent modules baseline',
            'wired into an 18-module ring cycle',
            'shared/hub added, reached by 8 modules, itself reaching back into module0 (mutual dependency concentration)',
            '10-level-deep chain added under src/deep/',
            'areaA/areaB cross-directory fan-out added, both reaching into shared/hub',
            'a partial fix: module0 no longer depends on module1',
            '4 more modules added afterward, each extending the chain and touching the hub again',
        ],
        observations: [
            'VERIFIED, PRECISE (walked every commit personally - do not assume from the history text alone): breaking a single edge of a simple ring destroys the ENTIRE ring as an SCC, it does not "shrink" it - a ring has no redundant edges, so cutting any one of them makes the whole thing acyclic. Confirmed by walking every commit: max SCC size goes 0 (baseline) -> 18 (ring wired up) -> 19 (hub added, now also mutually reaching module0) -> 19 (deep chain, no change) -> 19 (areaA/areaB, no change) -> 2 (after the "partial fix" commit) -> 2 (unchanged through the 4 trailing commits).',
            'the max SCC of 2 remaining after the "partial fix" is NOT a remnant of the 18-module ring - it is the separate shared/hub <-> module0 mutual dependency (hub.ts imports fn0 from module0; module0.ts imports ping from hub), introduced in the earlier "add a shared hub module" commit and never touched by the fix. The 18-module ring itself is fully gone by that point.',
            'the fixture\'s peak structural complexity (max SCC = 19, spanning both the ring and the hub) exists for 3 consecutive commits in the middle of the history, not at HEAD - a validator or reader that only checks the final state will see max SCC = 2 and miss the fixture\'s actual stress-test value',
            'this is a genuine test of `cycles`\' algorithm at a larger, denser scale than the rest of the corpus - not expected to crash (round 4\'s known stack-overflow limitation needs ~4,649 nodes in a LINEAR chain; this fixture\'s ~40 nodes should be well within safe range even considering its cyclic density)',
        ],
    },
    'large-cycle-app': {
        ecosystem: 'Plain TypeScript, no framework, synthetic stress shape',
        purpose: 'Focused, static graph-visualization stress fixture: a large (7-node) SCC, a cycle member with many real external dependencies, and a second, independent, small cycle both reachable from one shared entry point - the shapes cyclic-app/nightmare-app do not leave standing at HEAD (see nightmare-app README: its own big ring is deliberately broken by a later "partial fix" commit).',
        characteristics: [
            'src/leaf/leaf0..5 (6 independent leaf modules), src/ring/ring0..6 (the 7-node cycle), src/pair/{left,right} (a second, independent 2-node cycle), src/entry.ts (imports into both cycles, itself part of neither)',
        ],
        history: [
            '6 independent leaf modules baseline',
            'wired into a 7-module ring cycle (ring0 -> ring1 -> ... -> ring0)',
            'ring0 additionally wired to depend on all 6 leaf modules, on top of its one cycle-internal dependency',
            'a second, independent 2-node cycle (pair/left <-> pair/right) added, plus entry.ts reaching into both cycles',
        ],
        observations: [
            'cycles should report the ring as one 7-node SCC - the largest in the whole corpus (same-directory-complex, the next largest, tops out at 3)',
            'ring0 should show Ce = 7 (6 leaf dependencies + its one cycle-internal dependency on ring1) - a cycle member with a genuinely large external fan-out, not just the 1-2 external deps flat-app/messy-app already cover',
            'pair/left and pair/right should register as their OWN separate 2-node SCC, structurally independent of the 7-node ring (no edge connects the two) even though entry.ts reaches into both',
            'cycles should therefore report exactly 2 SCCs at HEAD: one of size 7, one of size 2',
        ],
    },
    'same-directory-complex': {
        ecosystem: 'Plain TypeScript, no framework',
        purpose: 'Minimal, focused heuristic-trap fixture: a real cycle (a -> b -> c -> a) entirely within one flat directory, plus a 4th file depending on two cycle members.',
        characteristics: ['four files, one directory: src/{a,b,c,d}.ts'],
        history: ['four independent files baseline, then a real cycle wired up entirely within the one directory, then d.ts added depending on two cycle members'],
        observations: [
            'cycles should detect the a/b/c cycle regardless of all three files sharing a directory',
            'regression should classify every relation here as `sibling` (same directory) - this is the direct test that `sibling` never implies the underlying files are free of cycles',
        ],
    },
    'deep-but-valid': {
        ecosystem: 'Plain TypeScript, no framework',
        purpose: 'Minimal, focused heuristic-trap fixture: a legitimately deep feature-tree structure (5 levels) where deep-reaching imports are the NORMAL, expected shape, not a violation.',
        characteristics: ['src/features/commerce/checkout/payment/adapters/{stripe,paypal}, 5 levels deep'],
        history: ['a 5-level-deep adapter file baseline, then paymentService one level up, then checkoutService, then commerceFacade at the feature root (each importing progressively deeper), then a second adapter added alongside the first'],
        observations: [
            'commerceFacade -> checkoutService (residual depth 1) and checkoutService -> paymentService (residual depth 1) both classify as `internal` - a shared prefix plus a shallow reach does not produce `cross-boundary`',
            'DOCUMENTED, INTENTIONAL BEHAVIOR (see docs/CONFIGURATION.md#thresholds - "Note the internal and deep-internal checks are independent..."): paymentService -> adapters/paypal/paypalAdapter has residual depth 2, which the `internal` (`residualDepth <= 1`) and `deep-internal` (`residualDepth >= deepInternalResidualDepth`, default 3) bands are explicitly documented as not covering, so it classifies as `cross-boundary` even though every file involved shares the same `features/commerce` prefix five levels deep. This is a known, documented gap between two independent threshold checks (with a worked example in CONFIGURATION.md), not a defect - a second independent audit confirmed the gap is intentional and thoroughly documented, and this repository does not treat it as a bug.',
            'this fixture still demonstrates the intended point for residual depth 1: path depth alone does not produce a cross-boundary classification when the shared prefix is deep enough and the reach is shallow',
        ],
    },
    'cross-boundary-but-valid': {
        ecosystem: 'Plain TypeScript, no framework',
        purpose: 'Minimal, focused heuristic-trap fixture: cross-boundary-shaped dependencies (controllers -> services -> core, features -> multiple services) that are the fixture\'s own intended, designed shape.',
        characteristics: ['src/core, src/services, src/controllers, src/features/reporting'],
        history: ['core/database + services/userRepository baseline, then services/orderRepository (same pattern), then controllers/{user,order}Controller, then features/reporting aggregating both services'],
        observations: [
            'services -> core, controllers -> services, and features/reporting -> two different services should all classify as `cross-boundary` under default thresholds',
            'this is the direct test that a `cross-boundary` classification is reported as a structural fact ("this reaches across an inferred boundary") - the fixture\'s own design intends every one of these reaches, so none of them should read as evidence of "bad" architecture in the tool\'s output',
        ],
    },
    'mts-cts': {
        ecosystem: 'Plain TypeScript, no framework, "nodenext" module resolution',
        purpose: 'Regression fixture for a real, previously-undetected false negative: `.mts`/`.cts` are TypeScript\'s per-file module-format overrides (a file that must stay pure ESM, or pure CJS, regardless of the package\'s own "type" field) - a real pattern in published TypeScript libraries with mixed ESM/CJS output. `resolve.ts` already maps a `.mjs`/`.cjs` specifier to the real `.mts`/`.cts` source file, but until that file was itself scanned as source, its own outgoing imports - including ones completing a real cycle - went undetected.',
        characteristics: [
            'src/core.ts + src/logger.ts (plain .ts), src/esmBoundary.mts (forced ESM output), src/cjsBoundary.cts (forced CJS output), src/index.ts entry point',
            '"module": "NodeNext" / "moduleResolution": "NodeNext" in tsconfig.json - the real-world reason `.mts`/`.cts` files and `.mjs`/`.cjs` specifiers exist together',
        ],
        history: [
            'baseline: plain .ts core and logger, no .mts/.cts yet',
            'add src/esmBoundary.mts depending on core.ts via its .mjs output specifier',
            'add src/cjsBoundary.cts depending on core.ts via its .cjs output specifier',
            'introduce a real cycle: core.ts -> esmBoundary.mts -> core.ts (through a .mjs specifier)',
            'fix: remove that cycle',
            'introduce a second real cycle: core.ts -> cjsBoundary.cts -> core.ts (through a .cjs specifier) - left in place at HEAD',
            'add src/index.ts wiring both boundary modules together',
        ],
        observations: [
            'at HEAD: `cycles` should report exactly 1 cycle (core.ts <-> cjsBoundary.cts), `Scanned files: 5` (all 5 .ts/.mts/.cts files, not just the 3 plain .ts ones)',
            'checking out the "introduce a real cycle: core.ts -> esmBoundary.mts" commit directly: `cycles` should also report exactly 1 cycle there (core.ts <-> esmBoundary.mts) - proving both the .mts and the .cts direction are independently detected, not just one of them',
            'before this was fixed, BOTH cycles were invisible: `.mts`/`.cts` files were never scanned as source (only ever reachable as a resolution TARGET), so neither boundary module\'s own outgoing import back to core.ts was ever extracted, and `cycles` reported 0 with exit code 0 at every commit in this history',
            'src/index.ts -> esmBoundary.mts and src/index.ts -> cjsBoundary.cts should both resolve as ordinary one-way dependencies, exactly like importing from a plain .ts file',
        ],
    },
    'history-laboratory': {
        ecosystem: 'Plain TypeScript, no framework',
        purpose: 'A controlled, 12-commit experiment specifically for `history` analysis - each commit is one distinct class of structural change.',
        characteristics: ['src/core, src/domain/models, src/services, src/dto, src/features/{reporting,orders}'],
        history: [
            '01: clean baseline (single logger module)',
            '02: add module (User model, unrelated)',
            '03: add dependency (userService -> models + logger)',
            '04: introduce cycle (userService <-> orderService)',
            '05: remove cycle',
            '06: add type-only dependency (dto/orderDto -> models/user via `import type`)',
            '07: move files (models/user.ts -> domain/models/user.ts)',
            '08: introduce cross-directory dependency (features/reporting -> core + services)',
            '09: refactor (userService gains a function, no new cross-file dependency)',
            '10: introduce several findings at once (a real batch commit)',
            '11: remove some findings (orderReport loses a dependency)',
            '12: additional structural changes (dto/orderDto re-derived from a new domain/models/order type)',
        ],
        observations: [
            'a cycle should appear after commit 04 and disappear after commit 05',
            'a type-only dependency should appear after commit 06',
            'the file move at commit 07 should not appear as a spurious new/removed dependency once path rewriting is accounted for',
            'commit 10 should register as an incremental spike relative to the surrounding quieter commits (09, 11, 12) if sampled densely enough',
            'commit 11 should show a real decrease in incremental findings relative to commit 10',
        ],
    },
};

for (const [name, info] of Object.entries(readmes)) {
    const dir = projectDir(name);
    const body = `# ${name}

**Ecosystem:** ${info.ecosystem}

**Purpose:** ${info.purpose}

## Important structural characteristics
${info.characteristics.map((c) => `- ${c}`).join('\n')}

## Important history events
${info.history.map((h) => `- ${h}`).join('\n')}

## Expected analyzer observations
${info.observations.map((o) => `- ${o}`).join('\n')}
${NOTE}`;
    write(dir, 'README.md', body);
    commit(dir, 'docs: add fixture README (purpose, history, expected observations)');
}

console.log(`Added README.md to ${Object.keys(readmes).length} fixtures`);
