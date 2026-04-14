// Auth0 v4 middleware — protects /dashboard/* routes
// TODO: Full implementation in F004
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Placeholder: F004 will add Auth0 session validation
  // For now, allow all requests through
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
