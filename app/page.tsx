import Link from "next/link";
import { BadgeCheck, Calculator, ClipboardList, Gavel, Scale, ShieldCheck } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { prisma } from "@/lib/db";
import { PACKAGES } from "@/lib/estimator/types";
import { DEFAULT_ESTIMATOR_CONFIG } from "@/lib/estimator/config";
import { formatINR, humanize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STEPS = [
  { icon: ClipboardList, title: "Post your project", body: "Plot size, floors, rooms, budget and preferred package — takes 3 minutes." },
  { icon: Calculator, title: "Get our price benchmark", body: "Our estimator gives a fair cost range with a BOQ-style breakdown and a recommended plan." },
  { icon: Gavel, title: "Verified builders bid", body: "Builders submit sealed quotes with breakdowns, materials, warranty and a demo of their work." },
  { icon: Scale, title: "Compare & award", body: "See every bid side-by-side against our benchmark, chat, shortlist and award with confidence." },
];

export default async function HomePage() {
  const rates = await prisma.estimatorRate.findMany({ where: { city: "Bengaluru" } });
  const rateFor = (p: string) => rates.find((r) => r.package === p);

  return (
    <>
      <section className="border-b bg-gradient-to-b from-accent to-background">
        <div className="container grid gap-8 py-14 sm:py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium">
              <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-hidden /> Now live in Bengaluru
            </p>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">
              Get multiple verified builder quotes for your home, plus a fair price benchmark.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Stop guessing whether one contractor&apos;s quote is fair. {APP_NAME} runs a transparent tender for your house
              and holds builders accountable to milestones and BOQ.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/projects/new">Post your project — free</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/estimate">Estimate my construction cost</Link>
              </Button>
            </div>
          </div>
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Example: 2,400 sqft G+1 in Bengaluru</CardTitle>
              <CardDescription>How a tender on {APP_NAME} looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Our benchmark (Standard)" value="₹50.7 L – ₹56.9 L" strong />
              <Row label="Builder A · 4.8★ · 30 wk" value="₹53.2 L" tone="text-emerald-700" />
              <Row label="Builder B · 4.5★ · 34 wk" value="₹61.0 L" tone="text-amber-700" />
              <Row label="Builder C · 4.1★ · 26 wk" value="₹35.5 L ⚠ ask for BOQ" tone="text-red-700" />
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="how-it-works" className="container scroll-mt-20 py-14">
        <h2 className="text-2xl font-bold sm:text-3xl">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full">
                <CardHeader>
                  <s.icon className="h-7 w-7 text-primary" aria-hidden />
                  <CardTitle className="text-base">
                    {i + 1}. {s.title}
                  </CardTitle>
                  <CardDescription>{s.body}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section id="packages" className="scroll-mt-20 border-y bg-card py-14">
        <div className="container">
          <h2 className="text-2xl font-bold sm:text-3xl">Packages</h2>
          <p className="mt-1 text-muted-foreground">Indicative Bengaluru rates per sqft of built-up area. Builders quote their own price.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PACKAGES.map((p) => {
              const r = rateFor(p);
              return (
                <Card key={p} className={p === "STANDARD" ? "border-primary ring-1 ring-primary" : undefined}>
                  <CardHeader>
                    <CardTitle>{humanize(p)}</CardTitle>
                    <p className="text-xl font-bold text-primary">
                      {r ? `${formatINR(r.ratePerSqftLow)}–${formatINR(r.ratePerSqftHigh)}` : "—"}
                      <span className="text-sm font-normal text-muted-foreground"> /sqft</span>
                    </p>
                    <CardDescription>{DEFAULT_ESTIMATOR_CONFIG.packageBlurbs[p]}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container grid gap-4 py-14 md:grid-cols-2">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-2xl">Building a home?</CardTitle>
            <CardDescription className="text-primary-foreground/85">
              Post once, get several verified quotes with our benchmark beside each one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" size="lg">
              <Link href="/signup?role=HOMEOWNER">Post a project</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <ShieldCheck className="h-7 w-7 text-primary" aria-hidden />
            <CardTitle className="text-2xl">Are you a builder?</CardTitle>
            <CardDescription>Get verified, bid on serious projects with clear requirements, and win on quality — not just price.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="lg">
              <Link href="/signup?role=BUILDER">Join as a builder</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <span className={strong ? "font-semibold" : undefined}>{label}</span>
      <span className={`text-right font-semibold tabular-nums ${tone ?? "text-primary"}`}>{value}</span>
    </div>
  );
}
