import { describe, expect, it } from "vitest";
import { prepareBill, type BillInput, type CreditorInput } from "../src/lib/bill";
import { hasPermittedCharacters, isAllowedQrCharacter, normalizeText } from "../src/lib/text";
import { STRINGS } from "../src/i18n";

const qrCreditor: CreditorInput = {
  name: "Robert Schneider AG",
  street: "Rue du Lac",
  buildingNumber: "1268",
  zip: "2501",
  city: "Biel",
  country: "CH",
  account: "CH44 3199 9123 0008 8901 2",
};

const regularCreditor: CreditorInput = {
  ...qrCreditor,
  account: "CH58 0079 1123 0008 8901 2",
};

const debtor = {
  name: "Pia-Maria Rutschmann-Schnyder",
  street: "Grosse Marktgasse",
  buildingNumber: "28",
  zip: "9400",
  city: "Rorschach",
  country: "CH",
};

function bill(overrides: Partial<BillInput> = {}): BillInput {
  return {
    creditor: qrCreditor,
    currency: "CHF",
    openAmount: false,
    amount: "1949.75",
    debtor,
    referenceType: "QRR",
    reference: "210000000003139471430009017",
    message: "Auftrag vom 15.10.2020",
    billing: "//S1/10/10201409/11/201015",
    ...overrides,
  };
}

describe("official QR character set", () => {
  it("allows the euro sign, Zürich, and Latin Extended A, and rejects characters outside the set", () => {
    expect(isAllowedQrCharacter(0x20ac)).toBe(true);
    expect(hasPermittedCharacters("Zürich")).toBe(true);
    expect(hasPermittedCharacters("Preis 10 €")).toBe(true);
    expect(hasPermittedCharacters("ą")).toBe(true);
    expect(hasPermittedCharacters("ȘșȚț")).toBe(true);
    expect(hasPermittedCharacters("ƀ")).toBe(false);
    expect(hasPermittedCharacters("١")).toBe(false);
    expect(hasPermittedCharacters("a<b>$")).toBe(true);
    expect(normalizeText("Zeile\nzwei")).toBe("Zeile zwei");
    expect(normalizeText("Pia-Maria’s")).toBe("Pia-Maria’s");
  });
});

describe("single bill and batch use the same rules", () => {
  it("keeps a valid CHF QR-IBAN bill and rejects an all-zero reference", () => {
    const ok = prepareBill(bill());
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data.reference).toBe("210000000003139471430009017");
    const zeros = prepareBill(bill({ reference: "0", message: "", billing: "" }));
    expect(zeros.ok).toBe(false);
    if (!zeros.ok) expect(zeros.errors.some((error) => error.code === "reference_zeros")).toBe(true);
  });

  it("accepts euros only with a normal IBAN and SCOR or no reference", () => {
    const scor = prepareBill(
      bill({
        creditor: regularCreditor,
        currency: "EUR",
        amount: "10.00",
        referenceType: "SCOR",
        reference: "RF18539007547034",
        message: "Honorar 10 €",
        billing: "",
      }),
    );
    expect(scor.ok).toBe(true);
    if (scor.ok) {
      expect(scor.data.currency).toBe("EUR");
      expect(scor.data.reference).toBe("RF18539007547034");
      expect(scor.data.message).toBe("Honorar 10 €");
    }

    const open = prepareBill(
      bill({
        creditor: regularCreditor,
        currency: "EUR",
        openAmount: true,
        amount: "",
        referenceType: "NON",
        reference: "",
        debtor: null,
        message: "Spende",
        billing: "",
      }),
    );
    expect(open.ok).toBe(true);

    const qr = prepareBill(bill({ currency: "EUR", amount: "10.00", message: "", billing: "" }));
    expect(qr.ok).toBe(false);
    if (!qr.ok) {
      expect(qr.errors.some((error) => error.code === "eur_needs_regular_iban")).toBe(true);
      expect(qr.errors.some((error) => error.code === "eur_no_qr_reference")).toBe(true);
    }
  });

  it("names the new errors in every interface language", () => {
    for (const lang of ["DE", "FR", "IT", "EN"] as const) {
      expect(STRINGS[lang]["err.reference_zeros"].length).toBeGreaterThan(10);
      expect(STRINGS[lang]["err.eur_needs_regular_iban"].length).toBeGreaterThan(10);
      expect(STRINGS[lang]["err.eur_no_qr_reference"].length).toBeGreaterThan(10);
      expect(STRINGS[lang]["badge.sps"]).toBe("SPS 2.3");
    }
  });
});
