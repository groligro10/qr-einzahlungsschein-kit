import { EXAMPLES, type ExampleBill } from "./examples";
import { describeError, htmlLang, t, type Lang, type MessageKey } from "./i18n";
import type { Currency } from "./lib/amount";
import { prepareBill, type BillInput, type CreditorInput, type FieldError, type PostalAddress } from "./lib/bill";
import { loadBrowserPdf } from "./lib/browser-pdf";
import { errorsToShow, showErrorSummary } from "./lib/feedback";
import { classifyAccount, formatIban, type AccountKind } from "./lib/iban";
import { LICENSES_TEXT } from "./licenses-text";
import { renderBills, type HeaderLabels, type RenderItem } from "./lib/pdf";
import { formatQrReference, formatScorReference, normalizeReference, type ReferenceType } from "./lib/reference";
import { reconcileReferenceType, type SwitchNote } from "./lib/reference-switch";
import { forgetSender, loadSender, saveSender } from "./lib/sender";
import { buildSwico } from "./lib/swico";
import { slugify } from "./lib/text";
import { downloadBytes } from "./ui/download";

const FEEDBACK_FORM_URL = "https://forms.gle/vx1onjngBso7M5UC9";
import { SwissQRBill } from "swissqrbill/svg";

const LANG_KEY = "qek.lang";
const FIELD_INPUT: Record<string, string> = {
  "creditor.name": "creditor-name",
  "creditor.street": "creditor-street",
  "creditor.building": "creditor-building",
  "creditor.zip": "creditor-zip",
  "creditor.city": "creditor-city",
  "creditor.country": "creditor-country",
  "creditor.account": "creditor-account",
  "debtor.name": "debtor-name",
  "debtor.street": "debtor-street",
  "debtor.building": "debtor-building",
  "debtor.zip": "debtor-zip",
  "debtor.city": "debtor-city",
  "debtor.country": "debtor-country",
  amount: "amount",
  currency: "currency",
  reference: "reference",
  message: "message",
  billing: "billing",
};

let lang = readLang();
let billTouched = false;
let previewTimer = 0;
let exportAttempted = false;
let lastAccountKind: AccountKind | null = null;
let lastReferenceCurrency: string | null = null;
let referenceNote: SwitchNote | null = null;
let undoTimer = 0;
const touched = new Set<string>();
const INPUT_FIELD = Object.fromEntries(Object.entries(FIELD_INPUT).map(([field, id]) => [id, field]));

init();

function init() {
  const date = byId<HTMLInputElement>("invoice-date");
  if (!date.value) date.value = today();
  byId("bill-form").addEventListener("submit", (event) => event.preventDefault());
  byId("bill-form").addEventListener("input", schedule);
  byId("bill-form").addEventListener("change", schedule);
  byId("bill-language").addEventListener("change", () => {
    billTouched = true;
  });
  document.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => applyLanguage(button.dataset.lang as Lang));
  });
  byId("debtor-enabled").addEventListener("change", toggleSections);
  byId("header-enabled").addEventListener("change", toggleSections);
  byId("open-amount").addEventListener("change", toggleSections);
  byId("reference-complete").addEventListener("click", completeReference);
  byId("billing-fill").addEventListener("click", fillSwico);
  byId("try-example").addEventListener("click", () => fillExample("qrr"));
  byId("example-qrr").addEventListener("click", () => fillExample("qrr"));
  byId("example-scor").addEventListener("click", () => fillExample("scor"));
  byId("example-open").addEventListener("click", () => fillExample("open"));
  byId("clear-form").addEventListener("click", clearForm);
  byId("toast-undo").addEventListener("click", undoClear);
  byId("bill-form").addEventListener("focusout", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const field = INPUT_FIELD[target.id];
    if (field) touched.add(field);
    if (target.id === "creditor-account" && target instanceof HTMLInputElement && target.value.trim()) {
      target.value = formatIban(target.value);
    }
    refreshSingle();
  });
  byId("bill-form").addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.id === "open-amount") touched.add("amount");
    if (target.name === "reference-type") touched.add("reference");
    if (target.id === "remember-sender") {
      if (target.checked) persistSender();
      else forgetSender();
    }
  });
  byId("open-licenses").addEventListener("click", () => {
    byId<HTMLDialogElement>("licenses-dialog").showModal();
  });
  byId("licenses-close").addEventListener("click", () => {
    byId<HTMLDialogElement>("licenses-dialog").close();
  });
  byId<HTMLElement>("licenses-body").textContent = LICENSES_TEXT;
  restoreSender();
  byId("download-a4").addEventListener("click", () => void download("a4"));
  byId("download-slip").addEventListener("click", () => void download("slip"));
  window.addEventListener("resize", fitPreview);
  applyLanguage(lang);
  toggleSections();
  refreshSingle();
}

function applyLanguage(next: Lang) {
  lang = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    /* storage may be blocked */
  }
  document.documentElement.lang = htmlLang(next);
  document.title = t(next, "meta.title");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t(next, "meta.description"));
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n as MessageKey;
    node.textContent = t(next, key);
  });
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(next, node.dataset.i18nPlaceholder as MessageKey);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((node) => {
    node.setAttribute("aria-label", t(next, node.dataset.i18nAria as MessageKey));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((button) => {
    const code = button.dataset.lang as Lang;
    button.setAttribute("aria-pressed", code === next ? "true" : "false");
    button.setAttribute("aria-label", t(next, `lang.${code}`));
  });
  if (!billTouched) byId<HTMLSelectElement>("bill-language").value = next;
  byId<HTMLAnchorElement>("feedback-link").href = FEEDBACK_FORM_URL;
  refreshSingle();
}

function schedule() {
  window.clearTimeout(previewTimer);
  previewTimer = window.setTimeout(refreshSingle, 80);
}

function refreshSingle() {
  maybeSwitchReference();
  toggleSections();
  const input = readBill();
  if (byId<HTMLInputElement>("remember-sender").checked) persistSender();
  const prepared = prepareBill(input);
  const reference = normalizeReference(input.referenceType, input.reference);
  const hint = byId("reference-hint");
  hint.textContent =
    reference.ok && reference.value
      ? t(lang, "ref.normalized", {
          value: input.referenceType === "SCOR" ? formatScorReference(reference.value) : formatQrReference(reference.value),
        })
      : "";
  const message = byId<HTMLTextAreaElement>("message").value.length;
  const billing = byId<HTMLTextAreaElement>("billing").value.length;
  byId("extra-count").textContent = `${message + billing} / 140`;
  showIssues(prepared.ok ? [] : prepared.errors);
  renderReferenceNote();
  const status = byId("status");
  const previewStatus = byId("preview-status");
  const preview = byId("preview");
  if (!prepared.ok) {
    status.textContent = "";
    status.classList.remove("good");
    previewStatus.textContent = t(lang, "preview.sampleHint");
    showSamplePreview();
    return;
  }
  status.textContent = t(lang, "status.ready");
  status.classList.add("good");
  previewStatus.textContent = t(lang, "preview.ready");
  try {
    const svg = new SwissQRBill(prepared.data, { language: billLanguage() });
    preview.replaceChildren(svg.element);
    preview.classList.add("has-bill");
    preview.classList.remove("is-sample");
    preview.removeAttribute("aria-hidden");
    fitPreview();
  } catch (error) {
    preview.replaceChildren();
    preview.classList.remove("has-bill", "is-sample");
    fitPreview();
    previewStatus.textContent = error instanceof Error ? error.message : t(lang, "status.failed");
  }
}

async function download(kind: "a4" | "slip") {
  exportAttempted = true;
  const prepared = prepareBill(readBill());
  showIssues(prepared.ok ? [] : prepared.errors);
  if (!prepared.ok) {
    byId("issues").focus();
    return;
  }
  const button = byId<HTMLButtonElement>(kind === "a4" ? "download-a4" : "download-slip");
  button.disabled = true;
  try {
    const bytes = await renderBills(await loadBrowserPdf(), [toRenderItem(prepared, kind)]);
    const who = prepared.data.debtor?.name || prepared.data.creditor.name;
    const prefix = kind === "a4" ? "qr-rechnung" : "qr-zahlteil";
    downloadBytes(`${prefix}-${slugify(who)}.pdf`, bytes, "application/pdf");
    byId("status").textContent = t(lang, "status.downloaded");
  } catch {
    byId("status").textContent = t(lang, "status.failed");
    byId("status").classList.remove("good");
  } finally {
    button.disabled = false;
  }
}

function toRenderItem(prepared: Extract<ReturnType<typeof prepareBill>, { ok: true }>, kind: "a4" | "slip"): RenderItem {
  const debtor = prepared.data.debtor;
  const billLang = billLanguage();
  const creditor = readCreditor();
  const headerEnabled = byId<HTMLInputElement>("header-enabled").checked;
  return {
    data: prepared.data,
    language: billLang,
    kind,
    header:
      kind === "a4" && headerEnabled
        ? {
            title: byId<HTMLInputElement>("invoice-title").value.trim() || t(billLang, "doc.title"),
            invoiceNumber: byId<HTMLInputElement>("invoice-number").value.trim() || undefined,
            invoiceDate: byId<HTMLInputElement>("invoice-date").value || undefined,
            dueDate: byId<HTMLInputElement>("due-date").value || undefined,
            intro: byId<HTMLTextAreaElement>("intro").value.trim() || undefined,
            message: prepared.message || undefined,
            creditorLines: [
              creditor.name,
              [creditor.street, creditor.buildingNumber].filter(Boolean).join(" "),
              `${creditor.zip} ${creditor.city}`.trim(),
            ].filter((line) => line.trim()),
            debtorLines: debtor
              ? [debtor.name, [debtor.address, debtor.buildingNumber].filter(Boolean).join(" "), `${debtor.zip} ${debtor.city}`]
              : undefined,
            currency: prepared.currency,
            amount: prepared.amount,
            labels: {
              number: t(billLang, "pdf.number"),
              date: t(billLang, "pdf.date"),
              due: t(billLang, "pdf.due"),
              amount: t(billLang, "pdf.amount"),
              open: t(billLang, "pdf.open"),
            } satisfies HeaderLabels,
          }
        : undefined,
  };
}

function fitPreview() {
  const frame = byId("preview-frame");
  const sheet = byId("preview");
  if (!sheet.classList.contains("has-bill")) {
    sheet.style.transform = "none";
    sheet.style.width = "100%";
    frame.style.height = "auto";
    return;
  }
  sheet.style.width = "210mm";
  sheet.style.transform = "none";
  const natural = sheet.offsetWidth || 1;
  const scale = Math.min(1, frame.clientWidth / natural);
  sheet.style.transformOrigin = "top left";
  sheet.style.transform = `scale(${scale})`;
  frame.style.height = `${sheet.offsetHeight * scale}px`;
}

function showIssues(errors: FieldError[]) {
  document.querySelectorAll<HTMLElement>(".field-error").forEach((node) => {
    node.hidden = true;
    node.textContent = "";
  });
  document.querySelectorAll<HTMLElement>("[aria-invalid]").forEach((node) => {
    node.removeAttribute("aria-invalid");
    if (node.getAttribute("aria-describedby")?.startsWith("error-")) node.removeAttribute("aria-describedby");
  });
  const visible = errorsToShow(errors, { touched, exportAttempted });
  for (const error of visible) {
    const id = FIELD_INPUT[error.field];
    const control = id ? document.getElementById(id) : null;
    if (!control) continue;
    const slot = errorSlot(control);
    slot.hidden = false;
    slot.textContent = `${t(lang, "err.prefix")} ${describeError(lang, error)}`;
    control.setAttribute("aria-invalid", "true");
    control.setAttribute("aria-describedby", slot.id);
  }
  const list = byId("issues");
  list.replaceChildren();
  if (!showErrorSummary(exportAttempted, errors)) return;
  const seen = new Set<string>();
  for (const error of errors) {
    const line = `${t(lang, "err.prefix")} ${describeError(lang, error)}`;
    if (seen.has(line)) continue;
    seen.add(line);
    const item = document.createElement("li");
    item.textContent = line;
    list.append(item);
  }
}

function errorSlot(control: HTMLElement): HTMLElement {
  const id = `error-${control.id}`;
  const existing = document.getElementById(id);
  if (existing) return existing;
  const slot = document.createElement("p");
  slot.id = id;
  slot.className = "field-error";
  slot.hidden = true;
  const label = control.closest("label");
  (label ?? control).insertAdjacentElement("afterend", slot);
  return slot;
}

function fillExample(id: ExampleBill["id"]) {
  const example = EXAMPLES.find((item) => item.id === id);
  if (!example) return;
  writeAddress("creditor", example.creditor);
  byId<HTMLInputElement>("creditor-account").value = example.creditor.account;
  byId<HTMLSelectElement>("currency").value = example.currency;
  byId<HTMLInputElement>("open-amount").checked = example.openAmount;
  byId<HTMLInputElement>("amount").value = example.amount;
  byId<HTMLInputElement>("debtor-enabled").checked = example.debtorEnabled;
  writeAddress("debtor", example.debtor);
  setReferenceType(example.referenceType);
  byId<HTMLInputElement>("reference").value = example.reference;
  byId<HTMLTextAreaElement>("message").value = example.message;
  byId<HTMLTextAreaElement>("billing").value = example.billing;
  byId<HTMLInputElement>("header-enabled").checked = example.header;
  byId<HTMLInputElement>("invoice-title").value = example.invoiceTitle;
  byId<HTMLInputElement>("invoice-number").value = example.invoiceNumber;
  byId<HTMLInputElement>("invoice-date").value = example.invoiceDate;
  byId<HTMLInputElement>("due-date").value = example.dueDate;
  byId<HTMLTextAreaElement>("intro").value = example.intro;
  byId<HTMLSelectElement>("bill-language").value = example.billLanguage;
  billTouched = true;
  exportAttempted = false;
  touched.clear();
  refreshSingle();
}

function maybeSwitchReference() {
  const kind = classifyAccount(byId<HTMLInputElement>("creditor-account").value).kind;
  const money = currency();
  if (kind === lastAccountKind && money === lastReferenceCurrency) return;
  lastAccountKind = kind;
  lastReferenceCurrency = money;
  if (kind === "invalid") {
    referenceNote = null;
    return;
  }
  const decision = reconcileReferenceType(kind, referenceType(), byId<HTMLInputElement>("reference").value, money);
  referenceNote = decision.note;
  if (decision.type !== referenceType()) setReferenceType(decision.type);
}

function renderReferenceNote() {
  const note = byId("reference-note");
  if (!referenceNote) {
    note.hidden = true;
    note.textContent = "";
    byId("reference-choices").removeAttribute("aria-describedby");
    return;
  }
  note.hidden = false;
  note.textContent = t(lang, `note.${referenceNote}` as MessageKey);
  byId("reference-choices").setAttribute("aria-describedby", "reference-note");
}

function showSamplePreview() {
  const example = EXAMPLES.find((item) => item.id === "qrr");
  const preview = byId("preview");
  if (!example) return;
  if (
    preview.classList.contains("is-sample") &&
    preview.dataset.sampleLang === billLanguage() &&
    preview.dataset.markLang === lang
  ) {
    fitPreview();
    return;
  }
  const prepared = prepareBill({
    creditor: example.creditor,
    currency: example.currency,
    openAmount: example.openAmount,
    amount: example.amount,
    debtor: example.debtor,
    referenceType: example.referenceType,
    reference: example.reference,
    message: example.message,
    billing: example.billing,
  });
  if (!prepared.ok) return;
  const svg = new SwissQRBill(prepared.data, { language: billLanguage() }).element;
  const mark = document.createElement("p");
  mark.className = "watermark";
  mark.textContent = t(lang, "preview.watermark");
  preview.replaceChildren(svg, mark);
  preview.dataset.sampleLang = billLanguage();
  preview.dataset.markLang = lang;
  preview.classList.add("has-bill", "is-sample");
  preview.setAttribute("aria-hidden", "true");
  fitPreview();
}

function snapshotForm(): Map<string, string> {
  const values = new Map<string, string>();
  for (const id of Object.values(FIELD_INPUT)) values.set(id, byId<HTMLInputElement>(id).value);
  for (const id of ["invoice-title", "invoice-number", "invoice-date", "due-date", "intro"]) {
    values.set(id, byId<HTMLInputElement>(id).value);
  }
  values.set("currency", byId<HTMLSelectElement>("currency").value);
  values.set("bill-language", byId<HTMLSelectElement>("bill-language").value);
  values.set("reference-type", referenceType());
  values.set("open-amount", String(byId<HTMLInputElement>("open-amount").checked));
  values.set("debtor-enabled", String(byId<HTMLInputElement>("debtor-enabled").checked));
  values.set("header-enabled", String(byId<HTMLInputElement>("header-enabled").checked));
  values.set("remember-sender", String(byId<HTMLInputElement>("remember-sender").checked));
  return values;
}

let undoValues: Map<string, string> | null = null;

function restoreSnapshot(values: Map<string, string>) {
  for (const [id, value] of values) {
    if (id === "reference-type") {
      setReferenceType(value === "SCOR" || value === "NON" ? value : "QRR");
      continue;
    }
    if (id === "open-amount" || id === "debtor-enabled" || id === "header-enabled" || id === "remember-sender") {
      byId<HTMLInputElement>(id).checked = value === "true";
      continue;
    }
    const node = document.getElementById(id);
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) {
      node.value = value;
    }
  }
  lastAccountKind = classifyAccount(byId<HTMLInputElement>("creditor-account").value).kind;
  refreshSingle();
}

function clearForm() {
  undoValues = snapshotForm();
  for (const id of [
    "creditor-name",
    "creditor-street",
    "creditor-building",
    "creditor-zip",
    "creditor-city",
    "debtor-name",
    "debtor-street",
    "debtor-building",
    "debtor-zip",
    "debtor-city",
    "amount",
    "reference",
    "message",
    "billing",
    "invoice-title",
    "invoice-number",
    "due-date",
    "intro",
  ]) {
    byId<HTMLInputElement>(id).value = "";
  }
  byId<HTMLInputElement>("creditor-country").value = "CH";
  byId<HTMLInputElement>("debtor-country").value = "CH";
  byId<HTMLSelectElement>("currency").value = "CHF";
  byId<HTMLInputElement>("open-amount").checked = false;
  byId<HTMLInputElement>("debtor-enabled").checked = false;
  byId<HTMLInputElement>("header-enabled").checked = false;
  byId<HTMLInputElement>("invoice-date").value = today();
  setReferenceType("QRR");
  billTouched = false;
  byId<HTMLSelectElement>("bill-language").value = lang;
  exportAttempted = false;
  touched.clear();
  referenceNote = null;
  lastAccountKind = "invalid";
  showToast();
  refreshSingle();
}

function showToast() {
  const toast = byId("toast");
  toast.hidden = false;
  window.clearTimeout(undoTimer);
  undoTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 8000);
}

function undoClear() {
  if (!undoValues) return;
  window.clearTimeout(undoTimer);
  byId("toast").hidden = true;
  const values = undoValues;
  undoValues = null;
  restoreSnapshot(values);
}

function persistSender() {
  const creditor = readCreditor();
  if (!creditor.name.trim() && !creditor.account.trim()) return;
  try {
    saveSender({ creditor, currency: currency() });
  } catch {
    /* storage may be blocked */
  }
}

function restoreSender() {
  const saved = loadSender();
  if (!saved) return;
  writeAddress("creditor", saved.creditor);
  byId<HTMLInputElement>("creditor-account").value = saved.creditor.account;
  byId<HTMLSelectElement>("currency").value = saved.currency;
  byId<HTMLInputElement>("remember-sender").checked = true;
  lastAccountKind = classifyAccount(saved.creditor.account).kind;
}

function completeReference() {
  const type = referenceType();
  const normalized = normalizeReference(type, byId<HTMLInputElement>("reference").value);
  if (!normalized.ok || !normalized.value) {
    refreshSingle();
    return;
  }
  byId<HTMLInputElement>("reference").value =
    type === "SCOR" ? formatScorReference(normalized.value) : formatQrReference(normalized.value);
  refreshSingle();
}

function fillSwico() {
  const prepared = prepareBill(readBill());
  const line = buildSwico({
    invoiceNumber: byId<HTMLInputElement>("invoice-number").value,
    invoiceDate: byId<HTMLInputElement>("invoice-date").value,
    amount: prepared.ok ? prepared.amount : undefined,
  });
  if (line === "//S1") return;
  byId<HTMLTextAreaElement>("billing").value = line;
  refreshSingle();
}

function toggleSections() {
  byId("debtor-fields").hidden = !byId<HTMLInputElement>("debtor-enabled").checked;
  byId("header-fields").hidden = !byId<HTMLInputElement>("header-enabled").checked;
  const open = byId<HTMLInputElement>("open-amount").checked;
  byId<HTMLInputElement>("amount").disabled = open;
  const type = referenceType();
  const hideReference = type === "NON";
  byId<HTMLInputElement>("reference").disabled = hideReference;
  byId("reference-complete").hidden = hideReference;
  const helpKey = `ref.help.${type.toLowerCase()}` as MessageKey;
  byId("reference-help").textContent = t(lang, helpKey);
}

function readBill(): BillInput {
  return {
    creditor: readCreditor(),
    currency: currency(),
    openAmount: byId<HTMLInputElement>("open-amount").checked,
    amount: byId<HTMLInputElement>("amount").value,
    debtor: byId<HTMLInputElement>("debtor-enabled").checked ? readPerson("debtor") : null,
    referenceType: referenceType(),
    reference: byId<HTMLInputElement>("reference").value,
    message: byId<HTMLTextAreaElement>("message").value,
    billing: byId<HTMLTextAreaElement>("billing").value,
  };
}

function readCreditor(): CreditorInput {
  return { ...readPerson("creditor"), account: byId<HTMLInputElement>("creditor-account").value };
}

function readPerson(prefix: "creditor" | "debtor"): PostalAddress {
  return {
    name: byId<HTMLInputElement>(`${prefix}-name`).value,
    street: byId<HTMLInputElement>(`${prefix}-street`).value,
    buildingNumber: byId<HTMLInputElement>(`${prefix}-building`).value,
    zip: byId<HTMLInputElement>(`${prefix}-zip`).value,
    city: byId<HTMLInputElement>(`${prefix}-city`).value,
    country: byId<HTMLInputElement>(`${prefix}-country`).value,
  };
}

function writeAddress(prefix: "creditor" | "debtor", address: PostalAddress) {
  byId<HTMLInputElement>(`${prefix}-name`).value = address.name;
  byId<HTMLInputElement>(`${prefix}-street`).value = address.street;
  byId<HTMLInputElement>(`${prefix}-building`).value = address.buildingNumber;
  byId<HTMLInputElement>(`${prefix}-zip`).value = address.zip;
  byId<HTMLInputElement>(`${prefix}-city`).value = address.city;
  byId<HTMLInputElement>(`${prefix}-country`).value = address.country;
}

function referenceType(): ReferenceType {
  const selected = document.querySelector<HTMLInputElement>('input[name="reference-type"]:checked');
  if (selected?.value === "SCOR" || selected?.value === "NON") return selected.value;
  return "QRR";
}

function setReferenceType(type: ReferenceType) {
  const input = document.querySelector<HTMLInputElement>(`input[name="reference-type"][value="${type}"]`);
  if (input) input.checked = true;
}

function currency(): Currency {
  return byId<HTMLSelectElement>("currency").value === "EUR" ? "EUR" : "CHF";
}

function billLanguage(): Lang {
  const value = byId<HTMLSelectElement>("bill-language").value;
  if (value === "FR" || value === "IT" || value === "EN") return value;
  return "DE";
}

function readLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "FR" || stored === "IT" || stored === "EN" || stored === "DE") return stored;
  } catch {
    /* ignore */
  }
  return "DE";
}

function today(): string {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}
