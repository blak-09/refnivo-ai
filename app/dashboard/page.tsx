import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";

export default async function DashboardIndex() {
  const user = await requireUser();
  redirect(roleHome(user.role));
}
