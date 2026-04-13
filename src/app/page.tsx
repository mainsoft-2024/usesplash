import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { LandingPage } from "@/components/landing-page"

export default async function Home() {
  const session = await auth()
  if (session?.user) {
    redirect("/projects")
  }
  return <LandingPage />
}
