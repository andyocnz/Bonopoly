import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    throw new Error('Set ADMIN_PASSWORD (and optionally ADMIN_USERNAME) before running this script')
  }

  console.log('Creating admin user...')

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10)

  // Create or update admin
  const admin = await prisma.admin.upsert({
    where: { username },
    update: { password: hashedPassword },
    create: {
      username,
      password: hashedPassword,
    },
  })

  console.log('Admin user created/updated:', admin.username)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
