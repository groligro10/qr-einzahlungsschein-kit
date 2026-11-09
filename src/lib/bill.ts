import type { Data } from "swissqrbill/types";
import { parseAmount, parseCurrency, type Currency } from "./amount";
import { classifyAccount } from "./iban";
import { normalizeReference, type ReferenceType } from "./reference";
import { hasPermittedCharacters, normalizeText } from "./text";

export interface PostalAddress {
  name: string;
  street: string;
  buildingNumber: string;
  zip: string;
  city: string;
  country: string;
}

export interface CreditorInput extends PostalAddress {
  account: string;
}

export interface BillInput {
  creditor: CreditorInput;
  currency: string;
  openAmount: boolean;
  amount: string;
  debtor: PostalAddress | null;
  referenceType: ReferenceType;
  reference: string;
  message: string;
  billing: string;
}

export interface FieldError {
  field: string;
  code:
    | "required"
    | "too_long"
    | "charset"
    | "iban_invalid"
    | "iban_country"
    | "qrr_needs_qr_iban"
    | "scor_needs_regular_iban"
    | "non_needs_regular_iban"
    | "eur_needs_regular_iban"
    | "eur_no_qr_reference"
    | "reference_invalid"
    | "reference_zeros"
    | "reference_digits"
    | "reference_not_allowed"
    | "amount_invalid"
    | "currency"
    | "country"
    | "combined_length";
  max?: number;
}

export interface PreparedBill {
  ok: true;
  data: Data;
  currency: Currency;
  amount?: number;
  referenceType: ReferenceType;
  normalizedReference?: string;
  message: string;
  billing: string;
}

export interface RejectedBill {
  ok: false;
  errors: FieldError[];
}

const LIMITS: Record<string, number> = {
  name: 70,
  street: 70,
  buildingNumber: 16,
  zip: 16,
  city: 35,
  message: 140,
  billing: 140,
};

function checkText(field: string, value: string, max: number, required: boolean, errors: FieldError[]): string {
  const text = normalizeText(value);
  if (!text) {
    if (required) errors.push({ field, code: "required" });
    return "";
  }
  if (text.length > max) errors.push({ field, code: "too_long", max });
  if (!hasPermittedCharacters(text)) errors.push({ field, code: "charset" });
  return text;
}

function checkCountry(field: string, value: string, errors: FieldError[]): string {
  const country = normalizeText(value).toUpperCase();
  if (!country) {
    errors.push({ field, code: "required" });
    return "";
  }
  if (!/^[A-Z]{2}$/.test(country)) errors.push({ field, code: "country" });
  return country;
}

export function validateCreditor(input: CreditorInput): FieldError[] {
  const errors: FieldError[] = [];
  checkText("creditor.name", input.name, LIMITS.name, true, errors);
  checkText("creditor.street", input.street, LIMITS.street, true, errors);
  checkText("creditor.building", input.buildingNumber, LIMITS.buildingNumber, false, errors);
  checkText("creditor.zip", input.zip, LIMITS.zip, true, errors);
  checkText("creditor.city", input.city, LIMITS.city, true, errors);
  checkCountry("creditor.country", input.country, errors);
  const account = classifyAccount(input.account);
  if (account.kind === "invalid") {
    errors.push({
      field: "creditor.account",
      code: account.reason === "country" ? "iban_country" : "iban_invalid",
    });
  }
  return errors;
}

function addressOf(prefix: "creditor" | "debtor", input: PostalAddress, errors: FieldError[]) {
  const name = checkText(`${prefix}.name`, input.name, LIMITS.name, true, errors);
  const street = checkText(`${prefix}.street`, input.street, LIMITS.street, true, errors);
  const buildingNumber = checkText(`${prefix}.building`, input.buildingNumber, LIMITS.buildingNumber, false, errors);
  const zip = checkText(`${prefix}.zip`, input.zip, LIMITS.zip, true, errors);
  const city = checkText(`${prefix}.city`, input.city, LIMITS.city, true, errors);
  const country = checkCountry(`${prefix}.country`, input.country, errors);
  return { name, street, buildingNumber, zip, city, country };
}

export function prepareBill(input: BillInput): PreparedBill | RejectedBill {
  const errors: FieldError[] = [];
  const creditor = addressOf("creditor", input.creditor, errors);
  const account = classifyAccount(input.creditor.account);
  if (account.kind === "invalid") {
    errors.push({
      field: "creditor.account",
      code: account.reason === "country" ? "iban_country" : "iban_invalid",
    });
  }

  const currency = parseCurrency(input.currency, "CHF");
  if (!currency || (input.currency.trim() && parseCurrency(input.currency, "CHF") === undefined)) {
    errors.push({ field: "currency", code: "currency" });
  }
  let amount: number | undefined;
  if (!input.openAmount) {
    const parsed = parseAmount(input.amount);
    if (!parsed.ok) errors.push({ field: "amount", code: "amount_invalid" });
    else amount = parsed.amount;
  }

  let debtor: ReturnType<typeof addressOf> | undefined;
  if (input.debtor) {
    const anyDebtor = Object.values(input.debtor).some((value) => normalizeText(value) !== "");
    if (anyDebtor) debtor = addressOf("debtor", input.debtor, errors);
  }

  const reference = normalizeReference(input.referenceType, input.reference);
  if (!reference.ok && reference.code) {
    errors.push({ field: "reference", code: reference.code, max: reference.code === "too_long" ? 27 : undefined });
  }

  if (account.kind === "qr-iban" && input.referenceType !== "QRR") {
    errors.push({
      field: "reference",
      code: input.referenceType === "SCOR" ? "scor_needs_regular_iban" : "non_needs_regular_iban",
    });
  }
  if (account.kind === "regular-iban" && input.referenceType === "QRR") {
    errors.push({ field: "reference", code: "qrr_needs_qr_iban" });
  }
  if (currency === "EUR" && account.kind === "qr-iban") {
    errors.push({ field: "creditor.account", code: "eur_needs_regular_iban" });
  }
  if (currency === "EUR" && input.referenceType === "QRR") {
    errors.push({ field: "reference", code: "eur_no_qr_reference" });
  }

  const message = checkText("message", input.message, LIMITS.message, false, errors);
  const billing = checkText("billing", input.billing, LIMITS.billing, false, errors);
  if (message && billing && message.length + billing.length > 140) {
    errors.push({ field: "billing", code: "combined_length", max: 140 });
  }

  if (errors.length > 0 || !currency || account.kind === "invalid") {
    return { ok: false, errors };
  }

  const data: Data = {
    currency,
    creditor: {
      account: account.iban,
      name: creditor.name,
      address: creditor.street,
      zip: creditor.zip,
      city: creditor.city,
      country: creditor.country,
      ...(creditor.buildingNumber ? { buildingNumber: creditor.buildingNumber } : {}),
    },
  };
  if (amount !== undefined && !input.openAmount) data.amount = amount;
  if (reference.value) data.reference = reference.value;
  if (debtor) {
    data.debtor = {
      name: debtor.name,
      address: debtor.street,
      zip: debtor.zip,
      city: debtor.city,
      country: debtor.country,
      ...(debtor.buildingNumber ? { buildingNumber: debtor.buildingNumber } : {}),
    };
  }
  if (message) data.message = message;
  if (billing) data.additionalInformation = billing;

  return {
    ok: true,
    data,
    currency,
    amount: input.openAmount ? undefined : amount,
    referenceType: input.referenceType,
    normalizedReference: reference.value,
    message,
    billing,
  };
}
