import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/dashboard/primitives";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3Icon } from "lucide-react";
import { SOURCE_LABEL, type SourcePerformance } from "@/lib/services/channel-links";
import { formatMoney } from "@/lib/money";

/**
 * Performance per channel. Only channels that actually have a tracked link
 * appear: a platform the partner never shared on is absent rather than shown
 * as a row of zeros, and nothing here is inferred from a click's referer.
 */
export function SourcePerformanceTable({ rows, title, description }: { rows: SourcePerformance[]; title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!rows.length ? (
          <EmptyState
            icon={BarChart3Icon}
            title="No channel data yet"
            description="Create a link for a platform and share it there — clicks and sales on that link are credited to that platform."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Earned</TableHead>
                  <TableHead className="text-right">Conv.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.source}>
                    <TableCell>
                      <span className="font-medium">{SOURCE_LABEL[r.source]}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.links} link{r.links === 1 ? "" : "s"}
                        {r.qrScans ? ` · ${r.qrScans} QR scans` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.clicks}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.orders}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.commission)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.conversionRate === null ? "—" : `${(r.conversionRate * 100).toFixed(1)}%`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
