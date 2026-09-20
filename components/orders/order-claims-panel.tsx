import Link from "next/link";
import { MousePointerClickIcon, KeyboardIcon, PackageCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, StatusBadge } from "@/components/dashboard/primitives";
import { OrderClaimDecision } from "@/components/orders/order-claim-decision";
import type { BrandOrderClaim } from "@/lib/services/order-claims";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = { PENDING: "Awaiting your decision", CONFIRMED: "Confirmed", REJECTED: "Rejected" };

function relative(from: Date, to: Date): string {
  const mins = Math.round((to.getTime() - from.getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

/** Brand-side list of customer order claims (order handshake). */
export function OrderClaimsPanel({ claims, showAll, pendingCount }: { claims: BrandOrderClaim[]; showAll: boolean; pendingCount: number }) {
  return (
    <Card id="claims" className="scroll-mt-24">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PackageCheckIcon className="size-5 text-primary" aria-hidden /> Customer order claims
              {pendingCount ? <Badge>{pendingCount} to confirm</Badge> : null}
            </CardTitle>
            <CardDescription className="mt-1">
              Customers who bought on your store submit their order number from the campaign page. Match it in your store, then confirm with the order value (recorded and verified in one step) or reject it. Nothing is owed until you confirm.
            </CardDescription>
          </div>
          <div className="flex gap-1.5" role="tablist" aria-label="Claims to show">
            {[
              { value: false, label: "Open", href: "/dashboard/brand/orders#claims" },
              { value: true, label: "All", href: "/dashboard/brand/orders?claims=all#claims" },
            ].map((t) => (
              <Link
                key={t.label}
                href={t.href}
                role="tab"
                aria-selected={showAll === t.value}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", showAll === t.value ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!claims.length ? (
          <EmptyState
            icon={PackageCheckIcon}
            title={showAll ? "No order claims yet" : "No claims waiting"}
            description="When a customer confirms their order number on your campaign page, it appears here for you to verify against your store."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Partner · code</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((c) => {
                  const partnerName = c.referralLink.owner.creatorProfile?.displayName ?? c.referralLink.owner.name;
                  const owedLabel = c.referralLink.partnerType === "CREATOR" ? "the commission" : "the reward";
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <span className="font-mono font-medium">{c.orderReference}</span>
                        <span className="block text-xs text-muted-foreground">
                          {c.campaign.name} · {formatDateTime(c.createdAt)}
                        </span>
                        {c.note ? <span className="block text-xs text-muted-foreground">“{c.note}”</span> : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-mono">{c.contactMasked}</span>
                        <span className="block text-muted-foreground">{c.customer ? `Signed in as ${c.customer.name}` : "Not signed in"}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {partnerName}
                        <span className="block font-mono text-muted-foreground">{c.referralLink.code}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.evidence === "LAST_CLICK" && c.clickedAt ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <MousePointerClickIcon className="size-3.5" aria-hidden /> Clicked the link {relative(c.clickedAt, c.createdAt)} before claiming
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <KeyboardIcon className="size-3.5" aria-hidden /> Code typed manually — no click from this browser
                          </span>
                        )}
                        {c.campaign.minimumPurchaseAmount ? <span className="block text-muted-foreground">Min. order ₹{Math.round(c.campaign.minimumPurchaseAmount / 100)}</span> : null}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status === "CONFIRMED" ? "VERIFIED" : c.status === "REJECTED" ? "REJECTED" : "PURCHASED"} label={STATUS_LABEL[c.status]} />
                        {c.status === "REJECTED" && c.rejectionReason ? <span className="block text-xs text-muted-foreground">{c.rejectionReason}</span> : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.status === "PENDING" ? (
                          <div className="flex justify-end">
                            <OrderClaimDecision claimId={c.id} orderReference={c.orderReference} partnerLabel={partnerName} owedLabel={owedLabel} />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{c.decidedAt ? formatDateTime(c.decidedAt) : "—"}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
