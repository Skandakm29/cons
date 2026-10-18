import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface StoredFile {
  url: string;
  name: string;
  size: number;
  contentType: string;
}

/** File storage abstraction. Swap LocalStorageService for S3 / Cloudinary in production. */
export interface StorageService {
  save(input: { bytes: Buffer; name: string; contentType: string; folder: string }): Promise<StoredFile>;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
export const ALLOWED_UPLOAD_TYPES = Object.keys(EXTENSIONS);

/** Writes to /public/uploads so files are served statically by `next dev`. */
export class LocalStorageService implements StorageService {
  constructor(private readonly root = path.join(process.cwd(), "public", "uploads")) {}

  async save({ bytes, name, contentType, folder }: { bytes: Buffer; name: string; contentType: string; folder: string }) {
    const ext = EXTENSIONS[contentType];
    if (!ext) throw new Error(`Unsupported file type ${contentType}`);
    const safeFolder = folder.replace(/[^a-z0-9-]/gi, "");
    const fileName = `${randomUUID()}.${ext}`;
    const dir = path.join(this.root, safeFolder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), bytes);
    return { url: `/uploads/${safeFolder}/${fileName}`, name, size: bytes.length, contentType };
  }
}

export function getStorage(): StorageService {
  switch (process.env.STORAGE_PROVIDER ?? "local") {
    case "local":
      return new LocalStorageService();
    // case "s3": return new S3StorageService(...);
    default:
      throw new Error(`Unknown STORAGE_PROVIDER "${process.env.STORAGE_PROVIDER}"`);
  }
}

/** Checks magic bytes so a renamed file can't pass as an image. */
export function sniffContentType(bytes: Buffer): string | null {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}
