import { prisma } from "@/lib/prisma"

async function main() {
  const email = process.env.E2E_ADMIN_EMAIL
  if (!email) {
    throw new Error("E2E_ADMIN_EMAIL is required")
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "admin", name: "E2E Admin" },
    create: {
      email,
      name: "E2E Admin",
      role: "admin",
    },
    select: { id: true, email: true, role: true },
  })

  console.log(JSON.stringify({ event: "seed_test_admin", user }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
