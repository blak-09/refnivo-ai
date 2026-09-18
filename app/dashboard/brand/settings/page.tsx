import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsPage } from "@/components/account/settings-page";
import { requireBrand } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Settings" };

export default async function BrandSettingsPage() {
  const { user, brand } = await requireBrand();
  return (
    <SettingsPage
      user={user}
      extra={
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Brand-level settings.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <dl className="grid gap-2 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Brand</dt>
                <dd className="font-medium">{brand.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">{formatDateTime(brand.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Store integration</dt>
                <dd className="font-medium">Manual order recording (referral code)</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Automatic order import from Shopify / WooCommerce, team members and billing are on the roadmap and not available yet.
            </p>
          </CardContent>
        </Card>
      }
    />
  );
}
