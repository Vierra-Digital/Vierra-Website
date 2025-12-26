import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUsers() {
  try {
    console.log('🔍 Checking users in database...\n')
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { id: 'asc' }
    })

    console.log(`📊 Found ${users.length} users:\n`)
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`)
      console.log(`   Name: ${user.name || 'NULL'}`)
      console.log(`   Email: ${user.email || 'NULL'}`)
      console.log(`   Role: ${user.role}`)
      console.log('')
    })

    // Check specifically for users with names
    const usersWithNames = users.filter(user => user.name && user.name.trim().length > 0)
    console.log(`✅ Users with names: ${usersWithNames.length}`)
    
    const usersWithoutNames = users.filter(user => !user.name || user.name.trim().length === 0)
    console.log(`❌ Users without names: ${usersWithoutNames.length}`)

  } catch (error) {
    console.error('❌ Error checking users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUsers()
