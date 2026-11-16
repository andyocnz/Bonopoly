import { Router } from 'express'
import prisma from '../db'

const router = Router()

// Public invoice data fetch
// This is protected by txId and the frontend also uses an encrypted 'data' param
router.get('/invoice/:txId', async (req, res) => {
    try {
        const { txId } = req.params

        const tx = await prisma.creditTransaction.findUnique({
            where: { id: txId },
            include: {
                educator: {
                    select: {
                        email: true,
                        id: true
                    }
                }
            }
        })

        if (!tx) {
            return res.status(404).json({ success: false, error: 'Transaction not found' })
        }

        res.json({
            success: true,
            transaction: {
                id: tx.id,
                createdAt: tx.createdAt,
                type: tx.type,
                amount: tx.amount,
                balanceAfter: tx.balanceAfter,
                educatorEmail: tx.educator.email
            }
        })
    } catch (error) {
        console.error('Error fetching public invoice:', error)
        res.status(500).json({ success: false, error: 'Internal server error' })
    }
})

export default router
