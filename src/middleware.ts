import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  // Auth is handled at the page level using auth() server function.
  // Middleware only handles basic routing.
  const isLoginPage = req.nextUrl.pathname === "/login"
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ??
    req.cookies.get("__Secure-authjs.session-token")?.value

  // Redirect logged-in users away from /login
  if (sessionToken && isLoginPage) {
    return NextResponse.redirect(new URL("/projects", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
}
