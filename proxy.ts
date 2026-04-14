// Next.js 16 proxy (replaces deprecated middleware.ts)
// Auth0 v4 route protection — handles auth routes and rolling sessions
import { auth0 } from "@/lib/auth0";

export async function proxy(request: Request) {
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    // Broad matcher required for Auth0 rolling sessions and auth route handling.
    // Excludes static files and metadata.
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
