"use client";

import { useId, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Folder = "portfolio" | "documents" | "bids";

async function uploadOne(file: File, folder: Folder): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  body.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body });
  const json: { url?: string; error?: string } = await res.json().catch(() => ({ error: "Upload failed" }));
  if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed");
  return json.url;
}

/** Uploads files through /api/upload (StorageService) and returns their URLs. */
export function FileUpload({
  value,
  onChange,
  folder,
  max = 6,
  accept = "image/jpeg,image/png,image/webp",
  label = "Upload images",
  error,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  folder: Folder;
  max?: number;
  accept?: string;
  label?: string;
  error?: string;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setUploadError(null);
    setBusy(true);
    const urls = [...value];
    try {
      for (const f of Array.from(files).slice(0, max - value.length)) urls.push(await uploadOne(f, folder));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    }
    onChange(urls);
    setBusy(false);
  }

  const shown = uploadError ?? error;
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((u) => (
            <li key={u} className="relative">
              {u.endsWith(".pdf") ? (
                <a href={u} target="_blank" rel="noreferrer" className="flex h-20 w-28 flex-col items-center justify-center gap-1 rounded border text-xs">
                  <FileText className="h-6 w-6" aria-hidden /> PDF
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u} alt="Uploaded file" className="h-20 w-28 rounded border object-cover" />
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== u))}
                className="absolute -right-2 -top-2 rounded-full border bg-card p-0.5 shadow"
                aria-label="Remove file"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length < max && (
        <div>
          <input id={id} type="file" accept={accept} multiple={max > 1} className="sr-only" onChange={(e) => { void handle(e.target.files); e.target.value = ""; }} disabled={busy} />
          <Button asChild type="button" variant="outline" size="sm">
            <label htmlFor={id} className="cursor-pointer">
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />} {label}
            </label>
          </Button>
          <span className="ml-2 text-xs text-muted-foreground">Max 5 MB each</span>
        </div>
      )}
      {shown && <p className="text-xs font-medium text-destructive" role="alert">{shown}</p>}
    </div>
  );
}
