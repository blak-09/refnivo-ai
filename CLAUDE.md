# LocalGrowth AI — working notes

- Spec: `LocalGrowth_AI_MVP_Development_Spec.md`. Progress checklist: `docs/PROGRESS.md`. Architecture: `docs/ARCHITECTURE.md`.
- Money is integer paise; percentages are basis points. Never use floats for ledgers (`lib/money`).
- Product is the unit: every campaign has a `productId`; every brand query is scoped by `brandId`. Use `lib/auth/guards.ts` (`require*` in pages, `assert*` in actions).
- Clicks are never sales: `/r/[code]` only records clicks/attribution; ledger entries come from `lib/services/conversions.ts` (record → verify).
- Creator social numbers are self-reported — label them; never show them to customers.
- Write audit logs inside the same transaction as the mutation (`lib/services/audit.ts`).
- Local DB without Postgres installed: `npm run db:local` (embedded Postgres on :5433). Tests use `localgrowth_test`.
- Next.js 16: `proxy.ts` replaces middleware; `params`/`searchParams` are Promises; Button-as-Link needs `nativeButton={false}`; icon components cannot be passed from Server to Client Components (see `components/dashboard/nav.ts`).
- Checks before finishing a phase: `npm run typecheck && npm run lint && npm test && npm run build`.

@AGENTS.md
