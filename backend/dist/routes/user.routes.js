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
const client_s3_1 = require("@aws-sdk/client-s3");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = require("dotenv");
const middleware_1 = require("../middleware");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const types_1 = require("../types");
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
router.post('/signin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const hardcodedWalletAddress = "92ix902i3908x1u";
        const existingUser = yield prisma.user.findFirst({
            where: {
                address: hardcodedWalletAddress
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
                    address: hardcodedWalletAddress,
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
    try {
        const userId = req.userId;
        const body = req.body;
        const parseData = types_1.createTaskInput.safeParse(body);
        if (!parseData.success) {
            return res.status(411).json({
                msg: "Wrong input!"
            });
        }
        //@ts-ignore
        let response = yield prisma.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const res = yield tx.task.create({
                data: {
                    title: (_a = parseData.data.title) !== null && _a !== void 0 ? _a : DEFAULT_TITLE,
                    amount: "1",
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
module.exports = router;
