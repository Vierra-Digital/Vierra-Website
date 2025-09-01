import { prisma } from "@/lib/prisma";

async function main() {
  const tempAdminEmail = "temp-admin@vierradev.com";
  
  // Find the temporary admin user
  const tempAdmin = await prisma.user.findUnique({
    where: { email: tempAdminEmail }
  });

  if (!tempAdmin) {
    console.log("ℹ️  No temporary admin found with email:", tempAdminEmail);
    return;
  }

  // Delete the temporary admin user
  await prisma.user.delete({
    where: { email: tempAdminEmail }
  });

  console.log("✅ TEMPORARY ADMIN REMOVED");
  console.log("Deleted user:", tempAdminEmail);
  console.log("User ID:", tempAdmin.id);
}

main()
  .catch((err) => {
    console.error("❌ Error removing temporary admin:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
