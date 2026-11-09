/**
 * QR reference (mod 10 recursive) and creditor reference (ISO 11649 / SCOR).
 */

import { mod97 } from "./iban";

const QR_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];

export type ReferenceType = "QRR" | "SCOR" | "NON";

/** Check digit for a 26-digit (or shorter numeric) QR reference body. */
export function qrReferenceCheckDigit(body: string): string {
  const digits = body.replace(/\s+/g, "");
  if (!/^\d+$/.test(digits)) {
    throw new Error("QR reference body must be numeric");
  }
  let carry = 0;
  for (const character of digits) {
    carry = QR_TABLE[(carry + Number(character)) % 10];
  }
  return String((10 - carry) % 10);
}

/** Left-pad to 26 digits and append the mod 10 recursive check digit. */
export function completeQrReference(raw: string): string {
  const digits = raw.replace(/\s+/g, "");
  if (!/^\d+$/.test(digits) || digits.length < 1 || digits.length > 26) {
    throw new Error("QR reference seed must be 1 to 26 digits");
  }
  const body = digits.padStart(26, "0");
  return body + qrReferenceCheckDigit(body);
}

export function isQrReferenceValid(input: string): boolean {
  const reference = input.replace(/\s+/g, "");
  if (!/^\d{27}$/.test(reference)) return false;
  const expected = qrReferenceCheckDigit(reference.slice(0, 26));
  return reference[26] === expected;
}

export function formatQrReference(input: string): string {
  const reference = input.replace(/\s+/g, "");
  if (reference.length < 3) return reference;
  const groups = reference.slice(2).match(/.{1,5}/g)?.join(" ") ?? "";
  return `${reference.slice(0, 2)} ${groups}`.trim();
}

/** Two check digits for an ISO 11649 creditor reference body (without the RF prefix). */
export function scorCheckDigits(body: string): string {
  const reference = body.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{1,21}$/.test(reference)) {
    throw new Error("Creditor reference body must be 1 to 21 alphanumeric characters");
  }
  const check = 98 - mod97(`${reference}RF00`);
  return String(check).padStart(2, "0");
}

export function completeScorReference(body: string): string {
  const reference = body.replace(/\s+/g, "").toUpperCase();
  return `RF${scorCheckDigits(reference)}${reference}`;
}

export function isScorReferenceValid(input: string): boolean {
  const reference = input.replace(/\s+/g, "").toUpperCase();
  if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(reference)) return false;
  return scorCheckDigits(reference.slice(4)) === reference.slice(2, 4);
}

export function formatScorReference(input: string): string {
  const reference = input.replace(/\s+/g, "").toUpperCase();
  return reference.match(/.{1,4}/g)?.join(" ") ?? reference;
}

export interface NormalizedReference {
  ok: boolean;
  code?: "required" | "reference_digits" | "reference_invalid" | "reference_not_allowed" | "reference_zeros" | "too_long";
  /** Compact reference to place in the QR payload. Omitted for NON. */
  value?: string;
}

/**
 * Accept a full reference or a shorter seed.
 * QR seeds are padded to 26 digits. Creditor-reference seeds receive an RF prefix.
 * A full 27-digit QR reference is checked as-is and never rewritten.
 */
export function normalizeReference(type: ReferenceType, raw: string): NormalizedReference {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (type === "NON") {
    if (compact) return { ok: false, code: "reference_not_allowed" };
    return { ok: true };
  }
  if (!compact) return { ok: false, code: "required" };
  if (type === "QRR") {
    if (!/^\d+$/.test(compact)) return { ok: false, code: "reference_digits" };
    if (compact.length > 27) return { ok: false, code: "too_long" };
    const value = compact.length === 27 ? compact : completeQrReference(compact);
    if (!isQrReferenceValid(value)) return { ok: false, code: "reference_invalid" };
    if (/^0+$/.test(value)) return { ok: false, code: "reference_zeros" };
    return { ok: true, value };
  }
  if (compact.startsWith("RF")) {
    if (compact.length > 25) return { ok: false, code: "too_long" };
    if (!isScorReferenceValid(compact)) return { ok: false, code: "reference_invalid" };
    return { ok: true, value: compact };
  }
  if (!/^[A-Z0-9]+$/.test(compact) || compact.length > 21) {
    return { ok: false, code: "reference_invalid" };
  }
  const value = completeScorReference(compact);
  if (!isScorReferenceValid(value)) return { ok: false, code: "reference_invalid" };
  return { ok: true, value };
}
