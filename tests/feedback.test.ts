import { describe, expect, it } from "vitest";
import type { FieldError } from "../src/lib/bill";
import { errorsToShow, showErrorSummary } from "../src/lib/feedback";
import { reconcileReferenceType } from "../src/lib/reference-switch";

const required = (field: string): FieldError => ({ field, code: "required" });

describe("touched-state validation", () => {
  const errors = [required("creditor.name"), required("creditor.account"), required("amount")];

  it("shows nothing on an untouched form before export", () => {
    expect(errorsToShow(errors, { touched: new Set(), exportAttempted: false })).toEqual([]);
    expect(showErrorSummary(false, errors)).toBe(false);
  });

  it("shows only the field that was left", () => {
    expect(errorsToShow(errors, { touched: new Set(["creditor.name"]), exportAttempted: false })).toEqual([
      required("creditor.name"),
    ]);
    expect(showErrorSummary(false, errors)).toBe(false);
  });

  it("shows every error and the summary after an export attempt", () => {
    expect(errorsToShow(errors, { touched: new Set(), exportAttempted: true })).toEqual(errors);
    expect(showErrorSummary(true, errors)).toBe(true);
    expect(showErrorSummary(true, [])).toBe(false);
  });
});

describe("automatic reference type", () => {
  it("selects a QR reference for a QR-IBAN without clearing other text", () => {
    expect(reconcileReferenceType("qr-iban", "NON", "")).toEqual({ type: "QRR", note: "to-qrr" });
    expect(reconcileReferenceType("qr-iban", "SCOR", "RF18539007547034")).toEqual({ type: "QRR", note: "to-qrr" });
    expect(reconcileReferenceType("qr-iban", "QRR", "210000000003139471430009017")).toEqual({
      type: "QRR",
      note: null,
    });
  });

  it("does not rewrite a typed digit reference on a normal IBAN", () => {
    expect(reconcileReferenceType("regular-iban", "QRR", "")).toEqual({ type: "NON", note: "to-non" });
    expect(reconcileReferenceType("regular-iban", "QRR", "21 00000 00003")).toEqual({
      type: "QRR",
      note: "keep-qrr",
    });
    expect(reconcileReferenceType("regular-iban", "QRR", "RF18 5390")).toEqual({ type: "SCOR", note: "to-scor" });
  });

  it("does not move a euro bill onto a QR reference", () => {
    expect(reconcileReferenceType("qr-iban", "SCOR", "RF18539007547034", "EUR")).toEqual({
      type: "SCOR",
      note: "eur-iban",
    });
    expect(reconcileReferenceType("regular-iban", "QRR", "210000000003139471430009017", "EUR")).toEqual({
      type: "QRR",
      note: "eur-no-qrr",
    });
    expect(reconcileReferenceType("regular-iban", "NON", "", "EUR")).toEqual({ type: "NON", note: null });
    expect(reconcileReferenceType("regular-iban", "SCOR", "RF18539007547034", "EUR")).toEqual({
      type: "SCOR",
      note: null,
    });
  });

  it("leaves an incomplete IBAN and an already matching type alone", () => {
    expect(reconcileReferenceType("invalid", "QRR", "123")).toEqual({ type: "QRR", note: null });
    expect(reconcileReferenceType("regular-iban", "SCOR", "honorare")).toEqual({ type: "SCOR", note: null });
    expect(reconcileReferenceType("regular-iban", "NON", "")).toEqual({ type: "NON", note: null });
  });
});
