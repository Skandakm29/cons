import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { BUSINESS_RULES } from "@/lib/config";
import { ALLOWED_UPLOAD_TYPES, getStorage, sniffContentType } from "@/lib/services/storage";

const FOLDERS = ["portfolio", "documents", "bids"] as const;

/** Authenticated multipart upload. Returns { url } for use in forms. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  if (user.role !== "BUILDER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Uploads are for builders" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const folder = form?.get("folder");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (typeof folder !== "string" || !(FOLDERS as readonly string[]).includes(folder)) {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }
  if (file.size > BUSINESS_RULES.maxUploadBytes) {
    return NextResponse.json({ error: "File must be 5 MB or smaller" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const contentType = sniffContentType(bytes);
  if (!contentType || !ALLOWED_UPLOAD_TYPES.includes(contentType)) {
    return NextResponse.json({ error: "Only JPG, PNG, WebP or PDF files are allowed" }, { status: 415 });
  }
  if (folder !== "documents" && contentType === "application/pdf") {
    return NextResponse.json({ error: "Please upload an image" }, { status: 415 });
  }

  const stored = await getStorage().save({ bytes, name: file.name, contentType, folder });
  return NextResponse.json(stored);
}
