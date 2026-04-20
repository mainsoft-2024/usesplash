import { TRPCError } from "@trpc/server"
import { protectedProcedure } from "@/lib/trpc/server"

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const dbUser = await ctx.prisma.user.findUnique({
    where: { id: ctx.session.user.id },
    select: { role: true },
  })

  if (!dbUser || dbUser.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "관리자 권한이 필요합니다." })
  }

  return next()
})
