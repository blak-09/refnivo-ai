"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Product } from "@prisma/client";
import { saveProductAction } from "@/app/actions/products";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAttempt } from "@/components/forms/use-form-attempt";
import { ImageUpload } from "@/components/uploads/image-upload";
import { paiseToRupees } from "@/lib/money";
import { PRODUCT_CATEGORIES, PRODUCT_STATUS_LABEL } from "@/lib/utils/labels";

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const bound = saveProductAction.bind(null, product?.id ?? null);
  const [state, formAction] = useActionState(bound, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const values = state && !state.ok ? state.values ?? {} : {};
  const attempt = useFormAttempt(state);
  const dv = (key: string, fallback: string | number | null | undefined) => values[key] ?? (fallback ?? "");

  React.useEffect(() => {
    if (state?.ok) {
      toast.success(product ? "Product saved." : "Product added.");
      router.push(`/dashboard/brand/products/${state.data.id}`);
      router.refresh();
    }
  }, [state, product, router]);

  return (
    <form key={attempt} action={formAction} className="space-y-6" noValidate>
      <FormError message={state && !state.ok ? state.error : null} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Product name" htmlFor="name" error={errors.name} required className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={dv("name", product?.name)} placeholder="boAt Rockerz 450 Bluetooth Headphones" required aria-invalid={!!errors.name} />
        </Field>
        <Field label="Category" htmlFor="category" error={errors.category}>
          <NativeSelect id="category" name="category" defaultValue={dv("category", product?.category)}>
            <option value="">Select category</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Price (₹)" htmlFor="price" error={errors.price} required hint="Listed price used to estimate percentage commissions.">
          <Input id="price" name="price" type="number" inputMode="decimal" min={1} step="1" defaultValue={dv("price", product ? paiseToRupees(product.price) : "")} placeholder="1499" required aria-invalid={!!errors.price} />
        </Field>
        <Field label="Purchase URL" htmlFor="purchaseUrl" error={errors.purchaseUrl} required className="sm:col-span-2" hint="Where referred customers buy. Referral codes are appended as ?ref=CODE so your store can capture them.">
          <Input id="purchaseUrl" name="purchaseUrl" type="url" defaultValue={dv("purchaseUrl", product?.purchaseUrl)} placeholder="https://www.boat-lifestyle.com/products/rockerz-450" required aria-invalid={!!errors.purchaseUrl} />
        </Field>
        <Field label="Upload product image" htmlFor="imageUrl" error={errors.imageUrl} className="sm:col-span-2" hint="Shown on product cards, the marketplace and referral pages.">
          <ImageUpload name="imageUrl" initialUrl={product?.imageUrl ?? undefined} label="Upload product image" />
        </Field>
        <Field label="Description" htmlFor="description" error={errors.description} className="sm:col-span-2">
          <Textarea id="description" name="description" rows={4} defaultValue={dv("description", product?.description)} placeholder="15-hour playback, 40mm drivers, soft padded ear cushions…" />
        </Field>
        <Field label="SKU / external product ID" htmlFor="sku" error={errors.sku} hint="Optional. Must be unique within your brand.">
          <Input id="sku" name="sku" defaultValue={dv("sku", product?.sku)} placeholder="ROCKERZ-450-BLK" aria-invalid={!!errors.sku} />
        </Field>
        <Field label="Status" htmlFor="status" error={errors.status}>
          <NativeSelect id="status" name="status" defaultValue={dv("status", product?.status ?? "ACTIVE")}>
            {(["ACTIVE", "DRAFT", "INACTIVE"] as const).map((s) => (
              <option key={s} value={s}>
                {PRODUCT_STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton>{product ? "Save changes" : "Add product"}</SubmitButton>
      </div>
    </form>
  );
}
