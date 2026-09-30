"use client";

import * as React from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";

export type NavLink = { href: string; label: string };

/** Hamburger menu for the marketing header on small screens. */
export function MobileNav({
  links,
  resources = [],
  signedIn,
  dashboardHref,
}: {
  links: NavLink[];
  resources?: NavLink[];
  signedIn: boolean;
  dashboardHref: string;
}) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="icon-sm" aria-label="Open menu" className="lg:hidden" />}>
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="right" className="w-80 p-0">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="flex h-full flex-col">
          <div className="border-b px-5 py-4">
            <Logo size="sm" />
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3" aria-label="Mobile">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {l.label}
              </Link>
            ))}
            {resources.length ? (
              <>
                <p className="mt-3 px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Resources</p>
                {resources.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={close}
                    className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                ))}
              </>
            ) : null}
          </nav>
          <div className="mt-auto flex flex-col gap-2 border-t p-4">
            {signedIn ? (
              <Button nativeButton={false} render={<Link href={dashboardHref} onClick={close} />}>
                Go to dashboard
              </Button>
            ) : (
              <>
                <Button variant="outline" nativeButton={false} render={<Link href="/auth/login" onClick={close} />}>
                  Log in
                </Button>
                <Button nativeButton={false} render={<Link href="/auth/register" onClick={close} />}>
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
