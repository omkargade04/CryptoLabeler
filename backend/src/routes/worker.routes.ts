import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { config } from "dotenv";
import { workerAuthMiddleware } from "../middleware";
import { getNextTask } from "../db";
import { createSubmissionInput } from "../types";

config();
const router = Router();
const prisma = new PrismaClient();

const TOTAL_SUBMISSIONS = 100;


router.post('/signin', async(req, res) => {
    try{
        const hardcodedWalletAddress = "92ix902i3908x1u";
        const existingUser = await prisma.worker.findFirst({
            where: {
                address: hardcodedWalletAddress
            }
        });

        if(existingUser) {
            const token = jwt.sign({
                userId: existingUser.id
            }, process.env.WORKER_JWT_SECRET || "")

            res.json({
                token
            })
        } else {
            const user = await prisma.worker.create({
                data: {
                    address: hardcodedWalletAddress,
                    pending_amount: 0,
                    locked_amount: 0
                }
            })
            const token = jwt.sign({
                userId: user.id
            }, process.env.WORKER_JWT_SECRET || "")

            res.json({
                token
            })
        }
    } catch(err) {

    }
});

router.get('/nextTask', workerAuthMiddleware, async(req: any, res: any) => {
    try{
        const userId = req.userId;
        const task: any = await getNextTask(Number(userId));
        console.log(task)
        if(!task) {
            res.status(411).json({
                msg: "No more tasks left for you to review"
            })
        } else {
            res.status(200).json({
                task
            })
        }
    }catch(e) {
        console.log(e);
    }
})

router.post('/submission', workerAuthMiddleware, async(req: any, res: any) => {
    try{
        const body = req.body;
        const userId = req.userId;
        const parseBody = createSubmissionInput.safeParse(body);

        if(!parseBody.success) {
            return res.status(400).json({
                msg: "Invalid input"
            });
        }
        
        const task: any = await getNextTask(Number(userId));

        if(!task || task?.id != Number(parseBody.data.taskId)) {
            return res.status(400).json({
                msg: "Task ID mismatch or task not found"
            });
        }
        const amount = (Number(task.amount) / TOTAL_SUBMISSIONS).toString();
        const submission = await prisma.$transaction(async tx => {
            const submission = await prisma.submission.create({
                data: {
                    option_id: Number(parseBody.data.selection),
                    worker_id: userId,
                    task_id: Number(parseBody.data.taskId),
                    amount
                }
            })
            await prisma.worker.update({
                where:{
                    id: userId
                },
                data: {
                    pending_amount: {
                        increment: Number(amount)
                    }
                }
            })
            return submission;
        })
        

        const nextTask = await getNextTask(Number(userId));
        res.json({
            nextTask,
            amount
        })
    }catch(e) {
        console.log(e);
    }
})

router.get('/balance', workerAuthMiddleware, async(req: any, res: any) => {
    try{
        const userId = req.userId;
        const worker = await prisma.worker.findFirst({
            where: {
                id: Number(userId)
            }
        })
        res.json({
            pendingAmount: worker?.pending_amount,
            lockedAmount: worker?.locked_amount
        })
    }catch(e) {
        console.log(e);
    }
})

router.post('/payout', workerAuthMiddleware, async(req: any, res: any) => {
    try{
        const userId = req.userId;
        const worker = await prisma.worker.findFirst({
            where: {
                id: Number(userId)
            }
        })

        if(!worker) {
            return res.status(401).json({
                msg: "User not found"
            })
        }

        const address = worker.address;
        const txnId = "0x1231231312";

        await prisma.$transaction(async tx => {
            await tx.worker.update({
                where: {
                    id: Number(userId)
                },
                data: {
                    pending_amount: {
                        decrement: worker.pending_amount,
                    },
                    locked_amount: {
                        increment: worker.pending_amount
                    }
                }
            })
            await tx.payout.create({
                data: {
                    user_id: userId,
                    amount: worker.pending_amount,
                    status: "Processing",
                    signature: txnId
                }
            })
        })
        res.json({
            msg: 'Processing payout',
            amount: worker.pending_amount
        })
    }catch(e){
        console.log(e) 
    }
})

module.exports = router;