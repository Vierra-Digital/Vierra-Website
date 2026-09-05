/** Normalizes a free-typed phone number to `(XXX)-XXX-XXXX`, or null if it isn't 10 digits. */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 10) return null;
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}
