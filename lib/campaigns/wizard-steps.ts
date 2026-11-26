import { campaignBasicsSchema, campaignDurationSchema, campaignProductSchema, campaignRewardsSchema, campaignRulesSchema } from "@/lib/validation/campaign";

/**
 * The campaign wizard's four steps over the same fields and schemas as the
 * server (`campaignFormSchema`): each step validates the schemas it shows, and
 * the last step reviews everything before launch.
 */
export const WIZARD_STEPS = [
  { key: "basics", title: "Product & basics", schemas: [campaignProductSchema, campaignBasicsSchema] },
  { key: "rewards", title: "Commission & reward", schemas: [campaignRewardsSchema] },
  { key: "rules", title: "Rules, budget & duration", schemas: [campaignRulesSchema, campaignDurationSchema] },
  { key: "review", title: "Review & launch", schemas: [] },
] as const;

export const WIZARD_STEP = { basics: 0, rewards: 1, rules: 2, review: 3 } as const;

/** Field names a schema validates (empty for schemas without an object shape). */
export function schemaFields(schema: unknown): string[] {
  return Object.keys((schema as { shape?: object }).shape ?? {});
}

/** The step that shows `field`, or -1 when no step validates it. */
export function wizardStepForField(field: string): number {
  return WIZARD_STEPS.findIndex((s) => s.schemas.some((schema) => schemaFields(schema).includes(field)));
}
