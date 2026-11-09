export type Currency = "CHF" | "EUR";

export function parseAmount(raw: string): { ok: true; amount: number } | { ok: false } {
  let value = raw.trim().replace(/[\s'\u2019\u00A0]/g, "");
  if (!value) return { ok: false };
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value)) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(value)) {
    value = value.replace(/,/g, "");
  } else if (value.includes(",") && value.includes(".")) {
    return { ok: false };
  } else if (value.includes(",")) {
    if (!/^\d+,\d{1,2}$/.test(value)) return { ok: false };
    value = value.replace(",", ".");
  } else if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return { ok: false };
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false };
  const fixed = amount.toFixed(2);
  if (fixed.length > 12) return { ok: false };
  return { ok: true, amount: Number(fixed) };
}

export function formatAmount(amount: number): string {
  const [whole, fraction] = amount.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped}.${fraction}`;
}

export function formatMoney(amount: number, currency: Currency): string {
  return `${currency} ${formatAmount(amount)}`;
}

export function parseCurrency(raw: string | undefined, fallback: Currency): Currency | undefined {
  if (!raw || !raw.trim()) return fallback;
  const value = raw.trim().toUpperCase().replace(/\./g, "");
  if (value === "CHF" || value === "FR" || value === "SFR" || value === "FRANKEN") return "CHF";
  if (value === "EUR" || value === "EURO") return "EUR";
  return undefined;
}
