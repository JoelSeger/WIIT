import { ValidationError } from "../services/errorService";

/** Small helpers for validating request bodies. Shared by the node controllers. */

export const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isPositiveInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

export function optionalString(v: unknown, field: string, max: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new ValidationError(`${field} must be a string`);
  const t = v.trim();
  if (t.length > max) throw new ValidationError(`${field} must be at most ${max} characters`);
  return t === "" ? null : t;
}

export function optionalDate(v: unknown, field: string): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !DATE.test(v) || Number.isNaN(Date.parse(v))) {
    throw new ValidationError(`${field} must be a date as YYYY-MM-DD`);
  }
  return v;
}
