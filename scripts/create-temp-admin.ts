import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

async function main() {
  // TEMPORARY ADMIN CREDENTIALS - EASY TO REMOVE
  const email = "temp-admin@vierradev.com";
  const plainPassword = "TempAdmin2024!";
  
  // Check if temp admin already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    console.log("⚠️  Temporary admin already exists!");
    console.log("Email:", email);
    console.log("Password:", plainPassword);
    console.log("\nTo remove this temporary admin, run:");
    console.log("npm run remove-temp-admin");
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordEnc: encrypt(plainPassword),
      role: "admin",
    },
  });

  console.log("✅ TEMPORARY ADMIN CREATED");
  console.log("Email:", email);
  console.log("Password:", plainPassword);
  console.log("\n⚠️  IMPORTANT: This is a temporary admin account!");
  console.log("To remove this temporary admin, run:");
  console.log("npm run remove-temp-admin");
  console.log("\nOr manually delete the user with email:", email);
}

main()
  .catch((err) => {
    console.error("❌ Error creating temporary admin:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
