import { PrismaClient } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { config } from "dotenv";
import { workerAuthMiddleware } from "../middleware";
import { getNextTask } from "../db";
import { createSubmissionInput } from "../types";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

const connection = new Connection(process.env.RPC_URL ?? "");

config();
const router = Router();
const prisma = new PrismaClient();
const TOTAL_DECIMAL = 1000_000_000;
const TOTAL_SUBMISSIONS = 100;


router.post('/signin', async(req: any, res: any) => {
    try{
        const { publicKey, signature } = req.body;
        const message = new TextEncoder().encode("Sign into cryptolabeler as a worker");

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

        const existingUser = await prisma.worker.findFirst({
            where: {
                address: publicKey
            }
        });

        if(existingUser) {
            const token = jwt.sign({
                userId: existingUser.id
            }, process.env.WORKER_JWT_SECRET || "")

            res.json({
                token,
                amount: existingUser.pending_amount / TOTAL_DECIMAL
            })
        } else {
            const user = await prisma.worker.create({
                data: {
                    address: publicKey,
                    pending_amount: 0,
                    locked_amount: 0
                }
            })
            const token = jwt.sign({
                userId: user.id
            }, process.env.WORKER_JWT_SECRET || "")

            res.json({
                token,
                amount: 0
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

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: new PublicKey("Cs13zQteNujqB26PXfLAZVmfgvoFchMFRzaZ8UuvdYPs"),
                toPubkey: new PublicKey(worker.address),
                lamports: 1000_000_000 * worker.pending_amount / TOTAL_DECIMAL,
            })
        );

        const address = worker.address;
        const keypair = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY || ""));

        let signature = "";
        try {
            signature = await sendAndConfirmTransaction(
                connection,
                transaction,
                [keypair],
            );
        
         } catch(e) {
            return res.json({
                message: "Transaction failed"
            })
         }
        
        console.log(signature)

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
                    signature: signature
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