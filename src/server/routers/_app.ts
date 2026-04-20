import { router } from "@/lib/trpc/server"
import { projectRouter } from "./project"
import { logoRouter } from "./logo"
import { chatRouter } from "./chat"
import { generationRouter } from "./generation"
import { exportRouter } from "./export"
import { subscriptionRouter } from "./subscription"
import { adminRouter } from "./admin"
import { usageRouter } from "./usage"
import { adminInsightsRouter } from "./admin-insights"

export const appRouter = router({
  project: projectRouter,
  logo: logoRouter,
  chat: chatRouter,
  generation: generationRouter,
  export: exportRouter,
  subscription: subscriptionRouter,
  admin: adminRouter,
  usage: usageRouter,
  adminInsights: adminInsightsRouter,
})

export type AppRouter = typeof appRouter
