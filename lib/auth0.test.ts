import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

// Test proxy route matching configuration
const proxyConfig = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

describe("proxy.ts route matching", () => {
  it("matches /dashboard routes", () => {
    expect(
      unstable_doesMiddlewareMatch({ config: proxyConfig, url: "/dashboard" })
    ).toBe(true);
  });

  it("matches /dashboard/settings", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config: proxyConfig,
        url: "/dashboard/settings",
      })
    ).toBe(true);
  });

  it("matches /auth/login", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config: proxyConfig,
        url: "/auth/login",
      })
    ).toBe(true);
  });

  it("matches /auth/callback", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config: proxyConfig,
        url: "/auth/callback",
      })
    ).toBe(true);
  });

  it("matches /auth/logout", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config: proxyConfig,
        url: "/auth/logout",
      })
    ).toBe(true);
  });

  it("matches /api/circle/members", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config: proxyConfig,
        url: "/api/circle/members",
      })
    ).toBe(true);
  });

  it("matches root /", () => {
    expect(
      unstable_doesMiddlewareMatch({ config: proxyConfig, url: "/" })
    ).toBe(true);
  });

  it("does NOT match /_next/static files", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config: proxyConfig,
        url: "/_next/static/chunk.js",
      })
    ).toBe(false);
  });

  it("does NOT match /_next/image files", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config: proxyConfig,
        url: "/_next/image?url=test",
      })
    ).toBe(false);
  });

  it("does NOT match /favicon.ico", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config: proxyConfig,
        url: "/favicon.ico",
      })
    ).toBe(false);
  });

  it("does NOT match /robots.txt", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config: proxyConfig,
        url: "/robots.txt",
      })
    ).toBe(false);
  });

  it("does NOT match /sitemap.xml", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config: proxyConfig,
        url: "/sitemap.xml",
      })
    ).toBe(false);
  });
});

// Mock @auth0/nextjs-auth0/server since it uses ESM
jest.mock("@auth0/nextjs-auth0/server", () => ({
  Auth0Client: jest.fn().mockImplementation(() => ({
    middleware: jest.fn(),
    getSession: jest.fn(),
    withPageAuthRequired: jest.fn(),
    withApiAuthRequired: jest.fn(),
  })),
}));

describe("Auth0 client", () => {
  it("exports auth0 instance with expected methods", () => {
    const { auth0 } = require("./auth0");
    expect(auth0).toBeDefined();
    expect(auth0.middleware).toBeDefined();
    expect(auth0.getSession).toBeDefined();
    expect(auth0.withPageAuthRequired).toBeDefined();
    expect(auth0.withApiAuthRequired).toBeDefined();
  });

  it("creates Auth0Client from @auth0/nextjs-auth0/server", () => {
    const { Auth0Client } = require("@auth0/nextjs-auth0/server");
    expect(Auth0Client).toHaveBeenCalledTimes(1);
  });
});
