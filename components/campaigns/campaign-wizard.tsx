"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, Loader2Icon, PackageIcon, RocketIcon, SaveIcon } from "lucide-react";
import type { Campaign } from "@prisma/client";
import { campaignStatusAction, saveCampaignAction } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FormError } from "@/components/forms/field";
import { CampaignRulesGrid } from "@/components/campaigns/campaign-summary";
import { ProductThumb } from "@/components/products/product-thumb";
import { basisPointsToPercent, formatMoney, paiseToRupees } from "@/lib/money";
import { estimateCampaignCost } from "@/lib/domain/rewards";
import { publishProblems } from "@/lib/domain/campaign-rules";
import {
  campaignBasicsSchema,
  campaignDurationSchema,
  campaignFormSchema,
  campaignProductSchema,
  campaignRewardsSchema,
  campaignRulesSchema,
  toCampaignData,
  type CampaignFormInput,
} from "@/lib/validation/campaign";
import { zodFieldErrors, type FieldErrors } from "@/lib/utils/action-result";
import { toDateInputValue } from "@/lib/utils/dates";
import { CAMPAIGN_TYPE_LABEL, COMMISSION_TYPE_LABEL, REWARD_TYPE_LABEL } from "@/lib/utils/labels";
import { cn } from "@/lib/utils";

export type WizardProduct = { id: string; name: string; imageUrl: string | null; price: number; currency: string; category: string | null; status: string };

// ---------------------------------------------------------------------------
// Form state (form units: rupees / percent / yyyy-mm-dd strings)
// ---------------------------------------------------------------------------

type FormState = {
  productId: string;
  name: string;
  description: string;
  offerTitle: string;
  offerDescription: string;
  campaignType: "CREATOR_AFFILIATE" | "CUSTOMER_REFERRAL" | "HYBRID";
  rewardType: "FIXED_AMOUNT" | "PERCENTAGE" | "VOUCHER" | "DISCOUNT";
  customerRewardValue: string;
  creatorCommissionType: "FIXED_AMOUNT" | "PERCENTAGE";
  creatorCommissionValue: string;
  currency: "INR";
  requiresApproval: boolean;
  newCustomerOnly: boolean;
  minimumPurchaseAmount: string;
  attributionWindowDays: string;
  maxRewardPerCustomer: string;
  budget: string;
  terms: string;
  startDate: string;
  endDate: string;
};

const DEFAULT_STATE: FormState = {
  productId: "",
  name: "",
  description: "",
  offerTitle: "",
  offerDescription: "",
  campaignType: "HYBRID",
  rewardType: "FIXED_AMOUNT",
  customerRewardValue: "100",
  creatorCommissionType: "PERCENTAGE",
  creatorCommissionValue: "10",
  currency: "INR",
  requiresApproval: true,
  newCustomerOnly: false,
  minimumPurchaseAmount: "",
  attributionWindowDays: "30",
  maxRewardPerCustomer: "",
  budget: "",
  terms: "",
  startDate: toDateInputValue(new Date()),
  endDate: "",
};

function fromCampaign(c: Campaign): FormState {
  const money = (v: number | null) => (v === null ? "" : String(paiseToRupees(v)));
  return {
    productId: c.productId,
    name: c.name,
    description: c.description ?? "",
    offerTitle: c.offerTitle ?? "",
    offerDescription: c.offerDescription ?? "",
    campaignType: c.campaignType,
    rewardType: c.rewardType,
    customerRewardValue: c.rewardType === "PERCENTAGE" ? String(basisPointsToPercent(c.customerRewardValue)) : money(c.customerRewardValue),
    creatorCommissionType: c.creatorCommissionType,
    creatorCommissionValue:
      c.creatorCommissionType === "PERCENTAGE" ? String(basisPointsToPercent(c.creatorCommissionValue)) : money(c.creatorCommissionValue),
    currency: "INR",
    requiresApproval: c.requiresApproval,
    newCustomerOnly: c.newCustomerOnly,
    minimumPurchaseAmount: money(c.minimumPurchaseAmount),
    attributionWindowDays: String(c.attributionWindowDays),
    maxRewardPerCustomer: money(c.maxRewardPerCustomer),
    budget: money(c.budget),
    terms: c.terms ?? "",
    startDate: toDateInputValue(c.startDate),
    endDate: toDateInputValue(c.endDate),
  };
}

/** Form state → payload sent to the server action (which re-validates). */
function toPayload(s: FormState): CampaignFormInput {
  return {
    productId: s.productId,
    name: s.name,
    description: s.description,
    offerTitle: s.offerTitle,
    offerDescription: s.offerDescription,
    campaignType: s.campaignType,
    rewardType: s.rewardType,
    customerRewardValue: (s.campaignType === "CREATOR_AFFILIATE" ? "0" : s.customerRewardValue) as unknown as number,
    creatorCommissionType: s.creatorCommissionType,
    creatorCommissionValue: (s.campaignType === "CUSTOMER_REFERRAL" ? "0" : s.creatorCommissionValue) as unknown as number,
    currency: "INR",
    requiresApproval: s.requiresApproval,
    newCustomerOnly: s.newCustomerOnly,
    minimumPurchaseAmount: s.minimumPurchaseAmount as unknown as number,
    attributionWindowDays: s.attributionWindowDays as unknown as number,
    maxRewardPerCustomer: s.maxRewardPerCustomer as unknown as number,
    budget: s.budget as unknown as number,
    terms: s.terms,
    startDate: s.startDate as unknown as Date,
    endDate: s.endDate as unknown as Date,
  };
}

const STEPS = [
  { key: "product", title: "Product", schema: campaignProductSchema },
  { key: "basics", title: "Campaign details", schema: campaignBasicsSchema },
  { key: "rewards", title: "Commission & reward", schema: campaignRewardsSchema },
  { key: "rules", title: "Rules & budget", schema: campaignRulesSchema },
  { key: "duration", title: "Duration", schema: campaignDurationSchema },
  { key: "preview", title: "Preview", schema: null },
  { key: "publish", title: "Publish", schema: null },
] as const;

type Props = ({ mode: "create" } | { mode: "edit"; campaign: Campaign }) & { products: WizardProduct[]; initialProductId?: string };

export function CampaignWizard(props: Props) {
  const router = useRouter();
  const [state, setState] = React.useState<FormState>(
    props.mode === "edit" ? fromCampaign(props.campaign) : { ...DEFAULT_STATE, productId: props.initialProductId ?? "" },
  );
  const [step, setStep] = React.useState(0);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<"draft" | "publish" | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [campaignId, setCampaignId] = React.useState<string | undefined>(props.mode === "edit" ? props.campaign.id : undefined);

  const isEditingLive = props.mode === "edit" && (props.campaign.status === "ACTIVE" || props.campaign.status === "PAUSED");
  const productLocked = props.mode === "edit" && props.campaign.status !== "DRAFT";
  const includesCreators = state.campaignType !== "CUSTOMER_REFERRAL";
  const includesCustomers = state.campaignType !== "CREATOR_AFFILIATE";
  const product = props.products.find((p) => p.id === state.productId) ?? null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
    setErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  function validateStep(index: number): boolean {
    const schema = STEPS[index].schema;
    if (!schema) return true;
    const result = schema.safeParse(toPayload(state));
    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      setFormError(null);
      return false;
    }
    setErrors({});
    return true;
  }

  const next = () => validateStep(step) && setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const goTo = (i: number) => i <= step && setStep(i);

  async function save(kind: "draft" | "publish") {
    const full = campaignFormSchema.safeParse(toPayload(state));
    if (!full.success) {
      const fe = zodFieldErrors(full.error);
      setErrors(fe);
      setFormError("Some fields need attention: " + Object.values(fe)[0]);
      const firstKey = Object.keys(fe)[0];
      const stepIndex = STEPS.findIndex((s) => s.schema && Object.keys((s.schema as { shape?: object }).shape ?? {}).includes(firstKey));
      if (stepIndex >= 0) setStep(stepIndex);
      return;
    }

    setSaving(kind);
    setFormError(null);
    try {
      const res = await saveCampaignAction(toPayload(state), campaignId);
      if (!res.ok) {
        setFormError(res.error);
        if (res.fieldErrors) setErrors(res.fieldErrors);
        return;
      }
      setCampaignId(res.data.id);
      if (kind === "publish" && res.data.status !== "ACTIVE") {
        const pub = await campaignStatusAction({ campaignId: res.data.id, action: "PUBLISH", confirmed: true });
        if (!pub.ok) {
          setFormError(pub.error);
          return;
        }
        toast.success("Campaign published. It is now live in Discover Campaigns.");
      } else {
        toast.success(kind === "publish" ? "Campaign saved." : "Draft saved.");
      }
      router.push(`/dashboard/brand/campaigns/${res.data.id}`);
      router.refresh();
    } catch {
      setFormError("Could not reach the server. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  const previewParsed = campaignFormSchema.safeParse(toPayload(state));
  const previewData = previewParsed.success ? toCampaignData(previewParsed.data) : null;
  const previewRules = previewData ? { ...previewData, status: "DRAFT" as const } : null;
  const problems = previewRules ? publishProblems(previewRules) : [];
  const estimate =
    previewData && product
      ? estimateCampaignCost(previewData, {
          referrals: 100,
          averageBillMinor: product.price,
          creatorShare: state.campaignType === "CREATOR_AFFILIATE" ? 1 : state.campaignType === "CUSTOMER_REFERRAL" ? 0 : 0.7,
        })
      : null;
  const canPublishNow = props.mode === "create" || props.campaign.status === "DRAFT" || props.campaign.status === "PENDING_REVIEW";
  const activeProducts = props.products.filter((p) => p.status === "ACTIVE" || p.id === state.productId);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1" aria-label="Wizard steps">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => goTo(i)}
                disabled={i > step}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm whitespace-nowrap transition-colors disabled:cursor-not-allowed",
                  active ? "bg-accent font-medium text-accent-foreground" : done ? "text-foreground hover:bg-muted" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    done ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary text-primary" : "border-border",
                  )}
                >
                  {done ? <CheckIcon className="size-3" /> : i + 1}
                </span>
                {s.title}
              </button>
            </li>
          );
        })}
      </ol>

      <Card>
        <CardContent className="space-y-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="text-lg font-semibold">{STEPS[step].title}</h2>
          </div>

          <FormError message={formError} />

          {/* ---------------- Step 1: Product ---------------- */}
          {step === 0 ? (
            <div className="space-y-4">
              {!activeProducts.length ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <PackageIcon className="mx-auto size-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">Add a product first</p>
                  <p className="text-sm text-muted-foreground">Every campaign promotes exactly one product.</p>
                  <Button className="mt-3" size="sm" nativeButton={false} render={<Link href="/dashboard/brand/products/new" />}>
                    Add product
                  </Button>
                </div>
              ) : (
                <>
                  {productLocked ? (
                    <p className="text-sm text-muted-foreground">The product cannot be changed after a campaign is published.</p>
                  ) : null}
                  {errors.productId ? <p className="text-xs text-destructive">{errors.productId}</p> : null}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activeProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={productLocked && p.id !== state.productId}
                        onClick={() => set("productId", p.id)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted disabled:opacity-50",
                          state.productId === p.id && "border-primary bg-primary/5",
                        )}
                      >
                        <ProductThumb src={p.imageUrl} name={p.name} className="size-12" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatMoney(p.price, p.currency)}
                            {p.category ? ` · ${p.category}` : ""}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {/* ---------------- Step 2: Basics ---------------- */}
          {step === 1 ? (
            <div className="grid gap-4">
              <Field label="Campaign name" htmlFor="name" error={errors.name} required>
                <Input id="name" value={state.name} onChange={(e) => set("name", e.target.value)} placeholder={product ? `${product.name} launch` : "Rockerz 450 launch"} aria-invalid={!!errors.name} />
              </Field>
              <Field label="Campaign description" htmlFor="description" error={errors.description} hint="What the campaign is about and who it is for. Shown to creators on the marketplace.">
                <Textarea id="description" rows={3} value={state.description} onChange={(e) => set("description", e.target.value)} placeholder="Drive online sales of the Rockerz 450 through tech and lifestyle creators before the festive season." />
              </Field>
              <Field label="Who can promote" htmlFor="campaignType" error={errors.campaignType} required>
                <NativeSelect id="campaignType" value={state.campaignType} onChange={(e) => set("campaignType", e.target.value as FormState["campaignType"])}>
                  {Object.entries(CAMPAIGN_TYPE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Customer offer headline (optional)" htmlFor="offerTitle" error={errors.offerTitle} hint="Shown on the referral landing page, e.g. a coupon shoppers get through the link.">
                <Input id="offerTitle" value={state.offerTitle} onChange={(e) => set("offerTitle", e.target.value)} placeholder="Get 10% off with a creator link" aria-invalid={!!errors.offerTitle} />
              </Field>
              <Field label="Offer details (optional)" htmlFor="offerDescription" error={errors.offerDescription}>
                <Textarea id="offerDescription" rows={2} value={state.offerDescription} onChange={(e) => set("offerDescription", e.target.value)} placeholder="Discount applied automatically at checkout on the brand store." />
              </Field>
            </div>
          ) : null}

          {/* ---------------- Step 3: Commission & reward ---------------- */}
          {step === 2 ? (
            <div className="grid gap-6">
              {isEditingLive ? (
                <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                  This campaign is live. Changes apply to orders recorded after you save — existing ledger entries are never changed.
                </p>
              ) : null}
              <fieldset className={cn("grid gap-4 sm:grid-cols-2", !includesCreators && "opacity-60")}>
                <legend className="mb-2 text-sm font-semibold">Creator commission</legend>
                {!includesCreators ? (
                  <p className="text-sm text-muted-foreground sm:col-span-2">Not used — this is a customer-only campaign.</p>
                ) : (
                  <>
                    <Field label="Commission type" htmlFor="creatorCommissionType" error={errors.creatorCommissionType} required>
                      <NativeSelect id="creatorCommissionType" value={state.creatorCommissionType} onChange={(e) => set("creatorCommissionType", e.target.value as FormState["creatorCommissionType"])}>
                        {Object.entries(COMMISSION_TYPE_LABEL).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field
                      label={state.creatorCommissionType === "PERCENTAGE" ? "Commission (% of order)" : "Commission (₹ per order)"}
                      htmlFor="creatorCommissionValue"
                      error={errors.creatorCommissionValue}
                      required
                      hint={
                        state.creatorCommissionType === "PERCENTAGE" && product
                          ? `≈ ${formatMoney(Math.round((product.price * Number(state.creatorCommissionValue || 0)) / 100))} on a ${formatMoney(product.price)} order`
                          : "Paid per verified order."
                      }
                    >
                      <Input id="creatorCommissionValue" type="number" inputMode="decimal" min={0} step="0.5" value={state.creatorCommissionValue} onChange={(e) => set("creatorCommissionValue", e.target.value)} aria-invalid={!!errors.creatorCommissionValue} />
                    </Field>
                  </>
                )}
              </fieldset>

              <fieldset className={cn("grid gap-4 sm:grid-cols-2", !includesCustomers && "opacity-60")}>
                <legend className="mb-2 text-sm font-semibold">Customer referral reward</legend>
                {!includesCustomers ? (
                  <p className="text-sm text-muted-foreground sm:col-span-2">Not used — this is a creator-only campaign.</p>
                ) : (
                  <>
                    <Field label="Reward type" htmlFor="rewardType" error={errors.rewardType} required>
                      <NativeSelect id="rewardType" value={state.rewardType} onChange={(e) => set("rewardType", e.target.value as FormState["rewardType"])}>
                        {Object.entries(REWARD_TYPE_LABEL).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field
                      label={state.rewardType === "PERCENTAGE" ? "Reward (% of order)" : "Reward value (₹)"}
                      htmlFor="customerRewardValue"
                      error={errors.customerRewardValue}
                      required
                      hint="What the referring customer earns when a friend's order is verified."
                    >
                      <Input id="customerRewardValue" type="number" inputMode="decimal" min={0} step="1" value={state.customerRewardValue} onChange={(e) => set("customerRewardValue", e.target.value)} aria-invalid={!!errors.customerRewardValue} />
                    </Field>
                  </>
                )}
              </fieldset>

              <Field label="Currency" htmlFor="currency" hint="INR only in this version.">
                <Input id="currency" value="INR" readOnly />
              </Field>
            </div>
          ) : null}

          {/* ---------------- Step 4: Rules & budget ---------------- */}
          {step === 3 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border p-3 sm:col-span-2">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={state.requiresApproval} onChange={(e) => set("requiresApproval", e.target.checked)} />
                <span>
                  <span className="block text-sm font-medium">Creators need approval</span>
                  <span className="block text-xs text-muted-foreground">Review each creator&apos;s profile before they get a referral link. Customers always join instantly.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border p-3 sm:col-span-2">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={state.newCustomerOnly} onChange={(e) => set("newCustomerOnly", e.target.checked)} />
                <span>
                  <span className="block text-sm font-medium">First-time customers only</span>
                  <span className="block text-xs text-muted-foreground">Only a customer&apos;s first order on this campaign is eligible.</span>
                </span>
              </label>
              <Field label="Minimum order value (₹)" htmlFor="minimumPurchaseAmount" error={errors.minimumPurchaseAmount} hint="Leave empty for no minimum.">
                <Input id="minimumPurchaseAmount" type="number" inputMode="decimal" min={0} value={state.minimumPurchaseAmount} onChange={(e) => set("minimumPurchaseAmount", e.target.value)} placeholder="999" aria-invalid={!!errors.minimumPurchaseAmount} />
              </Field>
              <Field label="Attribution window (days)" htmlFor="attributionWindowDays" error={errors.attributionWindowDays} required hint="How long after a link click an order still counts. Default 30.">
                <Input id="attributionWindowDays" type="number" inputMode="numeric" min={1} max={90} value={state.attributionWindowDays} onChange={(e) => set("attributionWindowDays", e.target.value)} aria-invalid={!!errors.attributionWindowDays} />
              </Field>
              <Field label="Maximum reward per customer (₹)" htmlFor="maxRewardPerCustomer" error={errors.maxRewardPerCustomer} hint="Caps percentage rewards. Leave empty for no cap.">
                <Input id="maxRewardPerCustomer" type="number" inputMode="decimal" min={0} value={state.maxRewardPerCustomer} onChange={(e) => set("maxRewardPerCustomer", e.target.value)} placeholder="500" aria-invalid={!!errors.maxRewardPerCustomer} />
              </Field>
              <Field label="Campaign budget (₹)" htmlFor="budget" error={errors.budget} hint="Total commissions + rewards you will pay. Verification stops when it is reached.">
                <Input id="budget" type="number" inputMode="decimal" min={0} value={state.budget} onChange={(e) => set("budget", e.target.value)} placeholder="50000" aria-invalid={!!errors.budget} />
              </Field>
              <Field label="Campaign rules & terms" htmlFor="terms" error={errors.terms} className="sm:col-span-2" hint="Shown to creators before they apply and on the referral landing page.">
                <Textarea id="terms" rows={4} value={state.terms} onChange={(e) => set("terms", e.target.value)} placeholder={"Commission is paid on delivered, non-returned orders.\nNo paid ads on brand keywords.\nDisclose the partnership (#ad)."} />
              </Field>
            </div>
          ) : null}

          {/* ---------------- Step 5: Duration ---------------- */}
          {step === 4 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date" htmlFor="startDate" error={errors.startDate} required>
                <Input id="startDate" type="date" value={state.startDate} onChange={(e) => set("startDate", e.target.value)} aria-invalid={!!errors.startDate} />
              </Field>
              <Field label="End date" htmlFor="endDate" error={errors.endDate} hint="Leave empty to run until you end it manually.">
                <Input id="endDate" type="date" value={state.endDate} min={state.startDate} onChange={(e) => set("endDate", e.target.value)} aria-invalid={!!errors.endDate} />
              </Field>
            </div>
          ) : null}

          {/* ---------------- Step 6: Preview ---------------- */}
          {step === 5 ? (
            <div className="space-y-6">
              {!previewRules || !product ? (
                <FormError message="Some earlier steps have invalid values. Go back and fix them to see the preview." />
              ) : (
                <>
                  <div className="flex gap-4 rounded-xl border bg-gradient-to-br from-accent/60 to-background p-5">
                    <ProductThumb src={product.imageUrl} name={product.name} className="size-20" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Campaign card preview</p>
                      <h3 className="mt-1 text-lg font-semibold">{state.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {product.name} · {formatMoney(product.price, product.currency)}
                      </p>
                      {state.offerTitle ? <p className="mt-1 text-sm font-medium text-primary">{state.offerTitle}</p> : null}
                    </div>
                  </div>
                  <CampaignRulesGrid campaign={previewRules} />
                  {state.terms ? (
                    <div>
                      <p className="text-sm font-medium">Campaign rules</p>
                      <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{state.terms}</p>
                    </div>
                  ) : null}
                  {estimate ? (
                    <div className="rounded-lg border p-4">
                      <p className="text-sm font-medium">Estimated partner cost</p>
                      <p className="text-xs text-muted-foreground">
                        Illustration only — assumes 100 verified orders at the product price of {formatMoney(product.price)}. Real costs come from verified orders.
                      </p>
                      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-muted-foreground">Creator commissions</dt>
                          <dd className="font-medium tabular-nums">{formatMoney(estimate.commissionCost)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Customer rewards</dt>
                          <dd className="font-medium tabular-nums">{formatMoney(estimate.rewardCost)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Total cost</dt>
                          <dd className="font-medium tabular-nums">{formatMoney(estimate.totalCost)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Attributed sales</dt>
                          <dd className="font-medium tabular-nums">{formatMoney(estimate.revenue)}</dd>
                        </div>
                      </dl>
                      {previewData?.budget && estimate.totalCost > previewData.budget ? (
                        <p className="mt-2 text-xs text-destructive">This illustration exceeds your budget of {formatMoney(previewData.budget)}.</p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {/* ---------------- Step 7: Publish ---------------- */}
          {step === 6 ? (
            <div className="space-y-5">
              {problems.length ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                  <p className="font-medium text-destructive">Fix these before publishing:</p>
                  <ul className="mt-1 list-disc pl-5 text-destructive">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {[
                    product ? `Promotes ${product.name}` : "",
                    "All values validated",
                    previewRules ? `Runs ${previewRules.endDate ? "from " + state.startDate + " to " + state.endDate : "from " + state.startDate + " with no end date"}` : "",
                    previewData?.budget ? `Budget ${formatMoney(previewData.budget)}` : "No budget cap",
                    state.requiresApproval ? "Creators will need your approval" : "Creators join instantly",
                  ]
                    .filter(Boolean)
                    .map((t) => (
                      <li key={t} className="flex items-center gap-2">
                        <CheckIcon className="size-4 text-primary" /> {t}
                      </li>
                    ))}
                </ul>
              )}
              {canPublishNow ? (
                <label className="flex items-start gap-3 rounded-lg border p-3">
                  <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                  <span className="text-sm">
                    I confirm the commission, reward and campaign rules above. My brand owes these amounts for every order I verify.
                  </span>
                </label>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This campaign is already {props.mode === "edit" ? props.campaign.status.toLowerCase() : ""}. Saving keeps its current status.
                </p>
              )}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {step > 0 ? (
                <Button type="button" variant="ghost" onClick={back} disabled={!!saving}>
                  <ChevronLeftIcon /> Back
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {step >= 1 && step < 6 ? (
                <Button type="button" variant="outline" onClick={() => save("draft")} disabled={!!saving}>
                  {saving === "draft" ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save {props.mode === "edit" && props.campaign.status !== "DRAFT" ? "changes" : "as draft"}
                </Button>
              ) : null}
              {step < 6 ? (
                <Button type="button" onClick={next} disabled={!!saving || (step === 0 && !activeProducts.length)}>
                  Continue <ChevronRightIcon />
                </Button>
              ) : canPublishNow ? (
                <Button type="button" onClick={() => save("publish")} disabled={!!saving || !confirmed || problems.length > 0}>
                  {saving === "publish" ? <Loader2Icon className="animate-spin" /> : <RocketIcon />} Publish campaign
                </Button>
              ) : (
                <Button type="button" onClick={() => save("draft")} disabled={!!saving || problems.length > 0}>
                  {saving ? <Loader2Icon className="animate-spin" /> : <SaveIcon />} Save changes
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
