import { freshRepo, write, commit, writePackageJson, writeDepHealthConfig, writeTsconfig, gitignoreNodeModules } from './test-projects-toolkit.mjs';

// ---------------------------------------------------------------------------
// express-js
// ---------------------------------------------------------------------------
function genExpressJs() {
    const dir = freshRepo('express-js');
    writePackageJson(dir, { name: 'express-js', version: '1.0.0', private: true, dependencies: { express: '^4.19.0' } });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir);

    write(dir, 'src/repositories/userRepository.js', `const users = [];\n\nexports.findAll = () => users;\nexports.save = (user) => { users.push(user); return user; };\n`);
    write(dir, 'src/services/userService.js', `const userRepository = require('../repositories/userRepository');\n\nexports.listUsers = () => userRepository.findAll();\nexports.createUser = (name) => userRepository.save({ id: Date.now(), name });\n`);
    commit(dir, 'baseline: userRepository + userService');

    write(dir, 'src/controllers/userController.js', `const userService = require('../services/userService');\n\nexports.list = (req, res) => res.json(userService.listUsers());\nexports.create = (req, res) => res.json(userService.createUser(req.body.name));\n`);
    write(dir, 'src/routes/userRoutes.js', `const express = require('express');\nconst userController = require('../controllers/userController');\n\nconst router = express.Router();\nrouter.get('/users', userController.list);\nrouter.post('/users', userController.create);\n\nmodule.exports = router;\n`);
    commit(dir, 'add userController + userRoutes');

    write(dir, 'src/middleware/logger.js', `module.exports = function logger(req, res, next) {\n    console.log(req.method, req.url);\n    next();\n};\n`);
    write(dir, 'src/utils/asyncHandler.js', `module.exports = function asyncHandler(fn) {\n    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);\n};\n`);
    commit(dir, 'add middleware/logger and utils/asyncHandler');

    write(dir, 'src/repositories/orderRepository.js', `const orders = [];\n\nexports.findAll = () => orders;\nexports.save = (order) => { orders.push(order); return order; };\n`);
    write(dir, 'src/services/orderService.js', `const orderRepository = require('../repositories/orderRepository');\nconst userService = require('./userService');\n\nexports.listOrders = () => orderRepository.findAll();\nexports.placeOrder = (userId, item) => {\n    userService.listUsers();\n    return orderRepository.save({ userId, item });\n};\n`);
    write(dir, 'src/controllers/orderController.js', `const orderService = require('../services/orderService');\nconst asyncHandler = require('../utils/asyncHandler');\n\nexports.list = asyncHandler(async (req, res) => res.json(orderService.listOrders()));\n`);
    write(dir, 'src/routes/orderRoutes.js', `const express = require('express');\nconst orderController = require('../controllers/orderController');\n\nconst router = express.Router();\nrouter.get('/orders', orderController.list);\n\nmodule.exports = router;\n`);
    commit(dir, 'add orders feature: repository, service (depends on userService), controller, routes');

    write(dir, 'src/app.js', `const express = require('express');\nconst logger = require('./middleware/logger');\nconst userRoutes = require('./routes/userRoutes');\nconst orderRoutes = require('./routes/orderRoutes');\n\nconst app = express();\napp.use(logger);\napp.use(userRoutes);\napp.use(orderRoutes);\n\nmodule.exports = app;\n`);
    commit(dir, 'add app.js wiring routes and middleware together');

    return dir;
}

// ---------------------------------------------------------------------------
// express-ts
// ---------------------------------------------------------------------------
function genExpressTs() {
    const dir = freshRepo('express-ts');
    writePackageJson(dir, {
        name: 'express-ts', version: '1.0.0', private: true,
        dependencies: { express: '^4.19.0' }, devDependencies: { typescript: '^5.6.0', '@types/express': '^4.17.0' },
    });
    writeTsconfig(dir, { compilerOptions: { module: 'CommonJS', moduleResolution: 'Node' } });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir, { features: { regression: { enabled: true, history: { enabled: true, sampleSize: 10 }, typescript: { includeTypeOnlyImports: false } }, scc: { enabled: true, typescript: { includeTypeOnlyImports: false } } } });

    write(dir, 'src/dto/userDto.ts', `export interface UserDto {\n    id: number;\n    name: string;\n}\n`);
    write(dir, 'src/repositories/userRepository.ts', `import type { UserDto } from '../dto/userDto';\n\nconst users: UserDto[] = [];\n\nexport function findAll(): UserDto[] {\n    return users;\n}\n\nexport function save(user: UserDto): UserDto {\n    users.push(user);\n    return user;\n}\n`);
    write(dir, 'src/services/userService.ts', `import type { UserDto } from '../dto/userDto';\nimport { findAll, save } from '../repositories/userRepository';\n\nexport function listUsers(): UserDto[] {\n    return findAll();\n}\n\nexport function createUser(name: string): UserDto {\n    return save({ id: Date.now(), name });\n}\n`);
    commit(dir, 'baseline: UserDto, userRepository, userService');

    write(dir, 'src/controllers/userController.ts', `import type { Request, Response } from 'express';\nimport { listUsers, createUser } from '../services/userService';\n\nexport function list(_req: Request, res: Response): void {\n    res.json(listUsers());\n}\n\nexport function create(req: Request, res: Response): void {\n    res.json(createUser(req.body.name));\n}\n`);
    commit(dir, 'add userController');

    write(dir, 'src/dto/orderDto.ts', `import type { UserDto } from './userDto';\n\nexport interface OrderDto {\n    user: UserDto;\n    item: string;\n}\n`);
    commit(dir, 'add OrderDto - type-only dependency on UserDto');

    write(dir, 'src/repositories/orderRepository.ts', `import type { OrderDto } from '../dto/orderDto';\n\nconst orders: OrderDto[] = [];\n\nexport function findAll(): OrderDto[] {\n    return orders;\n}\n\nexport function save(order: OrderDto): OrderDto {\n    orders.push(order);\n    return order;\n}\n`);
    write(dir, 'src/services/orderService.ts', `import type { OrderDto } from '../dto/orderDto';\nimport * as orderRepository from '../repositories/orderRepository';\nimport { listUsers } from './userService';\n\nexport function listOrders(): OrderDto[] {\n    return orderRepository.findAll();\n}\n\nexport function placeOrder(order: OrderDto): OrderDto {\n    listUsers();\n    return orderRepository.save(order);\n}\n`);
    commit(dir, 'add orderRepository + orderService (runtime dep on userService, type-only on OrderDto)');

    write(dir, 'src/controllers/orderController.ts', `import type { Request, Response } from 'express';\nimport { listOrders } from '../services/orderService';\n\nexport function list(_req: Request, res: Response): void {\n    res.json(listOrders());\n}\n`);
    write(dir, 'src/app.ts', `import express from 'express';\nimport * as userController from './controllers/userController';\nimport * as orderController from './controllers/orderController';\n\nexport const app = express();\napp.get('/users', userController.list);\napp.post('/users', userController.create);\napp.get('/orders', orderController.list);\n`);
    commit(dir, 'add orderController + app.ts wiring everything together');

    return dir;
}

// ---------------------------------------------------------------------------
// nestjs-ts
// ---------------------------------------------------------------------------
function genNestJs() {
    const dir = freshRepo('nestjs-ts');
    writePackageJson(dir, {
        name: 'nestjs-ts', version: '1.0.0', private: true,
        dependencies: { '@nestjs/common': '^10.4.0', '@nestjs/core': '^10.4.0', rxjs: '^7.8.0' },
        devDependencies: { typescript: '^5.6.0' },
    });
    writeTsconfig(dir, { compilerOptions: { experimentalDecorators: true, emitDecoratorMetadata: true, target: 'ES2022' } });
    gitignoreNodeModules(dir);
    writeDepHealthConfig(dir, { features: { regression: { enabled: true, history: { enabled: true, sampleSize: 10 }, typescript: { includeTypeOnlyImports: false } }, scc: { enabled: true, typescript: { includeTypeOnlyImports: false } } } });

    write(dir, 'src/modules/users/entities/user.entity.ts', `export class User {\n    id!: number;\n    name!: string;\n}\n`);
    write(dir, 'src/modules/users/dto/create-user.dto.ts', `export class CreateUserDto {\n    name!: string;\n}\n`);
    write(
        dir,
        'src/modules/users/users.service.ts',
        `import { Injectable } from '@nestjs/common';\nimport { User } from './entities/user.entity';\nimport type { CreateUserDto } from './dto/create-user.dto';\n\n@Injectable()\nexport class UsersService {\n    private readonly users: User[] = [];\n\n    create(dto: CreateUserDto): User {\n        const user = Object.assign(new User(), { id: Date.now(), name: dto.name });\n        this.users.push(user);\n        return user;\n    }\n\n    findAll(): User[] {\n        return this.users;\n    }\n}\n`
    );
    commit(dir, 'baseline: users module entity, dto, service');

    write(
        dir,
        'src/modules/users/users.controller.ts',
        `import { Body, Controller, Get, Post } from '@nestjs/common';\nimport { UsersService } from './users.service';\nimport type { CreateUserDto } from './dto/create-user.dto';\n\n@Controller('users')\nexport class UsersController {\n    constructor(private readonly usersService: UsersService) {}\n\n    @Get()\n    findAll() {\n        return this.usersService.findAll();\n    }\n\n    @Post()\n    create(@Body() dto: CreateUserDto) {\n        return this.usersService.create(dto);\n    }\n}\n`
    );
    write(
        dir,
        'src/modules/users/users.module.ts',
        `import { Module } from '@nestjs/common';\nimport { UsersController } from './users.controller';\nimport { UsersService } from './users.service';\n\n@Module({ controllers: [UsersController], providers: [UsersService], exports: [UsersService] })\nexport class UsersModule {}\n`
    );
    commit(dir, 'add UsersController + UsersModule');

    write(
        dir,
        'src/modules/orders/entities/order.entity.ts',
        `import { User } from '../../users/entities/user.entity';\n\nexport class Order {\n    user!: User;\n    item!: string;\n}\n`
    );
    commit(dir, 'add Order entity - type-only-shaped dependency on users/entities/user.entity (real import, class used as type here)');

    write(
        dir,
        'src/modules/orders/orders.service.ts',
        `import { Injectable } from '@nestjs/common';\nimport { Order } from './entities/order.entity';\nimport { UsersService } from '../users/users.service';\n\n@Injectable()\nexport class OrdersService {\n    private readonly orders: Order[] = [];\n\n    constructor(private readonly usersService: UsersService) {}\n\n    placeOrder(item: string): Order {\n        const [user] = this.usersService.findAll();\n        const order = Object.assign(new Order(), { user, item });\n        this.orders.push(order);\n        return order;\n    }\n}\n`
    );
    write(
        dir,
        'src/modules/orders/orders.module.ts',
        `import { Module } from '@nestjs/common';\nimport { OrdersService } from './orders.service';\nimport { UsersModule } from '../users/users.module';\n\n@Module({ imports: [UsersModule], providers: [OrdersService] })\nexport class OrdersModule {}\n`
    );
    commit(dir, 'add orders module depending on the users module (real cross-module dependency)');

    write(
        dir,
        'src/modules/payments/payments.service.ts',
        `import { Injectable } from '@nestjs/common';\nimport { OrdersService } from '../orders/orders.service';\n\n@Injectable()\nexport class PaymentsService {\n    constructor(private readonly ordersService: OrdersService) {\n        void this.ordersService;\n    }\n\n    charge(item: string): void {\n        this.ordersService.placeOrder(item);\n    }\n}\n`
    );
    write(
        dir,
        'src/modules/payments/payments.module.ts',
        `import { Module } from '@nestjs/common';\nimport { PaymentsService } from './payments.service';\nimport { OrdersModule } from '../orders/orders.module';\n\n@Module({ imports: [OrdersModule], providers: [PaymentsService] })\nexport class PaymentsModule {}\n`
    );
    commit(dir, 'add payments module: users -> orders -> payments dependency chain');

    write(dir, 'src/common/filters/http-exception.filter.ts', `import { Catch, ExceptionFilter } from '@nestjs/common';\n\n@Catch()\nexport class HttpExceptionFilter implements ExceptionFilter {\n    catch(): void {\n        // no-op fixture filter\n    }\n}\n`);
    write(dir, 'src/config/app.config.ts', `export const appConfig = {\n    port: 3000,\n};\n`);
    commit(dir, 'add common/filters and config (infrastructure-ish additions)');

    return dir;
}

genExpressJs();
genExpressTs();
genNestJs();
console.log('Generated: express-js, express-ts, nestjs-ts');
