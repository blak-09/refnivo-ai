import type { Metadata } from "next";
import { PiggyBankIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, KpiCard, PageHeader } from "@/components/dashboard/primitives";
import { WalletAdjustForm } from "@/components/admin/wallet-adjust";
import { requireRole } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listWallets, walletEnabled, walletTopupAvailable } from "@/lib/services/wallet";
import { formatDateTime } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Brand wallets" };

export default async function AdminWalletsPage() {
  await requireRole("ADMIN");
  if (!walletEnabled()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Brand wallets" description="Pre-paid brand balances that fund commissions." />
        <EmptyState icon={PiggyBankIcon} title="The wallet is switched off" description="Set BRAND_WALLET_ENABLED=true to turn it on. While it is on, an order can only be verified if the brand's wallet covers its commission and reward." />
      </div>
    );
  }
  const wallets = await listWallets();
  const total = wallets.reduce((s, w) => s + Math.max(0, w.balance), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brand wallets"
        description={`Balances held for brands. Verified orders debit them automatically; refunds credit them back. ${walletTopupAvailable() ? "Brands top up online via Razorpay." : "Online top-ups are off — credit a wallet here when a bank transfer arrives."} Every adjustment needs a reason and is audited.`}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <KpiCard label="Total held" value={formatMoney(total)} icon={PiggyBankIcon} />
        <KpiCard label="Brands with a balance" value={wallets.filter((w) => w.balance > 0).length} icon={PiggyBankIcon} />
      </div>
      {!wallets.length ? (
        <EmptyState icon={PiggyBankIcon} title="No brands yet" description="Brands appear here once they sign up." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Last change</TableHead>
                <TableHead>Adjust</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallets.map((w) => (
                <TableRow key={w.brandId}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell className={`text-right tabular-nums ${w.balance < 0 ? "text-destructive" : ""}`}>{formatMoney(w.balance, w.currency)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{w.updatedAt ? formatDateTime(w.updatedAt) : "—"}</TableCell>
                  <TableCell>
                    <WalletAdjustForm brandId={w.brandId} brandName={w.name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
