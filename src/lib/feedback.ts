import type { FieldError } from "./bill";

/** Field messages appear after that field is left, or after an export attempt. */
export function errorsToShow(
  errors: FieldError[],
  options: { touched: ReadonlySet<string>; exportAttempted: boolean },
): FieldError[] {
  if (options.exportAttempted) return errors;
  return errors.filter((error) => options.touched.has(error.field));
}

/** The summary list is reserved for a failed export, not the first view of an empty form. */
export function showErrorSummary(exportAttempted: boolean, errors: FieldError[]): boolean {
  return exportAttempted && errors.length > 0;
}
