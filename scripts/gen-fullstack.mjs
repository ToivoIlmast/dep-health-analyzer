import { freshRepo, write, commit, writePackageJson, writeDepHealthConfig, writeTsconfig, gitignoreNodeModules } from './test-projects-toolkit.mjs';

// ---------------------------------------------------------------------------
// nextjs-ts (App Router)
// ---------------------------------------------------------------------------
function genNextJs() {
    const dir = freshRepo('nextjs-ts');
    writePackageJson(dir, {
        name: 'nextjs-ts', version: '1.0.0', private: true,
        dependencies: { next: '^14.2.0', react: '^18.3.0', 'react-dom': '^18.3.0' },
        devDependencies: { typescript: '^5.6.0' },
    });
    writeTsconfig(dir, { compilerOptions: { jsx: 'preserve', module: 'ESNext', moduleResolution: 'Bundler' } });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir, { features: { regression: { enabled: true, history: { enabled: true, sampleSize: 10 }, typescript: { includeTypeOnlyImports: false } }, scc: { enabled: true, typescript: { includeTypeOnlyImports: false } } } });

    write(dir, 'types/user.ts', `export interface User {\n    id: number;\n    name: string;\n}\n`);
    write(dir, 'lib/apiClient.ts', `export async function apiGet<T>(path: string): Promise<T> {\n    const res = await fetch(path);\n    return res.json() as Promise<T>;\n}\n`);
    write(dir, 'services/userService.ts', `import type { User } from '../types/user';\nimport { apiGet } from '../lib/apiClient';\n\nexport function fetchUsers(): Promise<User[]> {\n    return apiGet<User[]>('/api/users');\n}\n`);
    commit(dir, 'baseline: types, lib/apiClient, services/userService');

    write(dir, 'components/UserList.tsx', `import type { User } from '../types/user';\n\nexport function UserList({ users }: { users: User[] }) {\n    return users.map((u) => u.name).join(', ');\n}\n`);
    write(dir, 'features/users/UsersFeature.tsx', `import { UserList } from '../../components/UserList';\nimport { fetchUsers } from '../../services/userService';\n\nexport async function UsersFeature() {\n    const users = await fetchUsers();\n    return UserList({ users });\n}\n`);
    commit(dir, 'add UserList component + UsersFeature (feature -> component + service)');

    write(dir, 'app/users/page.tsx', `import { UsersFeature } from '../../features/users/UsersFeature';\n\nexport default async function UsersPage() {\n    return UsersFeature();\n}\n`);
    commit(dir, 'add app/users/page.tsx (App Router page -> feature)');

    write(dir, 'types/order.ts', `import type { User } from './user';\n\nexport interface Order {\n    user: User;\n    total: number;\n}\n`);
    write(dir, 'services/orderService.ts', `import type { Order } from '../types/order';\nimport { apiGet } from '../lib/apiClient';\nimport { fetchUsers } from './userService';\n\nexport async function fetchOrders(): Promise<Order[]> {\n    await fetchUsers();\n    return apiGet<Order[]>('/api/orders');\n}\n`);
    commit(dir, 'add Order type (type-only dep) + orderService (runtime dep on userService)');

    write(dir, 'features/orders/OrdersFeature.tsx', `import { fetchOrders } from '../../services/orderService';\n\nexport async function OrdersFeature() {\n    const orders = await fetchOrders();\n    return orders.length;\n}\n`);
    write(dir, 'app/orders/page.tsx', `import { OrdersFeature } from '../../features/orders/OrdersFeature';\n\nexport default async function OrdersPage() {\n    return OrdersFeature();\n}\n`);
    commit(dir, 'add orders app route + feature');

    return dir;
}

// ---------------------------------------------------------------------------
// vite-react-ts
// ---------------------------------------------------------------------------
function genViteReactTs() {
    const dir = freshRepo('vite-react-ts');
    writePackageJson(dir, {
        name: 'vite-react-ts', version: '1.0.0', private: true,
        dependencies: { react: '^18.3.0', 'react-dom': '^18.3.0' },
        devDependencies: { typescript: '^5.6.0', vite: '^5.4.0', '@vitejs/plugin-react': '^4.3.0' },
    });
    writeTsconfig(dir, { compilerOptions: { jsx: 'react-jsx', module: 'ESNext', moduleResolution: 'Bundler' } });
    write(dir, 'vite.config.ts', `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({ plugins: [react()] });\n`);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/lib/apiClient.ts', `export async function apiGet<T>(path: string): Promise<T> {\n    const res = await fetch(path);\n    return res.json() as Promise<T>;\n}\n`);
    write(dir, 'src/types/user.ts', `export interface User {\n    id: number;\n    name: string;\n}\n`);
    write(dir, 'src/services/userService.ts', `import type { User } from '../types/user';\nimport { apiGet } from '../lib/apiClient';\n\nexport function fetchUsers(): Promise<User[]> {\n    return apiGet<User[]>('/api/users');\n}\n`);
    commit(dir, 'baseline: apiClient, User type, userService');

    write(dir, 'src/hooks/useUsers.ts', `import { useEffect, useState } from 'react';\nimport type { User } from '../types/user';\nimport { fetchUsers } from '../services/userService';\n\nexport function useUsers() {\n    const [users, setUsers] = useState<User[]>([]);\n    useEffect(() => { fetchUsers().then(setUsers); }, []);\n    return users;\n}\n`);
    write(dir, 'src/components/App.tsx', `import { useUsers } from '../hooks/useUsers';\n\nexport function App() {\n    const users = useUsers();\n    return users.length;\n}\n`);
    write(dir, 'src/main.tsx', `import { App } from './components/App';\n\nApp();\n`);
    commit(dir, 'add useUsers hook, App component, and main.tsx entry point');

    return dir;
}

// ---------------------------------------------------------------------------
// vite-vue-ts
// ---------------------------------------------------------------------------
function genViteVueTs() {
    const dir = freshRepo('vite-vue-ts');
    writePackageJson(dir, {
        name: 'vite-vue-ts', version: '1.0.0', private: true,
        dependencies: { vue: '^3.4.0' },
        devDependencies: { typescript: '^5.6.0', vite: '^5.4.0', '@vitejs/plugin-vue': '^5.1.0' },
    });
    writeTsconfig(dir, { compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler' } });
    write(dir, 'vite.config.ts', `import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';\n\nexport default defineConfig({ plugins: [vue()] });\n`);
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/lib/apiClient.ts', `export async function apiGet<T>(path: string): Promise<T> {\n    const res = await fetch(path);\n    return res.json() as Promise<T>;\n}\n`);
    write(dir, 'src/types/user.ts', `export interface User {\n    id: number;\n    name: string;\n}\n`);
    write(dir, 'src/services/userService.ts', `import type { User } from '../types/user';\nimport { apiGet } from '../lib/apiClient';\n\nexport function fetchUsers(): Promise<User[]> {\n    return apiGet<User[]>('/api/users');\n}\n`);
    commit(dir, 'baseline: apiClient, User type, userService');

    write(dir, 'src/composables/useUsers.ts', `import { ref, onMounted } from 'vue';\nimport type { User } from '../types/user';\nimport { fetchUsers } from '../services/userService';\n\nexport function useUsers() {\n    const users = ref<User[]>([]);\n    onMounted(async () => { users.value = await fetchUsers(); });\n    return { users };\n}\n`);
    write(dir, 'src/App.vue', `<template><div /></template>\n<script setup lang="ts">\nimport { useUsers } from './composables/useUsers';\nconst { users } = useUsers();\nvoid users;\n</script>\n`);
    write(dir, 'src/main.ts', `import { createApp } from 'vue';\n\ncreateApp({}).mount('#app');\n`);
    commit(dir, 'add useUsers composable, App.vue, main.ts entry point');

    return dir;
}

// ---------------------------------------------------------------------------
// svelte-ts
// ---------------------------------------------------------------------------
function genSvelteTs() {
    const dir = freshRepo('svelte-ts');
    writePackageJson(dir, {
        name: 'svelte-ts', version: '1.0.0', private: true,
        devDependencies: { typescript: '^5.6.0', svelte: '^4.2.0', vite: '^5.4.0' },
    });
    writeTsconfig(dir, { compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler' } });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/lib/api.ts', `export async function apiGet<T>(path: string): Promise<T> {\n    const res = await fetch(path);\n    return res.json() as Promise<T>;\n}\n`);
    write(dir, 'src/lib/types.ts', `export interface User {\n    id: number;\n    name: string;\n}\n`);
    write(dir, 'src/lib/userStore.ts', `import type { User } from './types';\nimport { apiGet } from './api';\n\nlet cached: User[] = [];\n\nexport async function loadUsers(): Promise<User[]> {\n    cached = await apiGet<User[]>('/api/users');\n    return cached;\n}\n\nexport function getCachedUsers(): User[] {\n    return cached;\n}\n`);
    commit(dir, 'baseline: lib/api, lib/types, lib/userStore');

    write(dir, 'src/routes/+page.svelte', `<script lang="ts">\n  import { loadUsers } from '../lib/userStore';\n  loadUsers();\n</script>\n<div />\n`);
    write(dir, 'src/lib/orderUtils.ts', `import { getCachedUsers } from './userStore';\n\nexport function summarizeOrders(items: string[]) {\n    const users = getCachedUsers();\n    return { users: users.length, items: items.length };\n}\n`);
    commit(dir, 'add a SvelteKit-style route (not scanned) + lib/orderUtils.ts (scanned, depends on userStore)');

    return dir;
}

// ---------------------------------------------------------------------------
// astro-ts
// ---------------------------------------------------------------------------
function genAstroTs() {
    const dir = freshRepo('astro-ts');
    writePackageJson(dir, {
        name: 'astro-ts', version: '1.0.0', private: true,
        devDependencies: { typescript: '^5.6.0', astro: '^4.15.0' },
    });
    writeTsconfig(dir, { compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler' } });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/utils/format.ts', `export function formatDate(d: Date): string {\n    return d.toISOString().slice(0, 10);\n}\n`);
    write(dir, 'src/content/posts.ts', `import { formatDate } from '../utils/format';\n\nexport function listPosts() {\n    return [{ title: 'Hello', date: formatDate(new Date()) }];\n}\n`);
    commit(dir, 'baseline: utils/format + content/posts');

    write(dir, 'src/pages/index.astro', `---\nimport { listPosts } from '../content/posts';\nconst posts = listPosts();\n---\n<div>{posts.length}</div>\n`);
    write(dir, 'src/components/PostList.astro', `---\nimport { formatDate } from '../utils/format';\nformatDate(new Date());\n---\n<div />\n`);
    commit(dir, 'add .astro page + component (not scanned) referencing scanned .ts utilities');

    write(dir, 'src/server/api.ts', `import { listPosts } from '../content/posts';\n\nexport function GET() {\n    return new Response(JSON.stringify(listPosts()));\n}\n`);
    commit(dir, 'add a server-side API route (src/server/api.ts) depending on content/posts');

    return dir;
}

genNextJs();
genViteReactTs();
genViteVueTs();
genSvelteTs();
genAstroTs();
console.log('Generated: nextjs-ts, vite-react-ts, vite-vue-ts, svelte-ts, astro-ts');
