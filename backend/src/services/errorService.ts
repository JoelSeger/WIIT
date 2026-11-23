/**
 * Errors that services throw on purpose. The controller maps them to HTTP status codes
 * with instanceof, never by comparing message strings.
 */
export class ServiceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string) { super(message, 400); }
}

export class NotFoundError extends ServiceError {
  constructor(message: string) { super(message, 404); }
}

export class ConflictError extends ServiceError {
  constructor(message: string) { super(message, 409); }
}

/** SQL Server unique-key violation (2601 / 2627), read from the driver error. */
export function isUniqueViolation(error: unknown): boolean {
  const e = error as { number?: number; originalError?: { number?: number }; code?: string };
  const n = e?.number ?? e?.originalError?.number;
  return n === 2601 || n === 2627 || e?.code === "SQLITE_CONSTRAINT_UNIQUE";
}

/** SQL Server foreign-key violation (547), read from the driver error. */
export function isForeignKeyViolation(error: unknown): boolean {
  const e = error as { number?: number; originalError?: { number?: number }; code?: string };
  const n = e?.number ?? e?.originalError?.number;
  return n === 547 || e?.code === "SQLITE_CONSTRAINT_FOREIGNKEY";
}
