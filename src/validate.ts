/**
 * The boundary between "bytes the server sent" and "values the types promise".
 *
 * Everything the API returns arrives as `unknown`. Casting it (`json as T`) makes
 * TypeScript vouch for data nobody checked, and a wrong shape then surfaces far
 * downstream as a nonsensical balance instead of an error. These helpers check the
 * *structure* — is it an object, is `data` an array — and throw {@link ValidationError}
 * when it is not.
 *
 * Individual fields are deliberately **not** enforced here: a live API adds fields,
 * renames enum values, and omits things it promised. Those are represented honestly
 * in the types (optional, nullable) and read through the accessors in `money.ts`,
 * which return `null` when a record cannot be interpreted. A single odd row must not
 * fail an entire sync, and it must never be guessed at.
 */
import { ValidationError } from "./errors.js";

/**
 * Describe a value's *shape* for an error message — never its contents.
 *
 * These messages get logged. An unexpected body is, by definition, something we did
 * not understand, so quoting even a little of it can put whatever it happened to
 * contain into the caller's logs. Kind and size are enough to recognise (say) a
 * Cloudflare interstitial without echoing it.
 */
export function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array (${value.length} items)`;
  if (typeof value === "string") {
    const kind = value.trimStart().startsWith("<") ? "an HTML/text page" : "a non-JSON string";
    return `${kind} (${value.length} bytes)`;
  }
  return `a ${typeof value}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Assert the body is a JSON object. */
export function expectObject(value: unknown, url: string, what: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ValidationError(url, what, describe(value));
  }
  return value;
}

/**
 * Assert the body is an object whose `key` holds an array, and return that array.
 *
 * The elements are returned as `T` without per-field checks — see the module note.
 */
export function expectArrayAt<T>(value: unknown, key: string, url: string, what: string): T[] {
  const body = expectObject(value, url, what);
  const list = body[key];
  if (!Array.isArray(list)) {
    throw new ValidationError(url, `${what} with an array \`${key}\``, describe(list));
  }
  return list as T[];
}
