import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/session";
import { BREAKDOWN_CATEGORIES, CATEGORY_LABELS } from "@/lib/estimator/types";
import { contactUnlocked, getBidForParticipant } from "@/lib/services/access";
import { getLatestEstimate } from "@/lib/services/estimates";
import { formatINR, humanize, maskPhone } from "@/lib/format";
import { MATERIAL_FIELDS } from "@/lib/validation/bid";
import { parseBidBreakdown, parseMaterialsSpec, parseMilestones } from "@/lib/validation/json";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { PriceBandBadge, UnusuallyLowWarning } from "@/components/price-band-badge";
import { BidStatusBadge, VerificationBadge } from "@/components/status-badge";
import { DemoPreview } from "@/components/bids/demo-preview";
import { ChatPanel } from "@/components/bids/chat-panel";
import { BidActions } from "@/components/projects/bid-actions";

export const metadata: Metadata = { title: "Bid & chat" };

export default async function BidPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser();
  const access = await getBidForParticipant(id, user);
  if (!access) notFound();
  const { bid, isHomeowner, isBuilder } = access;

  const [estimate, messages, portfolio] = await Promise.all([
    getLatestEstimate(bid.projectId),
    prisma.message.findMany({ where: { bidId: bid.id }, orderBy: { createdAt: "asc" }, include: { sender: { select: { name: true } } } }),
    prisma.portfolioItem.findMany({ where: { id: { in: bid.demoPortfolioItemIds }, builderId: bid.builderId }, select: { id: true, title: true, imageUrls: true } }),
  ]);
  const breakdown = parseBidBreakdown(bid.breakdown);
  const materials = parseMaterialsSpec(bid.materialsSpec);
  const milestones = parseMilestones(bid.paymentMilestones);
  const unlocked = contactUnlocked(bid);
  const other = isHomeowner
    ? { label: bid.builder.companyName, name: bid.builder.user.name, phone: bid.builder.user.phone }
    : { label: "Homeowner", name: bid.project.homeowner.name, phone: bid.project.homeowner.phone };
  const chatClosed = bid.project.status === "CANCELLED" || bid.status === "WITHDRAWN" || (!isHomeowner && !isBuilder);
  const back = isHomeowner ? `/projects/${bid.projectId}` : isBuilder ? `/builder/projects/${bid.projectId}` : "/admin/projects";

  return (
    <div className="container space-y-6 py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-3"><Link href={back}><ArrowLeft aria-hidden /> Back to project</Link></Button>
      <PageHeader
        title={`${bid.builder.companyName} · ${formatINR(bid.totalPrice)}`}
        description={<span className="flex flex-wrap items-center gap-2"><BidStatusBadge status={bid.status} /><span>{bid.project.title}</span></span>}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-3" aria-labelledby="chat-heading">
          <Card>
            <CardHeader className="pb-3">
              <h2 id="chat-heading" className="text-base font-semibold">Chat with {isHomeowner ? bid.builder.companyName : "the homeowner"}</h2>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {unlocked ? (
                  <><Phone className="h-4 w-4" aria-hidden /> {other.name}: <a className="font-semibold text-foreground underline" href={`tel:+91${other.phone}`}>+91 {other.phone}</a></>
                ) : (
                  <><Lock className="h-4 w-4" aria-hidden /> {other.name.split(" ")[0]} · {maskPhone(other.phone)} — numbers are shared once the project is awarded.</>
                )}
              </p>
            </CardHeader>
            <CardContent>
              <ChatPanel
                bidId={bid.id}
                disabled={chatClosed}
                note={unlocked ? undefined : "Phone numbers in messages are hidden until award."}
                messages={messages.map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), mine: m.senderId === user.id, senderName: m.sender.name }))}
              />
            </CardContent>
          </Card>
          {isHomeowner && (
            <BidActions bidId={bid.id} status={bid.status} builderName={bid.builder.companyName} totalPrice={bid.totalPrice}
              canDecide={bid.project.status === "OPEN" || bid.project.status === "UNDER_REVIEW"} />
          )}
        </section>

        <aside className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Bid summary</CardTitle>
              <div className="flex flex-wrap gap-2"><VerificationBadge status={bid.builder.verificationStatus} /></div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {estimate && (
                <div className="space-y-1">
                  <PriceBandBadge price={bid.totalPrice} low={estimate.totalLow} high={estimate.totalHigh} />
                  <UnusuallyLowWarning price={bid.totalPrice} low={estimate.totalLow} high={estimate.totalHigh} />
                  <p className="text-muted-foreground">Benchmark {formatINR(estimate.totalLow)} – {formatINR(estimate.totalHigh)}</p>
                </div>
              )}
              <p>{bid.timelineWeeks} weeks · {bid.warrantyYears}-year warranty</p>
              <p className="whitespace-pre-wrap rounded-md bg-muted p-3">{bid.coverNote}</p>
              <div>
                <h3 className="mb-1 font-semibold">Demo ({humanize(bid.demoType)})</h3>
                <DemoPreview demoType={bid.demoType} demoUrls={bid.demoUrls} portfolio={portfolio} />
              </div>
              <details>
                <summary className="cursor-pointer font-semibold">Cost breakdown</summary>
                <ul className="mt-2 divide-y">
                  {BREAKDOWN_CATEGORIES.map((c) => (
                    <li key={c} className="flex justify-between gap-2 py-1"><span>{CATEGORY_LABELS[c]}</span><span className="tabular-nums">{formatINR(breakdown[c])}</span></li>
                  ))}
                </ul>
              </details>
              <details>
                <summary className="cursor-pointer font-semibold">Materials</summary>
                <dl className="mt-2 space-y-1">
                  {MATERIAL_FIELDS.map(([k, label]) => (
                    <div key={k}><dt className="text-muted-foreground">{label}</dt><dd>{materials[k]}</dd></div>
                  ))}
                </dl>
              </details>
              <details>
                <summary className="cursor-pointer font-semibold">Payment milestones</summary>
                <ol className="mt-2 space-y-1">
                  {milestones.map((m, i) => <li key={m.name} className="flex justify-between"><span>{i + 1}. {m.name}</span><span>{m.percent}%</span></li>)}
                </ol>
              </details>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
