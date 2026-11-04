import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { HeaderLogo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/guards";

/** Focused shell for signup: logo, and a way out (log in / log out) — no marketing navigation. */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <HeaderLogo />
        {user ? (
          <form action={logoutAction}>
            <button type="submit" className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              Log out
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Have an account?{" "}
            <Link href="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>
        )}
      </header>
      <main className="flex flex-1 justify-center px-4 pt-4 pb-16 sm:px-6 sm:pt-8">{children}</main>
    </div>
  );
}
