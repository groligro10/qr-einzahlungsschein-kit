import type { Currency } from "./amount";
import type { CreditorInput } from "./bill";

const STORAGE_KEY = "qek.sender.v1";

export interface RememberedSender {
  creditor: CreditorInput;
  currency: Currency;
}

function isSender(value: unknown): value is RememberedSender {
  if (!value || typeof value !== "object") return false;
  const sender = value as RememberedSender;
  return (
    !!sender.creditor &&
    typeof sender.creditor.name === "string" &&
    typeof sender.creditor.account === "string" &&
    typeof sender.creditor.street === "string" &&
    (sender.currency === "CHF" || sender.currency === "EUR")
  );
}

export function loadSender(): RememberedSender | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSender(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSender(sender: RememberedSender): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sender));
}

export function forgetSender(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
