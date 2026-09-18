import type { Metadata } from "next";
import { uploadsAvailable } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/primitives";
import { ProductForm } from "@/components/products/product-form";
import { requireBrand } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requireBrand();
  return (
    <div className="space-y-6">
      <PageHeader title="Add a product" description="The product creators and customers will promote. You can run several campaigns per product." />
      <Card>
        <CardContent>
          <ProductForm uploadsEnabled={uploadsAvailable()} />
        </CardContent>
      </Card>
    </div>
  );
}
