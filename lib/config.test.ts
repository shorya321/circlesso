import { getConfig, resetConfig } from "./config";

const VALID_ENV = {
  AUTH0_DOMAIN: "test.us.auth0.com",
  AUTH0_TENANT_DOMAIN: "test.us.auth0.com",
  AUTH0_M2M_CLIENT_ID: "m2m-client-id",
  AUTH0_M2M_CLIENT_SECRET: "m2m-client-secret",
  AUTH0_DB_CONNECTION: "Username-Password-Authentication",
  AUTH0_CLIENT_ID: "web-client-id",
  AUTH0_CLIENT_SECRET: "web-client-secret",
  AUTH0_SECRET: "a-secret-that-is-at-least-16-chars",
  APP_BASE_URL: "http://localhost:3001",
  CIRCLE_API_TOKEN: "circle-api-token",
  CIRCLE_COMMUNITY_ID: "community-123",
  RESEND_API_KEY: "re_test_key_123",
  EMAIL_FROM: "noreply@helpucompli.com",
  PASSWORD_TICKET_TTL: "604800",
  PASSWORD_TICKET_RESULT_URL: "https://compass.helpucompli.com",
};

const originalEnv = process.env;

beforeEach(() => {
  resetConfig();
  process.env = { ...originalEnv, ...VALID_ENV };
});

afterEach(() => {
  process.env = originalEnv;
  resetConfig();
});

describe("getConfig", () => {
  it("returns valid config when all env vars are set", () => {
    const config = getConfig();
    expect(config.AUTH0_DOMAIN).toBe("test.us.auth0.com");
    expect(config.AUTH0_M2M_CLIENT_ID).toBe("m2m-client-id");
    expect(config.AUTH0_CLIENT_ID).toBe("web-client-id");
    expect(config.CIRCLE_API_TOKEN).toBe("circle-api-token");
    expect(config.RESEND_API_KEY).toBe("re_test_key_123");
    expect(config.EMAIL_FROM).toBe("noreply@helpucompli.com");
    expect(config.PASSWORD_TICKET_TTL).toBe(604800);
    expect(config.PASSWORD_TICKET_RESULT_URL).toBe("https://compass.helpucompli.com");
  });

  it("uses default AUTH0_DB_CONNECTION when not set", () => {
    delete process.env.AUTH0_DB_CONNECTION;
    const config = getConfig();
    expect(config.AUTH0_DB_CONNECTION).toBe("Username-Password-Authentication");
  });

  it("uses default PASSWORD_TICKET_TTL when not set", () => {
    delete process.env.PASSWORD_TICKET_TTL;
    const config = getConfig();
    expect(config.PASSWORD_TICKET_TTL).toBe(604800);
  });

  it("throws on missing AUTH0_DOMAIN", () => {
    delete process.env.AUTH0_DOMAIN;
    expect(() => getConfig()).toThrow("Environment validation failed");
    expect(() => getConfig()).toThrow("AUTH0_DOMAIN");
  });

  it("throws on missing AUTH0_M2M_CLIENT_ID", () => {
    delete process.env.AUTH0_M2M_CLIENT_ID;
    expect(() => getConfig()).toThrow("AUTH0_M2M_CLIENT_ID");
  });

  it("throws on missing AUTH0_M2M_CLIENT_SECRET", () => {
    delete process.env.AUTH0_M2M_CLIENT_SECRET;
    expect(() => getConfig()).toThrow("AUTH0_M2M_CLIENT_SECRET");
  });

  it("throws on missing CIRCLE_API_TOKEN", () => {
    delete process.env.CIRCLE_API_TOKEN;
    expect(() => getConfig()).toThrow("CIRCLE_API_TOKEN");
  });

  it("throws on missing CIRCLE_COMMUNITY_ID", () => {
    delete process.env.CIRCLE_COMMUNITY_ID;
    expect(() => getConfig()).toThrow("CIRCLE_COMMUNITY_ID");
  });

  it("throws on invalid RESEND_API_KEY (must start with re_)", () => {
    process.env.RESEND_API_KEY = "invalid-key";
    expect(() => getConfig()).toThrow("RESEND_API_KEY");
  });

  it("throws on invalid EMAIL_FROM (must be valid email)", () => {
    process.env.EMAIL_FROM = "not-an-email";
    expect(() => getConfig()).toThrow("EMAIL_FROM");
  });

  it("throws on invalid APP_BASE_URL (must be valid URL)", () => {
    process.env.APP_BASE_URL = "not-a-url";
    expect(() => getConfig()).toThrow("APP_BASE_URL");
  });

  it("throws on AUTH0_SECRET too short (min 16 chars)", () => {
    process.env.AUTH0_SECRET = "short";
    expect(() => getConfig()).toThrow("AUTH0_SECRET");
  });

  it("throws on invalid PASSWORD_TICKET_RESULT_URL", () => {
    process.env.PASSWORD_TICKET_RESULT_URL = "not-a-url";
    expect(() => getConfig()).toThrow("PASSWORD_TICKET_RESULT_URL");
  });

  it("caches config on repeated calls", () => {
    const cached = getConfig();
    process.env.AUTH0_DOMAIN = "changed.auth0.com";
    const second = getConfig();
    expect(second.AUTH0_DOMAIN).toBe(cached.AUTH0_DOMAIN);
  });

  it("resets cache with resetConfig", () => {
    getConfig(); // populate cache
    resetConfig();
    process.env.AUTH0_DOMAIN = "changed.auth0.com";
    const second = getConfig();
    expect(second.AUTH0_DOMAIN).toBe("changed.auth0.com");
  });
});
