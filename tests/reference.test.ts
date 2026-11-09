import {
  calculateQRReferenceChecksum,
  calculateSCORReferenceChecksum,
  isQRReferenceValid,
  isSCORReferenceValid,
} from "swissqrbill/utils";
import { describe, expect, it } from "vitest";
import {
  completeQrReference,
  completeScorReference,
  formatQrReference,
  formatScorReference,
  isQrReferenceValid,
  isScorReferenceValid,
  normalizeReference,
  qrReferenceCheckDigit,
  scorCheckDigits,
} from "../src/lib/reference";

describe("QR reference check digit", () => {
  it("matches the published 27-digit sample", () => {
    expect(qrReferenceCheckDigit("21000000000313947143000901")).toBe("7");
    expect(isQrReferenceValid("210000000003139471430009017")).toBe(true);
    expect(isQrReferenceValid("21 00000 00003 13947 14300 09017")).toBe(true);
    expect(isQrReferenceValid("210000000003139471430009018")).toBe(false);
    expect(qrReferenceCheckDigit("21000000000313947143000901")).toBe(
      calculateQRReferenceChecksum("21000000000313947143000901"),
    );
    expect(isQrReferenceValid("210000000003139471430009017")).toBe(
      isQRReferenceValid("210000000003139471430009017"),
    );
  });

  it("pads a short member number and appends the mod 10 recursive digit", () => {
    expect(qrReferenceCheckDigit("00000000000000000000012345")).toBe("7");
    const reference = completeQrReference("12345");
    expect(reference).toHaveLength(27);
    expect(reference.endsWith("12345")).toBe(false);
    expect(reference.slice(0, 26).endsWith("12345")).toBe(true);
    expect(isQrReferenceValid(reference)).toBe(true);
    expect(isQRReferenceValid(reference)).toBe(true);
    expect(normalizeReference("QRR", "12345").value).toBe(reference);
    expect(normalizeReference("QRR", reference).value).toBe(reference);
  });

  it("rejects letters, an empty value, and a wrong full reference", () => {
    expect(normalizeReference("QRR", "")).toMatchObject({ ok: false, code: "required" });
    expect(normalizeReference("QRR", "12A")).toMatchObject({ ok: false, code: "reference_digits" });
    expect(normalizeReference("QRR", "210000000003139471430009018")).toMatchObject({
      ok: false,
      code: "reference_invalid",
    });
    expect(normalizeReference("NON", "123")).toMatchObject({ ok: false, code: "reference_not_allowed" });
    expect(normalizeReference("NON", "  ").ok).toBe(true);
    expect(normalizeReference("QRR", "0")).toMatchObject({ ok: false, code: "reference_zeros" });
    expect(normalizeReference("QRR", "000000000000000000000000000")).toMatchObject({
      ok: false,
      code: "reference_zeros",
    });
    expect(normalizeReference("QRR", "12345").value).not.toMatch(/^0+$/);
  });
});

describe("ISO 11649 creditor reference", () => {
  it("builds and checks RF18539007547034", () => {
    expect(scorCheckDigits("539007547034")).toBe("18");
    expect(completeScorReference("539007547034")).toBe("RF18539007547034");
    expect(isScorReferenceValid("RF18539007547034")).toBe(true);
    expect(isScorReferenceValid("rf18 5390 0754 7034")).toBe(true);
    expect(isScorReferenceValid("RF00539007547034")).toBe(false);
    expect(scorCheckDigits("539007547034")).toBe(calculateSCORReferenceChecksum("539007547034"));
    expect(isScorReferenceValid("RF18539007547034")).toBe(isSCORReferenceValid("RF18539007547034"));
    expect(formatScorReference("RF18539007547034")).toBe("RF18 5390 0754 7034");
    expect(formatQrReference("210000000003139471430009017")).toBe("21 00000 00003 13947 14300 09017");
  });

  it("accepts a body or a full RF reference and rejects a bad check", () => {
    expect(normalizeReference("SCOR", "539007547034").value).toBe("RF18539007547034");
    expect(normalizeReference("SCOR", "RF18 5390 0754 7034").value).toBe("RF18539007547034");
    expect(normalizeReference("SCOR", "RF00539007547034")).toMatchObject({
      ok: false,
      code: "reference_invalid",
    });
    expect(normalizeReference("SCOR", "")).toMatchObject({ ok: false, code: "required" });
  });
});
