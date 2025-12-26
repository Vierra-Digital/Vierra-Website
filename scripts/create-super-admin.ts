import { prisma } from '../lib/prisma';
import { encrypt } from '../lib/crypto';

async function main() {
    const email = 'business@alexshick.com';
    const password = 'bird271DANK';
    const role = 'admin';

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        // Update existing user to be admin
        await prisma.user.update({
            where: { email },
            data: {
                passwordEnc: encrypt(password),
                role: role,
            },
        });
        console.log(`✅ Updated existing user ${email} to super admin`);
    } else {
        // Create new user
        await prisma.user.create({
            data: {
                email: email.toLowerCase(),
                passwordEnc: encrypt(password),
                role: role,
            },
        });
        console.log(`✅ Created super admin user: ${email}`);
    }

    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👑 Role: ${role}`);
}

main()
    .catch((e) => {
        console.error('❌ Error creating super admin:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

