import { SwissQRBill } from "swissqrbill/pdf";
import type { Data, Language } from "swissqrbill/types";
import { mm2pt } from "swissqrbill/utils";
import { formatMoney, type Currency } from "./amount";

export type PdfConstructor = new (options?: PDFKit.PDFDocumentOptions) => PDFKit.PDFDocument;

export type BillKind = "a4" | "slip";

export interface HeaderLabels {
  number: string;
  date: string;
  due: string;
  amount: string;
  open: string;
}

export interface InvoiceHeader {
  title: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  intro?: string;
  message?: string;
  creditorLines: string[];
  debtorLines?: string[];
  currency: Currency;
  amount?: number;
  labels: HeaderLabels;
  logo?: Uint8Array;
}

export interface RenderItem {
  data: Data;
  language: Language;
  kind: BillKind;
  header?: InvoiceHeader;
}

const mm = mm2pt;

function pageSize(kind: BillKind): [number, number] {
  return kind === "a4" ? [mm(210), mm(297)] : [mm(210), mm(105)];
}

function collect(doc: PDFKit.PDFDocument): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => {
      chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
    });
    doc.on("end", () => {
      const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const out = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(out);
    });
    doc.on("error", reject);
  });
}

function drawHeader(doc: PDFKit.PDFDocument, header: InvoiceHeader): void {
  const left = mm(18);
  const top = mm(15);
  doc.fillColor("#1c1915");
  if (header.logo && header.logo.length > 0) {
    const copy = header.logo.buffer.slice(
      header.logo.byteOffset,
      header.logo.byteOffset + header.logo.byteLength,
    ) as ArrayBuffer;
    doc.image(copy, left, top, { fit: [mm(34), mm(16)] });
  }
  const titleX = header.logo && header.logo.length > 0 ? left + mm(40) : left;
  doc.font("Helvetica-Bold").fontSize(18).text(header.title, titleX, top + mm(1), {
    width: mm(80),
    lineBreak: false,
  });
  doc.font("Helvetica").fontSize(9).fillColor("#3f3a33").text(header.creditorLines.join("\n"), mm(120), top, {
    width: mm(72),
    align: "right",
  });

  let y = mm(40);
  if (header.debtorLines && header.debtorLines.length > 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#1c1915").text(header.debtorLines.join("\n"), left, y, {
      width: mm(90),
    });
    y = Math.max(y + mm(24), doc.y + mm(6));
  }

  const rows: Array<[string, string]> = [];
  if (header.invoiceNumber) rows.push([header.labels.number, header.invoiceNumber]);
  if (header.invoiceDate) rows.push([header.labels.date, header.invoiceDate]);
  if (header.dueDate) rows.push([header.labels.due, header.dueDate]);
  doc.fontSize(9).fillColor("#1c1915");
  for (const [label, value] of rows) {
    doc.font("Helvetica").text(label, left, y, { width: mm(42), lineBreak: false });
    doc.font("Helvetica-Bold").text(value, left + mm(44), y, { width: mm(60), lineBreak: false });
    y += mm(5.2);
  }

  y += mm(3);
  doc.moveTo(left, y).lineTo(mm(192), y).lineWidth(0.6).strokeColor("#e3dcd0").stroke();
  y += mm(4);
  const amountText = header.amount === undefined ? header.labels.open : formatMoney(header.amount, header.currency);
  doc.font("Helvetica").fontSize(10).fillColor("#5c564c").text(header.labels.amount, left, y, {
    width: mm(40),
    lineBreak: false,
  });
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#1c1915").text(amountText, left + mm(44), y - mm(0.4), {
    width: mm(80),
    lineBreak: false,
  });
  y += mm(10);
  const note = header.intro || header.message;
  if (note) {
    doc.font("Helvetica").fontSize(10).fillColor("#1c1915").text(note, left, y, {
      width: mm(174),
      height: mm(28),
      ellipsis: true,
    });
  }
  doc.x = 0;
  doc.y = 0;
}

function paint(doc: PDFKit.PDFDocument, item: RenderItem): void {
  if (item.kind === "a4" && item.header) drawHeader(doc, item.header);
  doc.x = 0;
  doc.y = 0;
  const bill = new SwissQRBill(item.data, { language: item.language });
  bill.attachTo(doc);
}

export async function renderBills(createDocument: PdfConstructor, items: RenderItem[]): Promise<Uint8Array> {
  if (items.length === 0) throw new Error("Nothing to render");
  const doc = new createDocument({
    size: pageSize(items[0].kind),
    margin: 0,
    autoFirstPage: false,
    info: {
      Title: "QR-Zahlteil",
      Creator: "QR Einzahlungsschein Kit",
      Producer: "QR Einzahlungsschein Kit",
    },
  });
  const pending = collect(doc);
  items.forEach((item, index) => {
    doc.addPage({ size: pageSize(item.kind), margin: 0 });
    if (index === 0) {
      doc.info.Title = item.header?.title || "QR-Zahlteil";
    }
    paint(doc, item);
  });
  doc.end();
  return pending;
}
