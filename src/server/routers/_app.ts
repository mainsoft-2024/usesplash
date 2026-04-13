import { router } from "@/lib/trpc/server"
import { projectRouter } from "./project"
import { logoRouter } from "./logo"
import { chatRouter } from "./chat"
import { generationRouter } from "./generation"
import { exportRouter } from "./export"
import { subscriptionRouter } from "./subscription"

export const appRouter = router({
  project: projectRouter,
  logo: logoRouter,
  chat: chatRouter,
  generation: generationRouter,
  export: exportRouter,
  subscription: subscriptionRouter,
})

export type AppRouter = typeof appRouter
