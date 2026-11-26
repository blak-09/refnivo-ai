"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { APPROVAL_OPTIONS, COMMISSION_OPTIONS, TYPE_OPTIONS, activeFilterCount, campaignSearchHref, type CampaignFilterValues } from "@/lib/campaigns/filters";
import { cn } from "@/lib/utils";

/**
 * One filter bar for campaign discovery (public marketplace and creator
 * Discover). A plain GET form, so it works without JavaScript and every view
 * is a shareable URL. On phones the filters sit in a bottom sheet behind a
 * "Filters" button so campaigns start on the first screen; the sheet is part
 * of the form (not a portal), so its fields are always submitted.
 */
export function CampaignFilterBar({
  basePath,
  values,
  categories,
  industries,
}: {
  basePath: string;
  values: CampaignFilterValues;
  categories: readonly string[];
  industries: readonly string[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const count = activeFilterCount(values);
  const panelId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("select, input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // With JavaScript: drop empty fields so the URL stays short and readable.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget)) if (typeof v === "string" && v.trim()) params.set(k, v.trim());
    setOpen(false);
    router.push(params.size ? `${basePath}?${params}` : basePath);
  }

  // Remount on navigation so fields always show the URL's values.
  const formKey = campaignSearchHref(basePath, values);

  return (
    <form key={formKey} action={basePath} method="get" onSubmit={onSubmit} role="search" aria-label="Search and filter campaigns" className="rounded-2xl border bg-card p-3 sm:p-4">
      {values.sort !== "newest" ? <input type="hidden" name="sort" value={values.sort} /> : null}

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={values.q ?? ""} placeholder="Search products, brands or campaigns" aria-label="Search campaigns" className="h-10 pl-9" />
        </div>
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          className="h-10 sm:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontalIcon aria-hidden /> Filters
          {count ? <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">{count}</span> : null}
        </Button>
        <Button type="submit" className="hidden h-10 sm:inline-flex">
          Search
        </Button>
      </div>

      {open ? <button type="button" aria-label="Close filters" className="fixed inset-0 z-40 bg-black/30 sm:hidden" onClick={() => setOpen(false)} /> : null}

      <div
        id={panelId}
        ref={panelRef}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Filters" : undefined}
        className={cn(
          "sm:static sm:mt-3 sm:block sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none",
          open
            ? "fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t bg-popover p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
            : "hidden",
        )}
      >
        <div className="mb-4 flex items-center justify-between sm:hidden">
          <p className="text-base font-semibold">Filters</p>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Close filters" onClick={() => setOpen(false)}>
            <XIcon aria-hidden />
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <FilterSelect label="Product type" name="category" value={values.category} placeholder="All types" options={categories.map((c) => ({ value: c, label: c }))} />
          <FilterSelect label="Brand category" name="industry" value={values.industry} placeholder="All categories" options={industries.map((c) => ({ value: c, label: c }))} />
          <FilterSelect label="Who can join" name="type" value={values.type} placeholder="Anyone" options={TYPE_OPTIONS} />
          <FilterSelect label="Getting a link" name="approval" value={values.approval} placeholder="Either" options={APPROVAL_OPTIONS} />
          <FilterSelect label="Creator commission" name="commission" value={values.commission} placeholder="Any" options={COMMISSION_OPTIONS} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="offer" value="1" defaultChecked={!!values.offer} className="size-4 accent-primary" />
            Has a shopper offer (coupon)
          </label>
          <div className="ml-auto flex w-full gap-2 sm:w-auto">
            {count || values.q ? (
              <Button variant="ghost" className="h-10 flex-1 sm:flex-none" nativeButton={false} render={<Link href={values.sort === "newest" ? basePath : `${basePath}?sort=${values.sort}`} />}>
                Clear all
              </Button>
            ) : null}
            <Button type="submit" className="h-10 flex-1 sm:flex-none">
              <span className="sm:hidden">Show campaigns</span>
              <span className="hidden sm:inline">Apply filters</span>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function FilterSelect({
  label,
  name,
  value,
  placeholder,
  options,
}: {
  label: string;
  name: string;
  value?: string;
  placeholder: string;
  options: readonly { value: string; label: string }[];
}) {
  const id = `filter-${name}`;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <NativeSelect id={id} name={name} defaultValue={value ?? ""} className="h-10">
        <option value="">{placeholder}</option>
        {value && !options.some((o) => o.value === value) ? <option value={value}>{value}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
