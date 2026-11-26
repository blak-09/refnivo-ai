import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeaderLogo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center focus:outline-none">
      <HeaderLogo />
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you are looking for does not exist, or you do not have access to it.
      </p>
      <Button nativeButton={false} render={<Link href="/" />}>Back to home</Button>
    </main>
  );
}
