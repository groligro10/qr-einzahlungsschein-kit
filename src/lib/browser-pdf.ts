import type { PdfConstructor } from "./pdf";

let loading: Promise<PdfConstructor> | undefined;

/**
 * Browser build of PDFKit. The Node entry imports `fs` and cannot run in the page.
 * The standalone bundle inlines the standard fonts (Helvetica) the payment part uses.
 */
export function loadBrowserPdf(): Promise<PdfConstructor> {
  if (!loading) {
    loading = import("pdfkit/js/pdfkit.standalone.js").then((mod) => {
      const ctor = (mod.default ?? mod) as unknown as PdfConstructor;
      if (typeof ctor !== "function") {
        throw new Error("PDF library failed to load");
      }
      return ctor;
    });
  }
  return loading;
}
