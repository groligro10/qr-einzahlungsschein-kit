declare module "pdfkit/js/pdfkit.standalone.js" {
  import PDFDocument from "pdfkit";
  const ctor: typeof PDFDocument;
  export default ctor;
}
