/**
 * Cleanup Test Games
 *
 * Deletes all test games created by test-config-snapshot.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanup() {
  console.log('🧹 Cleaning up test games...')

  const result = await prisma.game.deleteMany({
    where: {
      name: {
        startsWith: 'TEST:'
      }
    }
  })

  console.log(`✅ Deleted ${result.count} test games`)
}

cleanup()
  .catch((e) => {
    console.error('❌ Cleanup failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
