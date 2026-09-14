"use server";

import { revalidatePath } from "next/cache";
import { assertBrandOwner } from "@/lib/auth/guards";
import { archiveProduct, createProduct, ProductError, updateProduct } from "@/lib/services/products";
import { productSchema } from "@/lib/validation/product";
import { fail, firstError, formValues, ok, safeErrorMessage, zodFieldErrors, type ActionResult } from "@/lib/utils/action-result";

function revalidate() {
  revalidatePath("/dashboard/brand", "layout");
  revalidatePath("/products");
  revalidatePath("/campaigns");
}

export async function saveProductAction(
  productId: string | null,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }

  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return fail(firstError(fieldErrors), fieldErrors, formValues(formData));
  }

  try {
    const product = productId
      ? await updateProduct(ctx.brand.id, ctx.brand.name, ctx.user.id, productId, parsed.data)
      : await createProduct(ctx.brand.id, ctx.brand.name, ctx.user.id, parsed.data);
    revalidate();
    return ok({ id: product.id });
  } catch (err) {
    if (err instanceof ProductError) return fail(err.message, undefined, formValues(formData));
    console.error("[saveProduct] failed", err instanceof Error ? err.message : err);
    return fail("Could not save the product. Please try again.");
  }
}

export async function archiveProductAction(productId: string): Promise<ActionResult> {
  let ctx;
  try {
    ctx = await assertBrandOwner();
  } catch (err) {
    return fail(safeErrorMessage(err));
  }
  if (typeof productId !== "string" || !productId) return fail("Invalid request.");
  try {
    await archiveProduct(ctx.brand.id, ctx.user.id, productId);
    revalidate();
    return ok(undefined);
  } catch (err) {
    if (err instanceof ProductError) return fail(err.message);
    console.error("[archiveProduct] failed", err instanceof Error ? err.message : err);
    return fail("Could not archive the product.");
  }
}
