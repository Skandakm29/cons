"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <Button variant="ghost" size="sm" className={className} onClick={() => signOut({ callbackUrl: "/" })}>
      <LogOut aria-hidden /> Log out
    </Button>
  );
}
