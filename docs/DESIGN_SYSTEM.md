# Refnivo design system

This document describes the system that already exists; it is not a new look. Tokens live in `app/globals.css`, and components in `components/ui` and `components/dashboard/primitives.tsx`.

**Rule:** use tokens, never raw Tailwind palette classes (`text-indigo-600`, `bg-emerald-50`, …).

Raw colours are allowed only for:

- third-party brand marks (e.g. social platform icons);
- clearly illustrative mockups on the marketing site.

## Colour tokens

| Token | Use | Light | Dark |
| --- | --- | --- | --- |
| `primary` | Brand indigo-violet: links, active states, primary buttons, focus | `oklch(0.55 0.22 278)` | `oklch(0.7 0.17 278)` |
| `primary-foreground` | Text on a solid primary background | near white | deep indigo |
| `accent` / `accent-foreground` | Soft brand surface (selected chip, icon tile) and its text | `oklch(0.95 0.035 278)` | `oklch(0.3 0.06 278)` |
| `brand-from` → `brand-to` | The brand gradient (violet → blue). Only via `bg-gradient-brand` / `text-gradient-brand` | violet-600 → blue-500 | same |
| `background`, `card`, `popover` | Page and surfaces | white | navy |
| `foreground`, `muted-foreground` | Body text, secondary text | navy, slate | white, grey |
| `border`, `input`, `ring` | Lines, form borders, focus ring | — | — |
| `secondary`, `muted` | Neutral surfaces (secondary button, table header) | — | — |
| `ink` / `ink-foreground` | The one dark "focus" card per group, headlines on marketing | navy | navy |
| `success` | Positive state: dot, icon, solid badge | emerald | emerald |
| `success-strong` | Readable success **text** on a `bg-success/10` surface | emerald-700 | emerald-300 |
| `warning` | Attention state: border, dot, tint | amber | amber |
| `warning-strong` | Readable warning **text** on a `bg-warning/10–15` surface | amber-800 | amber-200 |
| `destructive` | Errors, destructive actions, rejected states | red | red |
| `chart-1…5` | Data series in charts only | — | — |

**Tinted surface pattern** (callouts, status pills):

- `bg-success/10 text-success-strong border-success/30`
- `bg-warning/10 text-warning-strong border-warning/40`
- `bg-destructive/10 text-destructive border-destructive/30`
- `bg-accent text-primary border-primary/15`

**Brand gradient:** use it only on the logo mark, the primary CTA (`CTAButton`), a headline accent word (`text-gradient-brand`) and full-width CTA banners. Use flat `accent` / `card` surfaces everywhere else.

## Typography

Font: Geist Sans (UI), Geist Mono (codes, order references, links).

| Role | Class |
| --- | --- |
| Hero headline (marketing) | `text-display` |
| Section headline (marketing) | `text-headline` |
| Lead paragraph | `text-lede` |
| Eyebrow label | `eyebrow` |
| Page title (app) | `PageHeader` → `text-xl sm:text-2xl font-semibold` |
| Card title | `CardTitle` |
| Body | `text-sm` (app), `text-base` (marketing) |
| Supporting / hint | `text-xs text-muted-foreground` |

One page title per screen. Headings follow document order (`h1` → `h2` → `h3`).

## Spacing & layout

- 4-px scale (Tailwind default).
- **App pages:** `space-y-6` between blocks; cards `p-4 sm:p-6`; KPI grids `grid-cols-2 xl:grid-cols-4` (two columns on phones).
- **Marketing sections:** `section-y` (72 px → 104 px); content width `max-w-6xl`.
- **Radius:** `--radius` 0.75 rem. Cards use `rounded-xl`, pills `rounded-full`.
- **Shadows:** cards are flat with a border. Use `shadow-md` only on hover, or on the primary CTA.

## Components

| Component | File | Notes |
| --- | --- | --- |
| Button | `components/ui/button.tsx` | Variants: `default` (primary), `outline`, `secondary`, `ghost`, `destructive`, `link`. Sizes: `xs`, `sm`, `default`, `lg`, `icon*`. As a link: `nativeButton={false} render={<Link … />}`. |
| CTAButton | `components/marketing/cta-button.tsx` | Gradient primary CTA (marketing only). |
| Input / Textarea / NativeSelect / Label | `components/ui/*` | Always paired with a visible `Label`. Errors via `aria-invalid` + message. |
| Card | `components/ui/card.tsx` | `size="sm"` for dense lists. |
| Badge | `components/ui/badge.tsx` | Variants: `default`, `secondary`, `outline`, `destructive`, `ghost`. |
| StatusBadge | `components/dashboard/primitives.tsx` | Every status has a text label as well as a colour; never rely on colour alone. |
| PageHeader, KpiCard, EmptyState | `components/dashboard/primitives.tsx` | EmptyState always says what is missing and offers the next action. |
| CampaignCard | `components/marketplace/campaign-card.tsx` | **The** campaign card, used by the public marketplace and the creator's Discover page. |
| ErrorState | `components/system/error-state.tsx` | Body for route error boundaries: retry + safe page + support. Shows only the digest. |
| Table | `components/ui/table.tsx` | Wrap in `overflow-x-auto rounded-xl border`. Prefer stacked rows on phones for key tables. |
| Sheet / Dialog | `components/ui/sheet.tsx`, `dialog.tsx` | Mobile menu, filters, confirmations. |
| Skeleton | `components/ui/skeleton.tsx` | `loading.tsx` per dashboard area. |

## States

- **Loading:** a skeleton in the route's `loading.tsx`. No blank screens.
- **Empty:** `EmptyState` with an icon, a plain-language title, one sentence, and one action.
- **Error:** form errors appear next to the field and in a toast. Route errors use `ErrorState`. Never show stack traces or provider messages.
- **Success:** a toast (`sonner`) plus the updated UI state.

## Accessibility checklist

- Visible focus ring (`ring` token) on every interactive element.
- Text contrast ≥ 4.5 : 1. Use the `*-strong` tokens for coloured text on tinted surfaces.
- Status shown with text or an icon, not colour alone.
- Labels on all inputs; `aria-live` for result counts; `role="alert"` for errors.
- Motion respects `prefers-reduced-motion`.
