// Next.js 16 proxy (replaces deprecated middleware.ts)
// Auth0 v4 route protection — protects /dashboard/* routes
// TODO: Full Auth0 implementation in F004
import { NextResponse } from "next/server";

export function proxy(request: Request) {
  // Placeholder: F004 will wire up auth0.middleware(request)
  // For now, allow all requests through
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
