import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

async function main() {
  const email = "test@gmail.com";
  const plainPassword = "TempAdmin123!";

  const user = await prisma.user.create({
    data: {
      email,
      passwordEnc: encrypt(plainPassword),
      role: "admin",
    },
  });

  console.log("Admin created:", user.email);
  console.log("Temp password:", plainPassword);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
