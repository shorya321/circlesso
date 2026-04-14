# CircleSo Admin — Design System

Generated via ui-ux-pro-max skill. Follow this for ALL UI features (F012–F016 and beyond).

## Style: Data-Dense Dashboard

Clean, space-efficient, maximum data visibility. Minimal padding, grid layout, KPI cards, data tables.

**Best for:** Admin dashboards, enterprise reporting, operational dashboards.
**Avoid:** Ornate/decorative design, excessive whitespace, missing filters.

## Color Palette

| Token | Hex | CSS Variable | Usage |
|-------|-----|-------------|-------|
| Primary | `#1E40AF` | `--color-primary` | Primary buttons, active states, focus rings |
| On Primary | `#FFFFFF` | `--color-on-primary` | Text on primary backgrounds |
| Secondary | `#3B82F6` | `--color-secondary` | Secondary buttons, links, info badges |
| Accent | `#D97706` | `--color-accent` | CTA buttons, attention indicators (WCAG 3:1) |
| Background | `#F8FAFC` | `--color-background` | Page background |
| Foreground | `#1E3A8A` | `--color-foreground` | Primary text |
| Muted | `#E9EEF6` | `--color-muted` | Muted backgrounds, disabled states |
| Border | `#DBEAFE` | `--color-border` | Borders, dividers, table lines |
| Destructive | `#DC2626` | `--color-destructive` | Errors, delete actions, failed states |
| Ring | `#1E40AF` | `--color-ring` | Focus ring outline |
| Success | `#16A34A` | `--color-success` | Success states, completed actions |

## Status Badge Colors

Use these consistently across all member tables and status indicators:

| Status | Color | Hex | shadcn Badge Variant | Tailwind Classes |
|--------|-------|-----|---------------------|-----------------|
| Not Provisioned | Red | `#DC2626` | `destructive` | `bg-red-100 text-red-700 border-red-200` |
| Auth0 Created, Email Pending | Amber | `#D97706` | custom | `bg-amber-100 text-amber-700 border-amber-200` |
| Provisioned + Email Sent | Green | `#16A34A` | custom | `bg-green-100 text-green-700 border-green-200` |
| Already Provisioned | Blue | `#3B82F6` | `secondary` | `bg-blue-100 text-blue-700 border-blue-200` |
| Failed | Red | `#DC2626` | `destructive` | `bg-red-100 text-red-700 border-red-200` |

## Typography

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| Headings | Fira Sans | 300, 400, 500, 600, 700 | Page titles, section headers, nav items |
| Body | Fira Sans | 400, 500 | Paragraphs, labels, descriptions |
| Data / Monospace | Fira Code | 400, 500, 600 | Email addresses, IDs, status codes, counts |

**Google Fonts import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

**Tailwind config:**
```ts
fontFamily: {
  sans: ['Fira Sans', 'system-ui', 'sans-serif'],
  mono: ['Fira Code', 'monospace'],
}
```

## Layout

### Dashboard Shell
- Sidebar navigation (collapsible on mobile)
- Two tabs: "Existing Members" and "Add New Member"
- Admin name + logout button in header
- Content area with max-width `1440px`, centered

### Spacing Scale
- Page padding: `p-6` (24px)
- Card padding: `p-4` (16px)
- Table cell padding: `px-4 py-3`
- Gap between cards: `gap-4` (16px)
- Section spacing: `space-y-6` (24px)

### Breakpoints
| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | 375px | Single column, stacked cards |
| Tablet | 768px | Sidebar collapses to hamburger |
| Desktop | 1024px | Full sidebar + content |
| Wide | 1440px | Max content width |

## Component Patterns

### Member Table (F013)
- Use shadcn `<Table>` with semantic `<TableHeader>`, `<TableBody>`, `<TableRow>`
- Row hover: `hover:bg-muted/50` with `transition-colors duration-150`
- Status badge in its own column
- Action button (Migrate/Retry) right-aligned
- Email addresses in `font-mono` (Fira Code)
- Empty state: "No members found" centered message

### Status Badge (F013)
```tsx
// Use Badge component with custom variants
<Badge variant="destructive">Not Provisioned</Badge>
<Badge className="bg-amber-100 text-amber-700 border-amber-200">Email Pending</Badge>
<Badge className="bg-green-100 text-green-700 border-green-200">Email Sent</Badge>
<Badge variant="secondary">Already Provisioned</Badge>
```

### Provision Button (F013, F014)
- Primary action: `variant="default"` with primary color
- Bulk action: Full width above table, `variant="default"`
- Disabled during processing: `disabled` + `opacity-50` + `cursor-not-allowed`
- Loading state: Lucide `Loader2` icon with `animate-spin`

### New Member Form (F015)
- Card container with `p-6`
- Labels above inputs (not inline)
- Input spacing: `space-y-4`
- Access group: `<Select>` dropdown populated from API
- Submit button: Primary color, full width on mobile, auto width on desktop
- Validation errors: Red text below input, `text-sm text-destructive`

### Toast Notifications (F012B)
- Success: Green accent, auto-dismiss 4s
- Error: Red/destructive, persistent until dismissed
- Progress: "Migrating 5/30..." with progress bar inside toast

### Loading Skeleton (F012B)
- Table skeleton: 5 rows of `h-4 bg-muted animate-pulse rounded`
- Stagger animation: each row delayed by 50ms
- Match exact table column widths

## Effects & Interactions

| Element | Effect | Duration |
|---------|--------|----------|
| Table row hover | `bg-muted/50` background | 150ms |
| Button hover | Slight darken (shadcn default) | 150ms |
| Status badge hover | Tooltip with full status text | instant |
| Bulk migrate progress | Animated progress bar | real-time |
| Page transitions | None (instant navigation) | — |
| Loading skeleton | `animate-pulse` | continuous |
| Toast enter/exit | Slide in from top-right | 300ms |

## Icons

Use **Lucide React** (already installed) for all icons. No emojis.

| Icon | Usage | Import |
|------|-------|--------|
| `Users` | Members tab | `lucide-react` |
| `UserPlus` | Add New Member tab | `lucide-react` |
| `ArrowRight` | Migrate button | `lucide-react` |
| `RefreshCw` | Retry Email button | `lucide-react` |
| `Loader2` | Loading spinner | `lucide-react` |
| `Check` | Success indicator | `lucide-react` |
| `X` | Error/close | `lucide-react` |
| `LogOut` | Logout button | `lucide-react` |
| `Shield` | Admin badge | `lucide-react` |

## Accessibility

- Text contrast: 4.5:1 minimum (WCAG AA)
- Focus states visible on all interactive elements (`ring-2 ring-ring ring-offset-2`)
- `cursor-pointer` on all clickable elements
- `prefers-reduced-motion`: disable `animate-pulse` and transitions
- Keyboard navigation: Tab through table rows and action buttons
- Screen reader: `aria-label` on icon-only buttons, `role="status"` on badges

## Pre-Delivery Checklist

Run through this before marking any UI feature as `passes: true`:

- [ ] Colors match this design system (no hardcoded hex outside this palette)
- [ ] Status badges use the exact variant/class combos defined above
- [ ] Typography: headings use Fira Sans, data uses Fira Code
- [ ] All icons are Lucide React SVGs (no emojis)
- [ ] `cursor-pointer` on every clickable element
- [ ] Hover states with 150ms transitions
- [ ] Loading skeletons for async data
- [ ] Toast notifications for success/error
- [ ] Responsive at 375px, 768px, 1024px, 1440px
- [ ] Focus states visible for keyboard nav
- [ ] No `console.log` in production components
