"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { INDIAN_STATES } from "@/lib/onboarding/options";
import { cn } from "@/lib/utils";

export type Values = Record<string, string | string[]>;
export type Errors = Record<string, string>;

export const str = (values: Values, key: string) => {
  const v = values[key];
  return typeof v === "string" ? v : "";
};
export const arr = (values: Values, key: string) => {
  const v = values[key];
  return Array.isArray(v) ? v : typeof v === "string" && v ? [v] : [];
};

/** A titled group of fields inside the profile form. */
export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** "(optional)" marker appended to a label. */
export const opt = (label: string) => `${label} (optional)`;

/**
 * Multi-select as a group of toggle chips backed by real checkboxes (same
 * `name`, repeated keys) — keyboard and screen-reader friendly, no JS needed
 * to submit.
 */
export function ChoiceChips({
  name,
  legend,
  options,
  defaultValue,
  error,
  hint,
}: {
  name: string;
  legend: string;
  options: readonly (string | { value: string; label: string })[];
  defaultValue: string[];
  error?: string;
  hint?: string;
}) {
  const id = React.useId();
  return (
    <fieldset className="grid gap-2" aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const value = typeof o === "string" ? o : o.value;
          const label = typeof o === "string" ? o : o.label;
          return (
            <label key={value} className="group cursor-pointer">
              <input type="checkbox" name={name} value={value} defaultChecked={defaultValue.includes(value)} className="peer sr-only" />
              <span
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm transition-colors",
                  "group-hover:border-primary/50 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-foreground",
                  "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                )}
              >
                <CheckIcon className="hidden size-3.5 text-primary group-has-checked:inline" aria-hidden />
                {label}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Country / State / City. Indian states are suggested; any text is accepted. */
export function LocationFields({ values, errors, countryRequired = false }: { values: Values; errors: Errors; countryRequired?: boolean }) {
  const listId = React.useId();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label={countryRequired ? "Country" : opt("Country")} htmlFor="country" error={errors.country} required={countryRequired}>
        <Input id="country" name="country" autoComplete="country-name" defaultValue={str(values, "country") || "India"} aria-invalid={!!errors.country} />
      </Field>
      <Field label={opt("State")} htmlFor="state" error={errors.state}>
        <Input id="state" name="state" autoComplete="address-level1" list={listId} defaultValue={str(values, "state")} aria-invalid={!!errors.state} />
        <datalist id={listId}>
          {INDIAN_STATES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
      <Field label={opt("City")} htmlFor="city" error={errors.city}>
        <Input id="city" name="city" autoComplete="address-level2" defaultValue={str(values, "city")} aria-invalid={!!errors.city} />
      </Field>
    </div>
  );
}
