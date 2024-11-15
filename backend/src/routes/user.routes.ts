import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3Client, GetObjectCommand, PutObjectAclCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import jwt from "jsonwebtoken";
import { config, parse } from "dotenv";
import { authMiddleware } from "../middleware";
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { createTaskInput } from "../types";

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

router.post('/signin', async(req, res) => {
    try{
        const hardcodedWalletAddress = "92ix902i3908x1u";
        const existingUser = await prisma.user.findFirst({
            where: {
                address: hardcodedWalletAddress
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
                    address: hardcodedWalletAddress,
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

        //@ts-ignore
        let response = await prisma.$transaction(async tx => {
            const res = await tx.task.create({
                data: {
                    title: parseData.data.title ?? DEFAULT_TITLE,
                    amount: "1",
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


module.exports = router;