import { z } from "zod";
import { rupeesToPaise } from "@/lib/money";

/**
 * A product image is either an uploaded path (`/uploads/...`, from the local
 * storage driver) or a full external URL (legacy records / cloud storage).
 */
const imageRef = z
  .string()
  .trim()
  .max(500)
  .refine((val) => val === "" || val.startsWith("/uploads/") || val.startsWith("http://") || val.startsWith("https://"), "Enter a valid image")
  .optional()
  .or(z.literal(""));

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export const productSchema = z.object({
  name: z.string().trim().min(2, "Product name is required").max(120),
  description: z.string().trim().max(3000).optional().or(z.literal("")),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  imageUrl: imageRef,
  /** Rupees in the form; converted to paise on save. */
  price: z.coerce
    .number({ message: "Price must be a number" })
    .min(1, "Price must be at least ₹1")
    .max(10_000_000, "Price is too large"),
  purchaseUrl: z.string().trim().url("Enter the product's purchase URL (include https://)").max(500),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  status: z.enum(PRODUCT_STATUSES).default("ACTIVE"),
});

export type ProductInput = z.input<typeof productSchema>;
export type ProductValues = z.output<typeof productSchema>;

export function toProductData(v: ProductValues) {
  return {
    name: v.name,
    description: v.description || null,
    category: v.category || null,
    imageUrl: v.imageUrl || null,
    price: rupeesToPaise(v.price),
    purchaseUrl: v.purchaseUrl,
    sku: v.sku || null,
    status: v.status,
  };
}
