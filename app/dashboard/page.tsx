import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";

export default async function DashboardIndex({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const user = await requireUser();
  const { notice } = await searchParams;
  // Google sign-up chose one role but the e-mail already had an account of another: say so on arrival.
  redirect(notice === "linked-existing" ? `${roleHome(user.role)}?notice=linked-existing` : roleHome(user.role));
}
