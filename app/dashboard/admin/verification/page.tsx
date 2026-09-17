import Link from "next/link";
import type { Metadata } from "next";
import { BadgeCheckIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { VerificationActions } from "@/components/admin/admin-actions";
import { requireRole } from "@/lib/auth/guards";
import { listVerificationQueue } from "@/lib/services/admin";
import { formatDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Verification" };

export default async function AdminVerificationPage() {
  await requireRole("ADMIN");
  const { brands, creators } = await listVerificationQueue();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verification"
        description="Verified brands and creators get a public badge. Check the website, socials and identity before verifying; owners are notified of every decision."
      />

      <Card>
        <CardHeader>
          <CardTitle>Brands</CardTitle>
          <CardDescription>{brands.length} brands, unverified first.</CardDescription>
        </CardHeader>
        <CardContent>
          {!brands.length ? (
            <EmptyState icon={BadgeCheckIcon} title="No brands yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Link href={`/brands/${b.slug}`} className="font-medium hover:underline">
                          {b.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {b.industry ?? "—"} · joined {formatDate(b.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {b.owner.name}
                        <span className="block text-muted-foreground">{b.owner.email}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {b.website ? (
                          <a href={b.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            {b.website.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.verificationStatus} />
                        {b.status !== "ACTIVE" ? <StatusBadge status={b.status} className="ml-1" /> : null}
                      </TableCell>
                      <TableCell>
                        <VerificationActions target="BRAND" id={b.id} status={b.verificationStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Creators</CardTitle>
          <CardDescription>{creators.length} creator profiles, unverified first. Follower counts are self-reported until verified.</CardDescription>
        </CardHeader>
        <CardContent>
          {!creators.length ? (
            <EmptyState icon={BadgeCheckIcon} title="No creator profiles yet" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Socials (self-reported)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creators.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`/creators/${c.username}`} className="font-medium hover:underline">
                          {c.displayName}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          @{c.username} · {c.category ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.user.name}
                        <span className="block text-muted-foreground">{c.user.email}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.instagramHandle ? (
                          <span className="block">
                            IG @{c.instagramHandle} · {c.instagramFollowers ?? "?"} followers
                          </span>
                        ) : null}
                        {c.youtubeChannel ? (
                          <span className="block">
                            YT {c.youtubeChannel} · {c.youtubeSubscribers ?? "?"} subs
                          </span>
                        ) : null}
                        {!c.instagramHandle && !c.youtubeChannel ? "—" : null}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.verificationStatus} />
                      </TableCell>
                      <TableCell>
                        <VerificationActions target="CREATOR" id={c.id} status={c.verificationStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
