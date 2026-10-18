import type { Prisma } from "@prisma/client";

/** Converts a plain data object to Prisma's JSON input type (drops undefined, functions, etc.). */
export function toJson<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
