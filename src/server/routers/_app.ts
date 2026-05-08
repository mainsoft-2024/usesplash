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
import { paymentRouter } from "./payment"

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
  payment: paymentRouter,
})

export type AppRouter = typeof appRouter
