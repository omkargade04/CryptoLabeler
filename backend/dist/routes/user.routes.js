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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = require("express");
const client_s3_1 = require("@aws-sdk/client-s3");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = require("dotenv");
const middleware_1 = require("../middleware");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const types_1 = require("../types");
const axios_1 = __importDefault(require("axios"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const web3_js_1 = require("@solana/web3.js");
(0, dotenv_1.config)();
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const s3Client = new client_s3_1.S3Client({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY || "",
        secretAccessKey: process.env.AWS_SECRET_KEY || "",
    },
    region: "us-east-1"
});
const DEFAULT_TITLE = "default title";
const TOTAL_DECIMAL = 1000000000;
const connection = new web3_js_1.Connection((_a = process.env.RPC_URL) !== null && _a !== void 0 ? _a : "");
prisma.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
    // Code running in a transaction...
}), {
    maxWait: 5000, // default: 2000
    timeout: 10000, // default: 5000
});
router.post('/signin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { publicKey, signature } = req.body;
    const message = new TextEncoder().encode("Sign into cryptolabeler");
    const result = tweetnacl_1.default.sign.detached.verify(message, new Uint8Array(signature.data), new web3_js_1.PublicKey(publicKey).toBytes());
    if (!result) {
        return res.status(411).json({
            message: "Incorrect signature"
        });
    }
    try {
        const existingUser = yield prisma.user.findFirst({
            where: {
                address: publicKey
            }
        });
        if (existingUser) {
            const token = jsonwebtoken_1.default.sign({
                userId: existingUser.id
            }, process.env.JWT_SECRET || "");
            res.json({
                token
            });
        }
        else {
            const user = yield prisma.user.create({
                data: {
                    address: publicKey,
                }
            });
            const token = jsonwebtoken_1.default.sign({
                userId: user.id
            }, process.env.JWT_SECRET || "");
            res.json({
                token
            });
        }
    }
    catch (err) {
    }
}));
router.get("/presignedUrl", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = req.userId;
    const { url, fields } = yield (0, s3_presigned_post_1.createPresignedPost)(s3Client, {
        Bucket: "cryptolabeller",
        Key: `/${userId}/${Math.random()}/image.jpg`,
        Conditions: [
            ['content-length-range', 0, 5 * 1024 * 1024] // 5 MB max
        ],
        Fields: {
            'Content-Type': 'image/png'
        },
        Expires: 3600
    });
    console.log({ url, fields });
    res.json({
        preSignedUrl: url,
        fields
    });
}));
router.post('/task', middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f, _g;
    try {
        const userId = req.userId;
        const body = req.body;
        const parseData = types_1.createTaskInput.safeParse(body);
        if (!parseData.success) {
            return res.status(411).json({
                msg: "Wrong input!"
            });
        }
        const user = yield prisma.user.findFirst({
            where: {
                id: userId
            }
        });
        const transaction = yield connection.getTransaction(parseData.data.signature, {
            maxSupportedTransactionVersion: 1
        });
        console.log(transaction);
        if (((_c = (_b = transaction === null || transaction === void 0 ? void 0 : transaction.meta) === null || _b === void 0 ? void 0 : _b.postBalances[1]) !== null && _c !== void 0 ? _c : 0) - ((_e = (_d = transaction === null || transaction === void 0 ? void 0 : transaction.meta) === null || _d === void 0 ? void 0 : _d.preBalances[1]) !== null && _e !== void 0 ? _e : 0) !== 100000000) {
            return res.status(411).json({
                message: "Transaction signature/amount incorrect"
            });
        }
        if (((_f = transaction === null || transaction === void 0 ? void 0 : transaction.transaction.message.getAccountKeys().get(1)) === null || _f === void 0 ? void 0 : _f.toString()) !== process.env.PARENT_WALLET_ADDRESS) {
            return res.status(411).json({
                message: "Transaction sent to wrong address"
            });
        }
        if (((_g = transaction === null || transaction === void 0 ? void 0 : transaction.transaction.message.getAccountKeys().get(0)) === null || _g === void 0 ? void 0 : _g.toString()) !== (user === null || user === void 0 ? void 0 : user.address)) {
            return res.status(411).json({
                message: "Transaction sent to wrong address"
            });
        }
        const amount = 0.1 * TOTAL_DECIMAL;
        if (isNaN(amount)) {
            throw new Error("Invalid TOTAL_DECIMAL value");
        }
        //@ts-ignore
        let response = yield prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _h;
            const res = yield tx.task.create({
                data: {
                    title: (_h = parseData.data.title) !== null && _h !== void 0 ? _h : DEFAULT_TITLE,
                    amount,
                    signature: parseData.data.signature,
                    user_id: userId
                }
            });
            yield tx.option.createMany({
                data: parseData.data.options.map(x => ({
                    image_url: x.imageUrl,
                    task_id: res.id
                }))
            });
            return res;
        }));
        res.json({
            id: response.id
        });
    }
    catch (e) {
        console.log(e);
    }
}));
router.get('/task', middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const taskId = req.query.taskId;
        const userId = req.userId;
        const taskDetails = yield prisma.task.findFirst({
            where: {
                user_id: Number(userId),
                id: Number(taskId)
            },
            include: {
                options: true
            }
        });
        if (!taskDetails) {
            return res.status(411).json({
                msg: "You dont have access to this task"
            });
        }
        const response = yield prisma.submission.findMany({
            where: {
                task_id: Number(taskId)
            },
            include: {
                option: true
            }
        });
        const result = {};
        taskDetails.options.forEach(option => {
            result[option.id] = {
                count: 0,
                option: {
                    imageUrl: option.image_url || " "
                }
            };
        });
        response.forEach(r => {
            result[r.option.id].count++;
        });
        res.json({
            result
        });
    }
    catch (e) {
        console.log(e);
    }
}));
router.get('/leetcode', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _j, _k;
    try {
        const response = yield axios_1.default.post('https://leetcode.com/graphql', {
            query: `
                query problemsetQuestionList {
                    problemsetQuestionList: questionList {
                        title
                        titleSlug
                        difficulty
                    }
                }
            `
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Referer': 'https://leetcode.com'
            }
        });
        res.json({ data: response.data });
    }
    catch (error) {
        const errorResponse = {
            status: ((_j = error.response) === null || _j === void 0 ? void 0 : _j.status) || 500,
            message: error.message,
            details: ((_k = error.response) === null || _k === void 0 ? void 0 : _k.data) || 'No additional details available'
        };
        console.error('LeetCode API Error:', errorResponse);
        res.status(errorResponse.status).json(errorResponse);
    }
}));
module.exports = router;
