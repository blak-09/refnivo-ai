import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <Link href="/auth/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Log in
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 sm:px-6">{children}</main>
    </div>
  );
}
