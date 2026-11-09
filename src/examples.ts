import type { Lang } from "./i18n";
import type { Currency } from "./lib/amount";
import type { CreditorInput, PostalAddress } from "./lib/bill";
import type { ReferenceType } from "./lib/reference";

export interface ExampleBill {
  id: "qrr" | "scor" | "open";
  creditor: CreditorInput;
  currency: Currency;
  openAmount: boolean;
  amount: string;
  debtorEnabled: boolean;
  debtor: PostalAddress;
  referenceType: ReferenceType;
  reference: string;
  message: string;
  billing: string;
  header: boolean;
  invoiceTitle: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  intro: string;
  billLanguage: Lang;
}

const emptyDebtor: PostalAddress = {
  name: "",
  street: "",
  buildingNumber: "",
  zip: "",
  city: "",
  country: "CH",
};

export const EXAMPLES: ExampleBill[] = [
  {
    id: "qrr",
    creditor: {
      name: "Robert Schneider AG",
      street: "Rue du Lac",
      buildingNumber: "1268",
      zip: "2501",
      city: "Biel",
      country: "CH",
      account: "CH44 3199 9123 0008 8901 2",
    },
    currency: "CHF",
    openAmount: false,
    amount: "1949.75",
    debtorEnabled: true,
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
    header: true,
    invoiceTitle: "Rechnung",
    invoiceNumber: "10201409",
    invoiceDate: "2020-10-15",
    dueDate: "2020-10-30",
    intro: "Rechnung für den Auftrag vom 15. Oktober 2020.",
    billLanguage: "DE",
  },
  {
    id: "scor",
    creditor: {
      name: "Robert Schneider AG",
      street: "Rue du Lac",
      buildingNumber: "1268",
      zip: "2501",
      city: "Biel",
      country: "CH",
      account: "CH58 0079 1123 0008 8901 2",
    },
    currency: "CHF",
    openAmount: false,
    amount: "199.95",
    debtorEnabled: true,
    debtor: {
      name: "Pia-Maria Rutschmann-Schnyder",
      street: "Grosse Marktgasse",
      buildingNumber: "28",
      zip: "9400",
      city: "Rorschach",
      country: "CH",
    },
    referenceType: "SCOR",
    reference: "RF18 5390 0754 7034",
    message: "Honorarrechnung",
    billing: "",
    header: true,
    invoiceTitle: "Rechnung",
    invoiceNumber: "2026-118",
    invoiceDate: "2026-03-01",
    dueDate: "2026-03-31",
    intro: "Honorar gemäss Vereinbarung.",
    billLanguage: "DE",
  },
  {
    id: "open",
    creditor: {
      name: "Verein Musterbuch",
      street: "Musterstrasse",
      buildingNumber: "7",
      zip: "8000",
      city: "Zürich",
      country: "CH",
      account: "CH93 0076 2011 6238 5295 7",
    },
    currency: "CHF",
    openAmount: true,
    amount: "",
    debtorEnabled: false,
    debtor: emptyDebtor,
    referenceType: "NON",
    reference: "",
    message: "Spende",
    billing: "",
    header: false,
    invoiceTitle: "",
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    intro: "",
    billLanguage: "DE",
  },
];
