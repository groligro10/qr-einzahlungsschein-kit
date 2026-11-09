/**
 * Minimal Swico S1 billing-information string built from invoice fields.
 * The result is placed in the QR-bill billing information, not in the unstructured message.
 */
export function buildSwico(input: {
  invoiceNumber?: string;
  invoiceDate?: string;
  amount?: number;
}): string {
  let result = "//S1";
  const invoiceNumber = input.invoiceNumber?.trim();
  if (invoiceNumber) result += `/10/${invoiceNumber.replace(/\//g, "")}`;
  if (input.invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(input.invoiceDate)) {
    const [year, month, day] = input.invoiceDate.split("-");
    result += `/11/${year.slice(2)}${month}${day}`;
  }
  if (input.amount !== undefined) result += `/20/${input.amount.toFixed(2)}`;
  return result;
}
