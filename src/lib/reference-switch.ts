import type { Currency } from "./amount";
import type { AccountKind } from "./iban";
import type { ReferenceType } from "./reference";

export type SwitchNote = "to-qrr" | "to-non" | "to-scor" | "keep-qrr" | "eur-iban" | "eur-no-qrr";

export interface ReferenceDecision {
  type: ReferenceType;
  note: SwitchNote | null;
}

/**
 * QR-IBAN selects a QR reference. A normal IBAN leaves a typed digit reference
 * in place and only explains it; an empty reference becomes "no reference",
 * and any other typed text stays visible as a creditor reference.
 */
export function reconcileReferenceType(
  accountKind: AccountKind,
  referenceType: ReferenceType,
  reference: string,
  currency: Currency = "CHF",
): ReferenceDecision {
  if (accountKind === "invalid") return { type: referenceType, note: null };
  if (currency === "EUR") {
    if (accountKind === "qr-iban") return { type: referenceType, note: "eur-iban" };
    if (referenceType !== "QRR") return { type: referenceType, note: null };
    const text = reference.trim();
    if (!text) return { type: "NON", note: "to-non" };
    if (/^[\d\s]+$/.test(text)) return { type: "QRR", note: "eur-no-qrr" };
    return { type: "SCOR", note: "to-scor" };
  }
  if (accountKind === "qr-iban") {
    if (referenceType === "QRR") return { type: "QRR", note: null };
    return { type: "QRR", note: "to-qrr" };
  }
  if (referenceType !== "QRR") return { type: referenceType, note: null };
  const text = reference.trim();
  if (!text) return { type: "NON", note: "to-non" };
  if (/^[\d\s]+$/.test(text)) return { type: "QRR", note: "keep-qrr" };
  return { type: "SCOR", note: "to-scor" };
}
