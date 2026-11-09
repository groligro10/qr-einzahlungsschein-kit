/**
 * Swiss and Liechtenstein IBAN checks for a QR-bill creditor account.
 * QR-IBAN means a valid CH/LI IBAN whose bank clearing (IID) is in 30000–31999.
 */

const IID_MIN = 30000;
const IID_MAX = 31999;

export type AccountKind = "qr-iban" | "regular-iban" | "invalid";

export type AccountReason = "empty" | "characters" | "country" | "length" | "checksum";

export interface AccountClassification {
  kind: AccountKind;
  /** Compact uppercase IBAN, or the trimmed input when it cannot be normalized. */
  iban: string;
  reason?: AccountReason;
}

export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function formatIban(input: string): string {
  const compact = normalizeIban(input);
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

/** ISO 13616 / ISO 7064 mod 97-10. Letters expand to two digits (A=10 … Z=35). */
export function mod97(input: string): number {
  const expanded = input.toUpperCase().replace(/[A-Z]/g, (letter) =>
    String(letter.charCodeAt(0) - 55),
  );
  let remainder = 0;
  for (const character of expanded) {
    const digit = character.charCodeAt(0) - 48;
    if (digit < 0 || digit > 9) return -1;
    remainder = (remainder * 10 + digit) % 97;
  }
  return remainder;
}

export function isIbanChecksumValid(iban: string): boolean {
  const compact = normalizeIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  return mod97(rearranged) === 1;
}

/** Build a valid IBAN from a country code and BBAN (no check digits). */
export function buildIban(country: string, bban: string): string {
  const code = country.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || !/^[A-Z0-9]+$/.test(bban)) {
    throw new Error("Country and BBAN must be alphanumeric");
  }
  const check = 98 - mod97(`${bban}${code}00`);
  return `${code}${String(check).padStart(2, "0")}${bban}`;
}

export function classifyAccount(input: string): AccountClassification {
  const iban = normalizeIban(input);
  if (!iban) return { kind: "invalid", iban, reason: "empty" };
  if (!/^[A-Z0-9]+$/.test(iban)) return { kind: "invalid", iban, reason: "characters" };
  if (!iban.startsWith("CH") && !iban.startsWith("LI")) {
    return { kind: "invalid", iban, reason: "country" };
  }
  if (iban.length !== 21) return { kind: "invalid", iban, reason: "length" };
  if (!isIbanChecksumValid(iban)) return { kind: "invalid", iban, reason: "checksum" };
  const iid = Number(iban.slice(4, 9));
  const kind: AccountKind = iid >= IID_MIN && iid <= IID_MAX ? "qr-iban" : "regular-iban";
  return { kind, iban };
}

export function isQrIban(input: string): boolean {
  return classifyAccount(input).kind === "qr-iban";
}

export function isRegularCreditorIban(input: string): boolean {
  return classifyAccount(input).kind === "regular-iban";
}
