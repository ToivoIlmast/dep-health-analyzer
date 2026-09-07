import { freshRepo, write, remove, commit, writePackageJson, writeDepHealthConfig, writeTsconfig, gitignoreNodeModules } from './test-projects-toolkit.mjs';

// ---------------------------------------------------------------------------
// react-js
// ---------------------------------------------------------------------------
function genReactJs() {
    const dir = freshRepo('react-js');
    writePackageJson(dir, {
        name: 'react-js', version: '1.0.0', private: true,
        dependencies: { react: '^18.3.0', 'react-dom': '^18.3.0' },
    });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/services/api.js', `export async function apiGet(path) {\n    const res = await fetch(path);\n    return res.json();\n}\n`);
    write(dir, 'src/services/userService.js', `import { apiGet } from './api.js';\n\nexport function fetchUsers() {\n    return apiGet('/api/users');\n}\n`);
    commit(dir, 'baseline: api client + userService');

    write(dir, 'src/hooks/useUsers.js', `import { useEffect, useState } from 'react';\nimport { fetchUsers } from '../services/userService.js';\n\nexport function useUsers() {\n    const [users, setUsers] = useState([]);\n    useEffect(() => {\n        fetchUsers().then(setUsers);\n    }, []);\n    return users;\n}\n`);
    commit(dir, 'add useUsers hook depending on userService');

    write(dir, 'src/components/UserList.jsx', `import { useUsers } from '../hooks/useUsers.js';\n\nexport function UserList() {\n    const users = useUsers();\n    return users.map((u) => u.name).join(', ');\n}\n`);
    commit(dir, 'add UserList component depending on useUsers hook');

    write(dir, 'src/pages/UsersPage.jsx', `import { UserList } from '../components/UserList.jsx';\n\nexport function UsersPage() {\n    return UserList();\n}\n`);
    commit(dir, 'add UsersPage (cross-directory: pages -> components)');

    write(dir, 'src/services/orderService.js', `import { apiGet } from './api.js';\n\nexport function fetchOrders() {\n    return apiGet('/api/orders');\n}\n`);
    write(dir, 'src/hooks/useOrders.js', `import { useEffect, useState } from 'react';\nimport { fetchOrders } from '../services/orderService.js';\nimport { useUsers } from './useUsers.js';\n\nexport function useOrders() {\n    const [orders, setOrders] = useState([]);\n    useUsers();\n    useEffect(() => {\n        fetchOrders().then(setOrders);\n    }, []);\n    return orders;\n}\n`);
    commit(dir, 'add orders feature: orderService + useOrders (depends on useUsers too)');

    write(dir, 'src/utils/format.js', `export function formatCurrency(n) {\n    return '$' + n.toFixed(2);\n}\n`);
    write(dir, 'src/components/OrderList.jsx', `import { useOrders } from '../hooks/useOrders.js';\nimport { formatCurrency } from '../utils/format.js';\n\nexport function OrderList() {\n    const orders = useOrders();\n    return orders.map((o) => formatCurrency(o.total)).join(', ');\n}\n`);
    write(dir, 'src/pages/OrdersPage.jsx', `import { OrderList } from '../components/OrderList.jsx';\n\nexport function OrdersPage() {\n    return OrderList();\n}\n`);
    commit(dir, 'add OrderList/OrdersPage with a utils dependency');

    return dir;
}

// ---------------------------------------------------------------------------
// react-ts
// ---------------------------------------------------------------------------
function genReactTs() {
    const dir = freshRepo('react-ts');
    writePackageJson(dir, {
        name: 'react-ts', version: '1.0.0', private: true,
        dependencies: { react: '^18.3.0', 'react-dom': '^18.3.0' },
        devDependencies: { typescript: '^5.6.0', '@types/react': '^18.3.0' },
    });
    writeTsconfig(dir, { compilerOptions: { jsx: 'react-jsx' } });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir, { features: { regression: { enabled: true, history: { enabled: true, sampleSize: 10 }, typescript: { includeTypeOnlyImports: false } }, scc: { enabled: true, typescript: { includeTypeOnlyImports: false } } } });

    write(dir, 'src/types/user.ts', `export interface User {\n    id: number;\n    name: string;\n}\n`);
    write(dir, 'src/services/api.ts', `export async function apiGet<T>(path: string): Promise<T> {\n    const res = await fetch(path);\n    return res.json() as Promise<T>;\n}\n`);
    write(dir, 'src/services/userService.ts', `import type { User } from '../types/user';\nimport { apiGet } from './api';\n\nexport function fetchUsers(): Promise<User[]> {\n    return apiGet<User[]>('/api/users');\n}\n`);
    commit(dir, 'baseline: User type, api client, userService (type-only + runtime mix)');

    write(dir, 'src/hooks/useUsers.ts', `import { useEffect, useState } from 'react';\nimport type { User } from '../types/user';\nimport { fetchUsers } from '../services/userService';\n\nexport function useUsers(): User[] {\n    const [users, setUsers] = useState<User[]>([]);\n    useEffect(() => {\n        fetchUsers().then(setUsers);\n    }, []);\n    return users;\n}\n`);
    commit(dir, 'add useUsers hook');

    write(dir, 'src/components/UserList.tsx', `import { useUsers } from '../hooks/useUsers';\n\nexport function UserList() {\n    const users = useUsers();\n    return users.map((u) => u.name).join(', ');\n}\n`);
    write(dir, 'src/features/users/UsersFeature.tsx', `import { UserList } from '../../components/UserList';\n\nexport function UsersFeature() {\n    return UserList();\n}\n`);
    commit(dir, 'add UserList + UsersFeature (feature depends on shared component)');

    write(dir, 'src/types/order.ts', `import type { User } from './user';\n\nexport interface Order {\n    user: User;\n    item: string;\n    total: number;\n}\n`);
    commit(dir, 'add Order type - type-only dependency on User type');

    write(dir, 'src/types/a.ts', `import type { B } from './b';\nexport interface A { link?: B; }\n`);
    write(dir, 'src/types/b.ts', `import type { A } from './a';\nexport interface B { link?: A; }\n`);
    commit(dir, 'introduce a type-only cycle (types/a <-> types/b) purely for validation purposes');

    write(dir, 'src/services/orderService.ts', `import type { Order } from '../types/order';\nimport { apiGet } from './api';\n\nexport function fetchOrders(): Promise<Order[]> {\n    return apiGet<Order[]>('/api/orders');\n}\n`);
    write(dir, 'src/hooks/useOrders.ts', `import { useEffect, useState } from 'react';\nimport type { Order } from '../types/order';\nimport { fetchOrders } from '../services/orderService';\n\nexport function useOrders(): Order[] {\n    const [orders, setOrders] = useState<Order[]>([]);\n    useEffect(() => {\n        fetchOrders().then(setOrders);\n    }, []);\n    return orders;\n}\n`);
    write(dir, 'src/features/orders/OrdersFeature.tsx', `import { useOrders } from '../../hooks/useOrders';\n\nexport function OrdersFeature() {\n    const orders = useOrders();\n    return orders.length;\n}\n`);
    commit(dir, 'add orders feature (runtime + type-only imports together)');

    return dir;
}

// ---------------------------------------------------------------------------
// vue-js
// ---------------------------------------------------------------------------
function genVueJs() {
    const dir = freshRepo('vue-js');
    writePackageJson(dir, { name: 'vue-js', version: '1.0.0', private: true, dependencies: { vue: '^3.4.0' } });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/services/api.js', `export async function apiGet(path) {\n    const res = await fetch(path);\n    return res.json();\n}\n`);
    write(dir, 'src/services/userService.js', `import { apiGet } from './api.js';\n\nexport function fetchUsers() {\n    return apiGet('/api/users');\n}\n`);
    commit(dir, 'baseline: api client + userService');

    write(dir, 'src/composables/useUsers.js', `import { ref, onMounted } from 'vue';\nimport { fetchUsers } from '../services/userService.js';\n\nexport function useUsers() {\n    const users = ref([]);\n    onMounted(async () => {\n        users.value = await fetchUsers();\n    });\n    return { users };\n}\n`);
    commit(dir, 'add useUsers composable');

    write(dir, 'src/stores/userStore.js', `import { fetchUsers } from '../services/userService.js';\n\nexport const userStore = {\n    state: { users: [] },\n    async load() {\n        this.state.users = await fetchUsers();\n    },\n};\n`);
    commit(dir, 'add userStore (pinia-style plain store)');

    write(dir, 'src/components/UserList.vue', `<template>\n  <ul><li v-for="u in users.value" :key="u.id">{{ u.name }}</li></ul>\n</template>\n<script setup>\nimport { useUsers } from '../composables/useUsers.js';\nconst { users } = useUsers();\n</script>\n`);
    commit(dir, 'add UserList.vue single-file component using useUsers composable');

    write(dir, 'src/views/UsersView.vue', `<template>\n  <UserList />\n</template>\n<script setup>\nimport UserList from '../components/UserList.vue';\n</script>\n`);
    commit(dir, 'add UsersView.vue (views -> components)');

    write(dir, 'src/services/orderService.js', `import { apiGet } from './api.js';\nimport { userStore } from '../stores/userStore.js';\n\nexport function fetchOrders() {\n    void userStore;\n    return apiGet('/api/orders');\n}\n`);
    commit(dir, 'add orderService, also touches userStore (cross-directory)');

    return dir;
}

// ---------------------------------------------------------------------------
// vue-ts
// ---------------------------------------------------------------------------
function genVueTs() {
    const dir = freshRepo('vue-ts');
    writePackageJson(dir, {
        name: 'vue-ts', version: '1.0.0', private: true,
        dependencies: { vue: '^3.4.0' }, devDependencies: { typescript: '^5.6.0' },
    });
    writeTsconfig(dir);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir, { features: { regression: { enabled: true, history: { enabled: true, sampleSize: 10 }, typescript: { includeTypeOnlyImports: false } }, scc: { enabled: true, typescript: { includeTypeOnlyImports: false } } } });

    write(dir, 'src/types/user.ts', `export interface User {\n    id: number;\n    name: string;\n}\n`);
    write(dir, 'src/services/api.ts', `export async function apiGet<T>(path: string): Promise<T> {\n    const res = await fetch(path);\n    return res.json() as Promise<T>;\n}\n`);
    write(dir, 'src/services/userService.ts', `import type { User } from '../types/user';\nimport { apiGet } from './api';\n\nexport function fetchUsers(): Promise<User[]> {\n    return apiGet<User[]>('/api/users');\n}\n`);
    commit(dir, 'baseline: User type + api + userService');

    write(dir, 'src/composables/useUsers.ts', `import { ref, onMounted } from 'vue';\nimport type { User } from '../types/user';\nimport { fetchUsers } from '../services/userService';\n\nexport function useUsers() {\n    const users = ref<User[]>([]);\n    onMounted(async () => {\n        users.value = await fetchUsers();\n    });\n    return { users };\n}\n`);
    commit(dir, 'add useUsers composable (type-only + runtime imports)');

    write(dir, 'src/stores/userStore.ts', `import type { User } from '../types/user';\nimport { fetchUsers } from '../services/userService';\n\nexport const userStore = {\n    state: { users: [] as User[] },\n    async load() {\n        this.state.users = await fetchUsers();\n    },\n};\n`);
    commit(dir, 'add userStore');

    write(dir, 'src/components/UserList.vue', `<template>\n  <ul><li v-for="u in users" :key="u.id">{{ u.name }}</li></ul>\n</template>\n<script setup lang="ts">\nimport { useUsers } from '../composables/useUsers';\nconst { users } = useUsers();\n</script>\n`);
    commit(dir, 'add UserList.vue');

    write(dir, 'src/types/order.ts', `import type { User } from './user';\n\nexport interface Order {\n    user: User;\n    total: number;\n}\n`);
    write(dir, 'src/services/orderService.ts', `import type { Order } from '../types/order';\nimport { apiGet } from './api';\n\nexport function fetchOrders(): Promise<Order[]> {\n    return apiGet<Order[]>('/api/orders');\n}\n`);
    commit(dir, 'add Order type (type-only dep on User) + orderService');

    write(dir, 'src/composables/useOrders.ts', `import { ref, onMounted } from 'vue';\nimport type { Order } from '../types/order';\nimport { fetchOrders } from '../services/orderService';\nimport { useUsers } from './useUsers';\n\nexport function useOrders() {\n    useUsers();\n    const orders = ref<Order[]>([]);\n    onMounted(async () => {\n        orders.value = await fetchOrders();\n    });\n    return { orders };\n}\n`);
    commit(dir, 'add useOrders composable, depends on useUsers (cross-feature)');

    return dir;
}

// ---------------------------------------------------------------------------
// angular-ts
// ---------------------------------------------------------------------------
function genAngularTs() {
    const dir = freshRepo('angular-ts');
    writePackageJson(dir, {
        name: 'angular-ts', version: '1.0.0', private: true,
        dependencies: { '@angular/core': '^18.0.0', '@angular/common': '^18.0.0', rxjs: '^7.8.0' },
        devDependencies: { typescript: '^5.6.0' },
    });
    writeTsconfig(dir, { compilerOptions: { experimentalDecorators: true, target: 'ES2022' } });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir, { features: { regression: { enabled: true, history: { enabled: true, sampleSize: 10 }, typescript: { includeTypeOnlyImports: false } }, scc: { enabled: true, typescript: { includeTypeOnlyImports: false } } } });

    write(dir, 'src/app/shared/models/user.model.ts', `export interface User {\n    id: number;\n    name: string;\n}\n`);
    write(
        dir,
        'src/app/shared/services/user.service.ts',
        `import { Injectable } from '@angular/core';\nimport type { User } from '../models/user.model';\n\n@Injectable({ providedIn: 'root' })\nexport class UserService {\n    getUsers(): Promise<User[]> {\n        return fetch('/api/users').then((r) => r.json());\n    }\n}\n`
    );
    commit(dir, 'baseline: User model + UserService');

    write(
        dir,
        'src/app/features/users/users.component.ts',
        `import { Component } from '@angular/core';\nimport { UserService } from '../../shared/services/user.service';\n\n@Component({ selector: 'app-users', template: '' })\nexport class UsersComponent {\n    constructor(private readonly userService: UserService) {\n        void this.userService;\n    }\n}\n`
    );
    commit(dir, 'add UsersComponent (features -> shared)');

    write(
        dir,
        'src/app/shared/guards/auth.guard.ts',
        `import { Injectable } from '@angular/core';\n\n@Injectable({ providedIn: 'root' })\nexport class AuthGuard {\n    canActivate(): boolean {\n        return true;\n    }\n}\n`
    );
    write(
        dir,
        'src/app/features/users/users.component.ts',
        `import { Component } from '@angular/core';\nimport { UserService } from '../../shared/services/user.service';\nimport { AuthGuard } from '../../shared/guards/auth.guard';\n\n@Component({ selector: 'app-users', template: '' })\nexport class UsersComponent {\n    constructor(private readonly userService: UserService, private readonly guard: AuthGuard) {\n        void this.userService;\n        void this.guard;\n    }\n}\n`
    );
    commit(dir, 'add AuthGuard, wire it into UsersComponent');

    write(dir, 'src/app/features/orders/models/order.model.ts', `import type { User } from '../../../shared/models/user.model';\n\nexport interface Order {\n    user: User;\n    total: number;\n}\n`);
    write(
        dir,
        'src/app/features/orders/orders.service.ts',
        `import { Injectable } from '@angular/core';\nimport type { Order } from './models/order.model';\n\n@Injectable({ providedIn: 'root' })\nexport class OrdersService {\n    getOrders(): Promise<Order[]> {\n        return fetch('/api/orders').then((r) => r.json());\n    }\n}\n`
    );
    commit(dir, 'add orders feature module with its own type-only dependency on shared User model');

    write(
        dir,
        'src/app/features/orders/orders.component.ts',
        `import { Component } from '@angular/core';\nimport { OrdersService } from './orders.service';\nimport { UserService } from '../../shared/services/user.service';\n\n@Component({ selector: 'app-orders', template: '' })\nexport class OrdersComponent {\n    constructor(private readonly ordersService: OrdersService, private readonly userService: UserService) {\n        void this.ordersService;\n        void this.userService;\n    }\n}\n`
    );
    commit(dir, 'OrdersComponent depends on both its own feature service and shared UserService');

    return dir;
}

genReactJs();
genReactTs();
genVueJs();
genVueTs();
genAngularTs();
console.log('Generated: react-js, react-ts, vue-js, vue-ts, angular-ts');
