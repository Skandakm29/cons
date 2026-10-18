import Link from "next/link";
import { Bell, HardHat } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "./sign-out-button";
import { MobileNav } from "./mobile-nav";

const NAV = {
  HOMEOWNER: [
    { href: "/dashboard", label: "My projects" },
    { href: "/projects/new", label: "Post a project" },
    { href: "/estimate", label: "Cost calculator" },
  ],
  BUILDER: [
    { href: "/builder/projects", label: "Open projects" },
    { href: "/builder/bids", label: "My bids" },
    { href: "/builder/onboarding", label: "Profile" },
  ],
  ADMIN: [
    { href: "/admin/builders", label: "Verification" },
    { href: "/admin/projects", label: "Moderation" },
    { href: "/admin/rates", label: "Rates" },
  ],
} as const;

const PUBLIC_NAV = [
  { href: "/estimate", label: "Cost calculator" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#packages", label: "Packages" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  const unread = user ? await prisma.notification.count({ where: { userId: user.id, read: false } }) : 0;
  const links = user ? NAV[user.role] : PUBLIC_NAV;

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <div className="container flex h-14 items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary">
          <HardHat className="h-5 w-5" aria-hidden />
          {APP_NAME}
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {links.map((l) => (
            <Button key={l.href} asChild variant="ghost" size="sm">
              <Link href={l.href}>{l.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          {user ? (
            <>
              <Button asChild variant="ghost" size="icon" className="relative">
                <Link href="/notifications" aria-label={`Notifications (${unread} unread)`}>
                  <Bell />
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              </Button>
              <span className="hidden text-sm text-muted-foreground lg:inline">{user.name}</span>
              <div className="hidden md:block">
                <SignOutButton />
              </div>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
          <MobileNav links={[...links]} signedIn={!!user} />
        </div>
      </div>
    </header>
  );
}
