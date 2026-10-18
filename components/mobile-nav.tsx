"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "./sign-out-button";

export function MobileNav({ links, signedIn }: { links: { href: string; label: string }[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <Button variant="ghost" size="icon" aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>
        {open ? <X /> : <Menu />}
        <span className="sr-only">Menu</span>
      </Button>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="absolute inset-x-0 top-14 border-b bg-card p-2 shadow-md">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 text-sm font-medium hover:bg-muted">
              {l.label}
            </Link>
          ))}
          {signedIn ? (
            <SignOutButton className="w-full justify-start" />
          ) : (
            <Link href="/signup" onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 text-sm font-medium text-primary hover:bg-muted">
              Sign up
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
