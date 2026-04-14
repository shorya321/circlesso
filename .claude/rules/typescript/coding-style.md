---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

> This file extends [common/coding-style.md](../common/coding-style.md) with TypeScript specific content.

# TypeScript Coding Style

## Strict Mode

`tsconfig.json` has `strict: true`. No exceptions.

## Types

- Use `interface` for object shapes (CircleMember, Auth0User, etc.)
- Use `type` for unions and intersections (ProvisioningStatus, MemberWithStatus)
- All types in `types/index.ts`
- No `any` — use `unknown` and narrow

## API Route Handlers

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  // 1. Validate session
  // 2. Parse and validate body with Zod
  // 3. Call business logic
  // 4. Return NextResponse.json()
}
```

## Zod Validation

```typescript
import { z } from "zod";

const migrateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  circleMemberId: z.string(),
});

// In route handler:
const body = migrateSchema.parse(await request.json());
```

## Imports

- Use `@/` alias for project imports
- Group: external → internal → types
- Use `import type` for type-only imports
