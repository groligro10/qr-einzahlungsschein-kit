import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { mm2pt } from "swissqrbill/utils";
import { describe, expect, it } from "vitest";
import { prepareBill, type BillInput, type CreditorInput } from "../src/lib/bill";
import { renderBills, type HeaderLabels, type RenderItem } from "../src/lib/pdf";
import {
  hasSwissCross,
  measureQrCode,
  mediaBoxes,
  pdfContent,
  pdfPlainText,
  swissCrossCount,
} from "./pdf-inspect";

const labels: HeaderLabels = {
  number: "Rechnungsnummer",
  date: "Datum",
  due: "Zahlbar bis",
  amount: "Betrag",
  open: "Betrag offen",
};

const creditor: CreditorInput = {
  name: "Robert Schneider AG",
  street: "Rue du Lac",
  buildingNumber: "1268",
  zip: "2501",
  city: "Biel",
  country: "CH",
  account: "CH4431999123000889012",
};

const qrBill: BillInput = {
  creditor,
  currency: "CHF",
  openAmount: false,
  amount: "1949.75",
  debtor: {
    name: "Pia-Maria Rutschmann-Schnyder",
    street: "Grosse Marktgasse",
    buildingNumber: "28",
    zip: "9400",
    city: "Rorschach",
    country: "CH",
  },
  referenceType: "QRR",
  reference: "210000000003139471430009017",
  message: "Auftrag vom 15.10.2020",
  billing: "//S1/10/10201409/11/201015",
};

function mustPrepare(input: BillInput) {
  const prepared = prepareBill(input);
  if (!prepared.ok) throw new Error(prepared.errors.map((error) => error.code).join(","));
  return prepared;
}

function item(input: BillInput, kind: "a4" | "slip", withHeader: boolean, logo?: Uint8Array): RenderItem {
  const prepared = mustPrepare(input);
  return {
    data: prepared.data,
    language: "DE",
    kind,
    header:
      kind === "a4" && withHeader
        ? {
            title: "Rechnung",
            invoiceNumber: "10201409",
            invoiceDate: "2020-10-15",
            dueDate: "2020-10-30",
            intro: "Rechnung für den Auftrag vom 15. Oktober 2020.",
            message: prepared.message,
            creditorLines: ["Robert Schneider AG", "Rue du Lac 1268", "2501 Biel"],
            debtorLines: ["Pia-Maria Rutschmann-Schnyder", "Grosse Marktgasse 28", "9400 Rorschach"],
            currency: prepared.currency,
            amount: prepared.amount,
            labels,
            logo,
          }
        : undefined,
  };
}

function expectPaymentPart(pdf: Uint8Array, pages: number, kind: "a4" | "slip") {
  expect(Buffer.from(pdf).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  const boxes = mediaBoxes(pdf);
  expect(boxes).toHaveLength(pages);
  const expectedHeight = kind === "a4" ? mm2pt(297) : mm2pt(105);
  for (const box of boxes) {
    expect(Math.abs(box.width - mm2pt(210))).toBeLessThan(0.05);
    expect(Math.abs(box.height - expectedHeight)).toBeLessThan(0.05);
  }
  const content = pdfContent(pdf);
  const qr = measureQrCode(content);
  expect(qr).not.toBeNull();
  expect(Math.abs((qr?.width ?? 0) - mm2pt(46))).toBeLessThan(0.05);
  expect(Math.abs((qr?.height ?? 0) - mm2pt(46))).toBeLessThan(0.05);
  expect(hasSwissCross(content)).toBe(true);
  expect(swissCrossCount(content)).toBe(pages);
  return content;
}

function writeSample(name: string, bytes: Uint8Array) {
  const targets = [path.resolve("samples", name), "/opt/cursor/artifacts/samples/" + name];
  for (const file of targets) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
}

const TINY_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

describe("sample QR-bill PDFs", () => {
  it("writes a 210 by 105 mm payment part with a 46 mm QR code and a Swiss cross", async () => {
    const pdf = await renderBills(PDFDocument, [item(qrBill, "slip", false)]);
    const content = expectPaymentPart(pdf, 1, "slip");
    const text = pdfPlainText(content);
    expect(text).toContain("Robert Schneider AG");
    expect(text).toContain("CH44 3199 9123 0008 8901 2");
    expect(text).toContain("210000000003139471430009017".replace(/(\d{2})(\d{5})(\d{5})(\d{5})(\d{5})(\d{5})/, "$1 $2 $3 $4 $5 $6") || "21 00000");
    expect(text).toContain("21 00000 00003 13947 14300 09017");
    writeSample("payment-part-qrr.pdf", pdf);
  });

  it("writes an A4 invoice whose page is 210 by 297 mm and keeps the payment part geometry", async () => {
    const pdf = await renderBills(PDFDocument, [item(qrBill, "a4", true, TINY_PNG)]);
    const content = expectPaymentPart(pdf, 1, "a4");
    const text = pdfPlainText(content);
    expect(text).toContain("Rechnung");
    expect(text).toContain("10201409");
    expect(text).toContain("Pia-Maria Rutschmann-Schnyder");
    expect(Buffer.from(pdf).includes(Buffer.from("/Subtype /Image"))).toBe(true);
    const withoutLogo = await renderBills(PDFDocument, [item(qrBill, "a4", true)]);
    expect(Buffer.from(withoutLogo).includes(Buffer.from("/Subtype /Image"))).toBe(false);
    writeSample("invoice-a4-qrr.pdf", pdf);
  });

  it("writes a creditor-reference slip and an open-amount slip", async () => {
    const scor = mustPrepare({
      ...qrBill,
      creditor: { ...creditor, account: "CH5800791123000889012" },
      referenceType: "SCOR",
      reference: "RF18539007547034",
      amount: "199.95",
      message: "Honorarrechnung",
      billing: "",
    });
    const open = mustPrepare({
      ...qrBill,
      creditor: { ...creditor, account: "CH9300762011623852957", name: "Verein Musterbuch" },
      referenceType: "NON",
      reference: "",
      openAmount: true,
      amount: "",
      message: "Spende",
      billing: "",
      debtor: null,
    });
    const scorPdf = await renderBills(PDFDocument, [
      { data: scor.data, language: "DE", kind: "slip" },
    ]);
    const openPdf = await renderBills(PDFDocument, [
      { data: open.data, language: "FR", kind: "slip" },
    ]);
    expect(pdfPlainText(expectPaymentPart(scorPdf, 1, "slip"))).toContain("RF18 5390 0754 7034");
    const openText = pdfPlainText(expectPaymentPart(openPdf, 1, "slip"));
    expect(openText).toContain("Verein Musterbuch");
    expect(openText).toContain("Section paiement");
    writeSample("payment-part-scor.pdf", scorPdf);
    writeSample("payment-part-non-open.pdf", openPdf);
  });

  it("writes a merged A4 file with one payment part per page", async () => {
    const second = mustPrepare({ ...qrBill, amount: "80.00", message: "Mitgliederbeitrag", billing: "" });
    const pdf = await renderBills(PDFDocument, [item(qrBill, "a4", true), { data: second.data, language: "IT", kind: "a4" }]);
    expectPaymentPart(pdf, 2, "a4");
    writeSample("batch-merged-a4.pdf", pdf);
  });
});
