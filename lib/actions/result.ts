import { ZodError } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** An error whose message is safe to show to the user. */
export class ActionError extends Error {}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/** Runs an action body, converting validation and expected errors into an ActionResult. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return { ok: false, error: e.issues[0]?.message ?? "Invalid input", fieldErrors };
    }
    if (e instanceof ActionError) return { ok: false, error: e.message };
    // Next.js redirect()/notFound() throw special errors that must propagate.
    if (e instanceof Error && "digest" in e && typeof e.digest === "string" && e.digest.startsWith("NEXT_")) throw e;
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
