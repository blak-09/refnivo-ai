import Link from "next/link";
import type { UserRole, UserStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/primitives";
import { ROLE_LABEL } from "@/lib/auth/roles";

const STATUS_MESSAGE: Record<UserStatus, string> = {
  PENDING: "Your registration has been submitted and is waiting for our team to review it. You'll be able to sign in once it's approved.",
  APPROVED: "Your account has been approved. You can now sign in and get started.",
  REJECTED: "Your registration was not approved.",
  SUSPENDED: "This account is currently suspended. Please contact support if you think this is a mistake.",
};

export function RegistrationStatusCard({
  name,
  role,
  status,
  registrationId,
  createdAt,
  rejectionReason,
  showEmail,
  email,
}: {
  name: string;
  role: UserRole;
  status: UserStatus;
  registrationId: string | null;
  createdAt: Date;
  rejectionReason: string | null;
  showEmail?: boolean;
  email?: string;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Verification status</p>
          <div className="mt-1">
            <StatusBadge status={status} />
          </div>
        </div>
        {registrationId ? (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Registration ID</p>
            <p className="font-mono text-sm font-medium">{registrationId}</p>
          </div>
        ) : null}
      </div>

      <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">{STATUS_MESSAGE[status]}</p>

      {status === "REJECTED" && rejectionReason ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span className="font-medium">Reason:</span> {rejectionReason}
        </p>
      ) : null}

      <dl className="divide-y rounded-lg border text-sm">
        <div className="flex justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium">{name}</dd>
        </div>
        {showEmail && email ? (
          <div className="flex justify-between gap-4 px-3 py-2">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{email}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">Role</dt>
          <dd className="font-medium">{ROLE_LABEL[role]}</dd>
        </div>
        <div className="flex justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">Registered on</dt>
          <dd className="font-medium">
            {createdAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
          </dd>
        </div>
      </dl>

      {status === "APPROVED" ? (
        <Button render={<Link href="/auth/login" />} className="w-full" nativeButton={false}>
          Continue to sign in
        </Button>
      ) : status === "REJECTED" || status === "SUSPENDED" ? (
        <Button variant="outline" render={<Link href="/contact" />} className="w-full" nativeButton={false}>
          Contact support
        </Button>
      ) : null}
    </div>
  );
}
