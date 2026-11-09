import { inflateSync } from "node:zlib";
import { mm2pt } from "swissqrbill/utils";

export interface MediaBox {
  width: number;
  height: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function streamBodies(pdf: Uint8Array): string[] {
  const buffer = Buffer.from(pdf);
  const latin = buffer.toString("latin1");
  const texts: string[] = [];
  let from = 0;
  while (from < latin.length) {
    const marker = latin.indexOf("stream", from);
    if (marker < 0) break;
    const prefix = latin.slice(Math.max(0, marker - 1), marker);
    if (prefix !== "\n" && prefix !== "\r") {
      from = marker + 6;
      continue;
    }
    const dictEnd = latin.lastIndexOf(">>", marker);
    const dictStart = dictEnd >= 0 ? latin.lastIndexOf("<<", dictEnd) : -1;
    const dict = dictStart >= 0 ? latin.slice(dictStart, dictEnd + 2) : "";
    const lengthMatch = dict.match(/\/Length\s+(\d+)/);
    if (!lengthMatch) {
      from = marker + 6;
      continue;
    }
    let dataStart = marker + "stream".length;
    if (latin[dataStart] === "\r") dataStart += 1;
    if (latin[dataStart] === "\n") dataStart += 1;
    const body = buffer.subarray(dataStart, dataStart + Number(lengthMatch[1]));
    if (dict.includes("/FlateDecode")) {
      texts.push(inflateSync(body).toString("latin1"));
    } else {
      texts.push(body.toString("latin1"));
    }
    from = dataStart + body.length;
  }
  return texts;
}

export function pdfContent(pdf: Uint8Array): string {
  return streamBodies(pdf).join("\n");
}

export function mediaBoxes(pdf: Uint8Array): MediaBox[] {
  const latin = Buffer.from(pdf).toString("latin1");
  return [...latin.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]/g)].map((match) => ({
    width: Number(match[1]),
    height: Number(match[2]),
  }));
}

function rectsOf(content: string): Rect[] {
  return [...content.matchAll(/([0-9.]+) ([0-9.]+) ([0-9.]+) ([0-9.]+) re\b/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
    w: Number(match[3]),
    h: Number(match[4]),
  }));
}

/** Bounding box of the QR modules. They are the only repeated small squares. */
export function measureQrCode(content: string): { width: number; height: number } | null {
  const rects = rectsOf(content);
  const counts = new Map<string, { size: number; n: number }>();
  for (const rect of rects) {
    if (Math.abs(rect.w - rect.h) > 0.02 || rect.w < 0.4 || rect.w > 4) continue;
    const key = rect.w.toFixed(3);
    const current = counts.get(key) ?? { size: rect.w, n: 0 };
    current.n += 1;
    counts.set(key, current);
  }
  const moduleSize = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  if (!moduleSize || moduleSize.n < 100) return null;
  const modules = rects.filter(
    (rect) => Math.abs(rect.w - moduleSize.size) < 0.02 && Math.abs(rect.h - moduleSize.size) < 0.02,
  );
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of modules) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }
  return { width: maxX - minX, height: maxY - minY };
}

function close(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) < 0.05;
}

/**
 * The Swiss cross is a 7 mm white square, a 6 mm black square,
 * and two white bars of 3.89 mm by 1.17 mm.
 */
export function hasSwissCross(content: string): boolean {
  const rects = rectsOf(content);
  const has = (width: number, height: number) =>
    rects.some((rect) => close(rect.w, width) && close(rect.h, height));
  return (
    has(mm2pt(7), mm2pt(7)) &&
    has(mm2pt(6), mm2pt(6)) &&
    has(mm2pt(3.89), mm2pt(1.17)) &&
    has(mm2pt(1.17), mm2pt(3.89))
  );
}

export function swissCrossCount(content: string): number {
  return rectsOf(content).filter((rect) => close(rect.w, mm2pt(7)) && close(rect.h, mm2pt(7))).length;
}

export function pdfPlainText(content: string): string {
  const pieces: string[] = [];
  for (const match of content.matchAll(/\((?:\\.|[^\\)])*\)/g)) {
    pieces.push(match[0].slice(1, -1).replace(/\\([()\\])/g, "$1"));
  }
  for (const match of content.matchAll(/<([0-9A-Fa-f]{2,})>/g)) {
    if (match[1].length % 2 === 0) pieces.push(Buffer.from(match[1], "hex").toString("latin1"));
  }
  return pieces.join("");
}
