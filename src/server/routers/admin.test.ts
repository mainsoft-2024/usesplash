import { initTRPC } from "@trpc/server"
import { describe, expect, it, vi } from "vitest"

const t = initTRPC.context<{ session: { user: { id: string } } }>().create()

vi.mock("@/lib/trpc/server", () => ({
  router: t.router,
}))

vi.mock("./_admin-procedure", () => ({
  adminProcedure: t.procedure,
}))

const { adminRouter } = await import("./admin")
const buildCaller = () => {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ role: "admin" }),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    usageLog: {
      groupBy: vi.fn(),
    },
  }

  const caller = adminRouter.createCaller({
    prisma: prisma as never,
    session: { user: { id: "admin-user-id" } },
  } as never)

  return { caller, prisma }
}

describe("admin.listUsers", () => {
  it("applies tier filter", async () => {
    const { caller, prisma } = buildCaller()
    prisma.user.findMany.mockResolvedValue([])
    prisma.user.count.mockResolvedValue(0)
    prisma.usageLog.groupBy.mockResolvedValue([])

    await caller.listUsers({ tiers: ["pro"] })

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              subscription: { is: { tier: { in: ["pro"] } } },
            }),
          ]),
        }),
      }),
    )
  })

  it("applies inactive activity filter", async () => {
    const { caller, prisma } = buildCaller()
    prisma.user.findMany.mockResolvedValue([])
    prisma.user.count.mockResolvedValue(0)
    prisma.usageLog.groupBy.mockResolvedValue([])

    await caller.listUsers({ activity: "inactive" })

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              usageLogs: {
                none: {
                  createdAt: expect.objectContaining({ gte: expect.any(Date) }),
                },
              },
            }),
          ]),
        }),
      }),
    )
  })

  it("applies signup date range filter", async () => {
    const { caller, prisma } = buildCaller()
    const signupFrom = new Date("2026-01-01T00:00:00.000Z")
    const signupTo = new Date("2026-02-01T00:00:00.000Z")

    prisma.user.findMany.mockResolvedValue([])
    prisma.user.count.mockResolvedValue(0)
    prisma.usageLog.groupBy.mockResolvedValue([])

    await caller.listUsers({ signupFrom, signupTo })

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              createdAt: { gte: signupFrom, lte: signupTo },
            }),
          ]),
        }),
      }),
    )
  })

  it("returns additive cost economics fields", async () => {
    const { caller, prisma } = buildCaller()
    const joinedAt = new Date()
    joinedAt.setMonth(joinedAt.getMonth() - 2)

    prisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "User 1",
        email: "u1@example.com",
        role: "user",
        createdAt: joinedAt,
        _count: { projects: 3 },
        subscription: { tier: "pro" },
      },
    ])
    prisma.user.count.mockResolvedValue(1)
    prisma.usageLog.groupBy.mockResolvedValue([
      {
        userId: "u1",
        _sum: { count: 10, imageCostUsd: 1.2, llmCostUsd: 0.3, blobCostUsd: 0.5 },
      },
    ])

    const result = await caller.listUsers({})

    expect(result.users).toHaveLength(1)
    expect(result.users[0]).toEqual(
      expect.objectContaining({
        id: "u1",
        totalGenerations: 10,
        totalCostUsd: 2,
        ltvUsd: expect.any(Number),
        marginUsd: expect.any(Number),
      }),
    )
    expect(result.users[0].marginUsd).toBe(result.users[0].ltvUsd - result.users[0].totalCostUsd)
  })
})
