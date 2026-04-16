# Dashboard Stats Cards

**Date:** 2026-04-16
**Status:** Approved

## Context

The admin dashboard currently shows a member table only. Admins must scroll through the table to understand overall migration progress. Four stats cards above the table will give an at-a-glance summary of provisioning status.

## Design

### Stats Cards

| Card | Computation | Icon | Subtitle |
|------|------------|------|----------|
| **Total Members** | `members.length` | `Users` (lucide) | All circle members |
| **Provisioned** | count where `auth0Status` is `email_sent` or `password_changed` | `UserCheck` (lucide) | Migration complete |
| **Pending** | count where `auth0Status` is `not_provisioned` or `auth0_created` | `Clock` (lucide) | Awaiting migration |
| **Failed** | count where `auth0Status` is `failed` | `AlertTriangle` (lucide) | Needs attention |

**New icons**: `UserCheck`, `Clock`, and `AlertTriangle` are new Lucide icon additions to this project (not previously in DESIGN.md).

### Card Style

Use `<Card size="sm">` with default styling (component handles `bg-card`, `ring-1 ring-foreground/10`, `rounded-xl` internally — do not add these as extra classes):

- **Top row**: Lucide icon (`h-4 w-4`, `text-muted-foreground`) + title (`text-sm font-medium text-muted-foreground`)
- **Middle**: Count (`text-3xl font-bold font-mono text-foreground`) — uses `font-mono` (Fira Code) per design system convention for numeric data
- **Bottom**: Subtitle (`text-xs text-muted-foreground`)

### Layout

- Grid: `grid grid-cols-2 md:grid-cols-4 gap-4`
- Placement: between page description and Migrate All button
- Spacing: relies on existing `mt-6` from parent container; cards grid uses `mb-6` only for separation from table below

### Loading State

When `loading` is true, render 4 skeleton cards with `animate-pulse`:
- Minimum card height: `min-h-[7rem]` to prevent collapse
- Gray placeholder blocks (`bg-muted rounded`) for icon area, number, and text

### Data Source

Client-side computation from existing `MemberWithStatus[]` array. No new API endpoint needed. Stats update automatically when member data refreshes (after migrate/retry actions).

## Architecture

### Files

| Action | File | Purpose |
|--------|------|---------|
| Create | `components/stats-cards.tsx` | StatsCards component |
| Create | `components/stats-cards.test.tsx` | Unit tests: computation correctness, skeleton render |
| Modify | `app/dashboard/page.tsx` | Restructure JSX to add StatsCards above table |

### Component Interface

```typescript
interface StatsCardsProps {
  members: MemberWithStatus[];
  loading: boolean;
}
```

### Integration

The existing `page.tsx` wraps content in a `loading` conditional. Restructure so `<StatsCards>` sits outside the conditional (it handles its own loading state internally):

```tsx
// app/dashboard/page.tsx — full updated return block
return (
  <div>
    <h1 className="text-2xl font-semibold text-foreground">
      Existing Members
    </h1>
    <p className="mt-2 text-sm text-muted-foreground">
      View and manage Circle.so community members and their Auth0 provisioning
      status.
    </p>

    <div className="mt-6">
      <StatsCards members={members} loading={loading} />

      {loading ? (
        <MemberTableSkeleton />
      ) : (
        <>
          <div className="mb-4">
            <MigrateAllButton
              members={members}
              onComplete={fetchMembers}
            />
          </div>
          <MemberTable members={members} onMemberUpdated={fetchMembers} />
        </>
      )}
    </div>
  </div>
);
```

## Verification

1. Run `npm run dev` and navigate to `/dashboard`
2. Verify 4 cards appear above the table with correct counts
3. Verify cards show skeleton state during loading
4. Throttle network to Slow 3G and verify 4 skeleton cards render during fetch
5. Migrate a member and verify card counts update
6. Verify responsive layout: 2 columns on mobile, 4 on desktop
7. Run `npx tsc --noEmit` to verify types
8. Run `npm run build` to verify production build
9. Run `npm test -- stats-cards` to verify unit tests pass
