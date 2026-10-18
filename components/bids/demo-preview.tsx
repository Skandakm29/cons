import { ExternalLink, PlayCircle, Ruler } from "lucide-react";
import type { DemoType } from "@prisma/client";
import { humanize } from "@/lib/format";

export interface DemoPortfolioItem {
  id: string;
  title: string;
  imageUrls: string[];
}

/** Shows a bid's demo: image thumbnails, portfolio projects, or design/video links. */
export function DemoPreview({
  demoType,
  demoUrls,
  portfolio,
  compact = false,
}: {
  demoType: DemoType;
  demoUrls: string[];
  portfolio: DemoPortfolioItem[];
  compact?: boolean;
}) {
  const thumb = compact ? "h-14 w-20" : "h-24 w-36";
  if (demoType === "IMAGES") {
    return (
      <div className="flex flex-wrap gap-2">
        {demoUrls.slice(0, compact ? 2 : 8).map((u) => (
          <a key={u} href={u} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="Bid demo image" className={`${thumb} rounded border object-cover`} />
          </a>
        ))}
      </div>
    );
  }
  if (demoType === "PORTFOLIO") {
    return (
      <ul className="flex flex-wrap gap-2">
        {portfolio.slice(0, compact ? 2 : 6).map((p) => (
          <li key={p.id} className={compact ? "w-20" : "w-36"}>
            {p.imageUrls[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrls[0]} alt={p.title} className={`${thumb} rounded border object-cover`} />
            )}
            <p className="mt-1 line-clamp-2 text-xs">{p.title}</p>
          </li>
        ))}
      </ul>
    );
  }
  const Icon = demoType === "VIDEO" ? PlayCircle : Ruler;
  return (
    <ul className="space-y-1">
      {demoUrls.map((u) => (
        <li key={u}>
          <a href={u} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-sm text-primary underline">
            <Icon className="h-4 w-4" aria-hidden /> {humanize(demoType)}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
