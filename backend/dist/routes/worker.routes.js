"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = require("dotenv");
const middleware_1 = require("../middleware");
const db_1 = require("../db");
const types_1 = require("../types");
(0, dotenv_1.config)();
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const TOTAL_SUBMISSIONS = 100;
const TOTAL_DECIMAL = 1000000000;
router.post('/signin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const hardcodedWalletAddress = "92ix902i3908x1u";
        const existingUser = yield prisma.worker.findFirst({
            where: {
                address: hardcodedWalletAddress
            }
        });
        if (existingUser) {
            const token = jsonwebtoken_1.default.sign({
                userId: existingUser.id
            }, process.env.WORKER_JWT_SECRET || "");
            res.json({
                token
            });
        }
        else {
            const user = yield prisma.worker.create({
                data: {
                    address: hardcodedWalletAddress,
                    pending_amount: 0,
                    locked_amount: 0
                }
            });
            const token = jsonwebtoken_1.default.sign({
                userId: user.id
            }, process.env.WORKER_JWT_SECRET || "");
            res.json({
                token
            });
        }
    }
    catch (err) {
    }
}));
router.get('/nextTask', middleware_1.workerAuthMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const task = yield (0, db_1.getNextTask)(Number(userId));
        console.log(task);
        if (!task) {
            res.status(411).json({
                msg: "No more tasks left for you to review"
            });
        }
        else {
            res.status(200).json({
                task
            });
        }
    }
    catch (e) {
        console.log(e);
    }
}));
router.post('/submission', middleware_1.workerAuthMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const body = req.body;
        const userId = req.userId;
        const parseBody = types_1.createSubmissionInput.safeParse(body);
        if (!parseBody.success) {
            return res.status(400).json({
                msg: "Invalid input"
            });
        }
        const task = yield (0, db_1.getNextTask)(Number(userId));
        if (!task || (task === null || task === void 0 ? void 0 : task.id) != Number(parseBody.data.taskId)) {
            return res.status(400).json({
                msg: "Task ID mismatch or task not found"
            });
        }
        const amount = (Number(task.amount) / TOTAL_SUBMISSIONS).toString();
        const submission = yield prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const submission = yield prisma.submission.create({
                data: {
                    option_id: Number(parseBody.data.selection),
                    worker_id: userId,
                    task_id: Number(parseBody.data.taskId),
                    amount
                }
            });
            yield prisma.worker.update({
                where: {
                    id: userId
                },
                data: {
                    pending_amount: {
                        increment: Number(amount)
                    }
                }
            });
            return submission;
        }));
        const nextTask = yield (0, db_1.getNextTask)(Number(userId));
        res.json({
            nextTask,
            amount
        });
    }
    catch (e) {
        console.log(e);
    }
}));
router.get('/balance', middleware_1.workerAuthMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.userId;
        const worker = yield prisma.worker.findFirst({
            where: {
                id: Number(userId)
            }
        });
        res.json({
            pendingAmount: worker === null || worker === void 0 ? void 0 : worker.pending_amount,
            lockedAmount: worker === null || worker === void 0 ? void 0 : worker.locked_amount
        });
    }
    catch (e) {
        console.log(e);
    }
}));
module.exports = router;
