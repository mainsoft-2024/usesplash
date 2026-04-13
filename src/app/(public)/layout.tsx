import { auth } from "@/lib/auth"
import { SharedHeader } from "@/components/shared-header"
import { SharedFooter } from "@/components/shared-footer"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const headerSession = session?.user ? { user: { id: (session.user as { id: string }).id, email: session.user.email, name: session.user.name, image: session.user.image } } : null
  return (
    <>
      <SharedHeader session={headerSession} />
      <main className="pt-16">{children}</main>
      <SharedFooter />
    </>
  )
}
