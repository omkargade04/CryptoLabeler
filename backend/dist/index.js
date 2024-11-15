"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userRoutes = require('./routes/user.routes');
const workerRoutes = require('./routes/worker.routes');
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use('/v1/user', userRoutes);
app.use('/v1/worker', workerRoutes);
app.listen(3000, () => {
    console.log("Server running...");
});