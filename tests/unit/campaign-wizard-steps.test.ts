import { describe, expect, it } from "vitest";
import { WIZARD_STEPS, schemaFields, wizardStepForField } from "@/lib/campaigns/wizard-steps";
import { campaignBasicsSchema, campaignDurationSchema, campaignProductSchema, campaignRewardsSchema, campaignRulesSchema } from "@/lib/validation/campaign";

/** The 4-step wizard must validate exactly the fields the server schema accepts — no field lost or added. */
describe("campaign wizard steps", () => {
  const serverFields = [campaignProductSchema, campaignBasicsSchema, campaignRewardsSchema, campaignRulesSchema, campaignDurationSchema].flatMap(schemaFields);

  it("has four steps, the last one for review", () => {
    expect(WIZARD_STEPS.map((s) => s.key)).toEqual(["basics", "rewards", "rules", "review"]);
    expect(WIZARD_STEPS[3].schemas).toHaveLength(0);
  });

  it("validates every server field, each shown in one step", () => {
    const wizardFields = WIZARD_STEPS.flatMap((s) => s.schemas.flatMap(schemaFields));
    expect(serverFields.length).toBeGreaterThan(15);
    expect([...wizardFields].sort()).toEqual([...serverFields].sort());
    // campaignType is chosen on step 1; the rewards schema re-reads it only for its cross-field checks.
    const shared = wizardFields.filter((f, i) => wizardFields.indexOf(f) !== i);
    expect(shared).toEqual(["campaignType"]);
    expect(wizardStepForField("campaignType")).toBe(0);
  });

  it("sends an error back to the step that shows the field", () => {
    expect(wizardStepForField("productId")).toBe(0);
    expect(wizardStepForField("couponCode")).toBe(0);
    expect(wizardStepForField("creatorCommissionValue")).toBe(1);
    expect(wizardStepForField("holdDays")).toBe(2);
    expect(wizardStepForField("endDate")).toBe(2);
    expect(wizardStepForField("nope")).toBe(-1);
  });
});
