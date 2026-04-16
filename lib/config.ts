import { z } from "zod";

const envSchema = z.object({
  // Auth0 Management API (M2M)
  AUTH0_DOMAIN: z.string().min(1, "AUTH0_DOMAIN is required"),
  AUTH0_TENANT_DOMAIN: z.string().min(1, "AUTH0_TENANT_DOMAIN is required"),
  AUTH0_M2M_CLIENT_ID: z.string().min(1, "AUTH0_M2M_CLIENT_ID is required"),
  AUTH0_M2M_CLIENT_SECRET: z.string().min(1, "AUTH0_M2M_CLIENT_SECRET is required"),
  AUTH0_DB_CONNECTION: z.string().default("Username-Password-Authentication"),

  // Auth0 Admin Login (v4)
  AUTH0_CLIENT_ID: z.string().min(1, "AUTH0_CLIENT_ID is required"),
  AUTH0_CLIENT_SECRET: z.string().min(1, "AUTH0_CLIENT_SECRET is required"),
  AUTH0_SECRET: z.string().min(16, "AUTH0_SECRET must be at least 16 characters"),
  APP_BASE_URL: z.string().url("APP_BASE_URL must be a valid URL"),

  // Circle.so Admin API v2
  CIRCLE_API_TOKEN: z.string().min(1, "CIRCLE_API_TOKEN is required"),
  CIRCLE_COMMUNITY_ID: z.string().min(1, "CIRCLE_COMMUNITY_ID is required"),

  // Resend Email
  RESEND_API_KEY: z.string().startsWith("re_", "RESEND_API_KEY must start with 're_'"),
  EMAIL_FROM: z.string().email("EMAIL_FROM must be a valid email"),
  EMAIL_REPLY_TO: z.string().email("EMAIL_REPLY_TO must be a valid email"),

  // Provisioning Config
  PASSWORD_TICKET_TTL: z.coerce.number().int().positive().default(604800),
  PASSWORD_TICKET_RESULT_URL: z.string().url("PASSWORD_TICKET_RESULT_URL must be a valid URL"),

  // Admin Role (Auth0 role name for dashboard access)
  ADMIN_ROLE_NAME: z.string().default("superadmin"),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (_config) return _config;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Environment validation failed:\n${errors}\n\nCheck .env.local against .env.example`
    );
  }

  _config = result.data;
  return _config;
}

// Reset config cache (for testing)
export function resetConfig(): void {
  _config = null;
}
