import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3Client, GetObjectCommand, PutObjectAclCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import jwt from "jsonwebtoken";
import { config, parse } from "dotenv";
import { authMiddleware } from "../middleware";
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { createTaskInput } from "../types";
import axios from "axios";
import nacl from 'tweetnacl'
import { Connection, PublicKey, Transaction } from "@solana/web3.js";

config();
const router = Router();
const prisma = new PrismaClient();
const s3Client = new S3Client({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY || "",
        secretAccessKey: process.env.AWS_SECRET_KEY || "",
    },
    region: "us-east-1"
})
const DEFAULT_TITLE = "default title";
const TOTAL_DECIMAL = 1000_000_000;
const connection = new Connection(process.env.RPC_URL ?? "");

prisma.$transaction(
    async (prisma) => {
      // Code running in a transaction...
    },
    {
      maxWait: 5000, // default: 2000
      timeout: 10000, // default: 5000
    }
)

router.post('/signin', async(req: any, res: any) => {

    const { publicKey, signature } = req.body;
    const message = new TextEncoder().encode("Sign into cryptolabeler");

    const result = nacl.sign.detached.verify(
        message,
        new Uint8Array(signature.data),
        new PublicKey(publicKey).toBytes(),
    );


    if (!result) {
        return res.status(411).json({
            message: "Incorrect signature"
        })
    }

    try{
        const existingUser = await prisma.user.findFirst({
            where: {
                address: publicKey
            }
        });

        if(existingUser) {
            const token = jwt.sign({
                userId: existingUser.id
            }, process.env.JWT_SECRET || "")

            res.json({
                token
            })
        } else {
            const user = await prisma.user.create({
                data: {
                    address: publicKey,
                }
            })
            const token = jwt.sign({
                userId: user.id
            }, process.env.JWT_SECRET || "")

            res.json({
                token
            })
        }
    } catch(err) {

    }
});

router.get("/presignedUrl", authMiddleware, async(req: any, res:any) => {
    const userId = req.userId;
    const { url, fields } = await createPresignedPost(s3Client, {
        Bucket: "cryptolabeller",
        Key: `/${userId}/${Math.random()}/image.jpg`,
        Conditions: [
          ['content-length-range', 0, 5 * 1024 * 1024] // 5 MB max
        ],
        Fields: {
          'Content-Type': 'image/png'
        },
        Expires: 3600
      })
      
      console.log({ url, fields })
      res.json({
        preSignedUrl: url,
        fields
      })
})

router.post('/task', authMiddleware, async(req: any, res: any) => {
    try {
        const userId = req.userId;
        const body = req.body;
        const parseData = createTaskInput.safeParse(body);

        if(!parseData.success) {
            return res.status(411).json({
                msg: "Wrong input!"
            })
        }

        const user = await prisma.user.findFirst({
            where: {
                id: userId
            }
        })

        const transaction = await connection.getTransaction(parseData.data.signature, {
            maxSupportedTransactionVersion: 1
        });
    
        console.log(transaction);

        if ((transaction?.meta?.postBalances[1] ?? 0) - (transaction?.meta?.preBalances[1] ?? 0) !== 100000000) {
            return res.status(411).json({
                message: "Transaction signature/amount incorrect"
            })
        }
    
        if (transaction?.transaction.message.getAccountKeys().get(1)?.toString() !== process.env.PARENT_WALLET_ADDRESS) {
            return res.status(411).json({
                message: "Transaction sent to wrong address"
            })
        }
    
        if (transaction?.transaction.message.getAccountKeys().get(0)?.toString() !== user?.address) {
            return res.status(411).json({
                message: "Transaction sent to wrong address"
            })
        }

        const amount = 0.1 * TOTAL_DECIMAL;
        if (isNaN(amount)) {
            throw new Error("Invalid TOTAL_DECIMAL value");
        }

        //@ts-ignore
        let response = await prisma.$transaction(async tx => {
            const res = await tx.task.create({
                data: {
                    title: parseData.data.title ?? DEFAULT_TITLE,
                    amount,
                    signature: parseData.data.signature,
                    user_id: userId
                }
            });

            await tx.option.createMany({
                data: parseData.data.options.map(x=>({
                    image_url: x.imageUrl,
                    task_id: res.id
                }))
            })
            return res;
        })
        res.json({
            id: response.id
        })
    } catch(e) {
        console.log(e)
    }
})

router.get('/task', authMiddleware, async(req: any, res:any) => {
    try{
        const taskId: string = req.query.taskId;
        const userId = req.userId;
        
        const taskDetails = await prisma.task.findFirst({
            where: {
                user_id: Number(userId),
                id: Number(taskId)
            },
            include: {
                options: true
            }
        })

        if(!taskDetails) {
            return res.status(411).json({
                msg: "You dont have access to this task"
            })
        }

        const response = await prisma.submission.findMany({
            where: {
                task_id: Number(taskId)
            },
            include: {
                option: true
            }
        })

        const result: Record<string, {
            count: number;
            option: {
                imageUrl: string
            }
        }> = {};

        taskDetails.options.forEach(option => {
            result[option.id] = {
                count: 0,
                option: {
                    imageUrl: option.image_url || " "
                }
            }
        })

        response.forEach(r => {
            result[r.option.id].count++;
        })
        res.json({
            result
        })
    }catch(e) {
        console.log(e)
    }
})

router.get('/leetcode', async (req, res) => {
    try {
        const response = await axios.post('https://leetcode.com/graphql', {
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
    } catch (error: any) {
        const errorResponse = {
            status: error.response?.status || 500,
            message: error.message,
            details: error.response?.data || 'No additional details available'
        };
        
        console.error('LeetCode API Error:', errorResponse);
        res.status(errorResponse.status).json(errorResponse);
    }
});

module.exports = router;