import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { parseNotificationPayload } from "@/lib/validation/json";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { MarkAllReadButton } from "@/components/mark-all-read-button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requirePageUser();
  const rows = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const items = rows.map((n) => ({ ...n, payload: parseNotificationPayload(n.payload) }));
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="container max-w-3xl py-8">
      <PageHeader title="Notifications" description={unread ? `${unread} unread` : "You're all caught up"} actions={unread > 0 && <MarkAllReadButton />} />
      {items.length === 0 ? (
        <EmptyState icon={BellOff} title="No notifications yet" description="Updates about bids, messages and awards show up here." />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {items.map((n) => {
            const inner = (
              <div className={cn("flex gap-3 p-4", !n.read && "bg-accent/50")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium">{n.payload.title}{!n.read && <span className="sr-only"> (unread)</span>}</p>
                  <p className="text-sm text-muted-foreground">{n.payload.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.payload.href ? <Link href={n.payload.href} className="block hover:bg-muted/50">{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
