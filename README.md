# QR Einzahlungsschein Kit

A free, client-side generator for one Swiss QR-bill. It runs in the browser. Nothing is uploaded. There is no account.

Live demo: [https://qr-zahlteil-kit.pages.dev](https://qr-zahlteil-kit.pages.dev)

The payment part follows the layout of Swiss Payment Standards version 2.3. Version 2.4, from 14 November 2026, does not change the technical rules for invoices in Swiss francs. For euros, this app accepts only a normal IBAN with a creditor reference (SCOR) or a normal IBAN with no reference.

This project is not certified and is not affiliated with SIX. There is no guarantee that a bank will accept every bill. Check the bill with your bank's test before you send it.

CSV batch bills, a logo, several named creditor profiles, and offline use after a license check are not in this edition. They are part of [QR Einzahlungsschein Kit Pro](https://groligro.gumroad.com/l/hkdovn) (CHF 14, once).

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43123

```bash
npm test
npm run build
```

`npm run build` writes a single `dist/index.html`. You can open that file from disk.

## Deutsch

QR Einzahlungsschein Kit erstellt eine einzelne QR-Rechnung im Browser. Es wird nichts hochgeladen. Der Zahlteil folgt den Swiss Payment Standards, Version 2.3. Version 2.4 ab dem 14. November 2026 ändert die technischen Regeln für Rechnungen in Franken nicht. Das Werkzeug ist nicht zertifiziert und nicht mit SIX verbunden. Es gibt keine Garantie, dass eine Bank jede Rechnung annimmt.

Sammelrechnungen aus einer CSV-Datei, ein Logo und mehrere benannte Empfänger sind [QR Einzahlungsschein Kit Pro](https://groligro.gumroad.com/l/hkdovn) (einmalig CHF 14).

## Français

QR Einzahlungsschein Kit crée une seule facture QR dans le navigateur. Rien n'est envoyé. La section paiement suit les Swiss Payment Standards, version 2.3. La version 2.4 dès le 14 novembre 2026 ne change pas les règles techniques pour les factures en francs. L'outil n'est pas certifié et n'est pas lié à SIX. Il n'y a pas de garantie que chaque facture soit acceptée.

Les factures groupées, le logo et plusieurs bénéficiaires nommés font partie de [QR Einzahlungsschein Kit Pro](https://groligro.gumroad.com/l/hkdovn) (CHF 14, une fois).

## Third-party software

The payment part is drawn with MIT-licensed libraries. Their notices are in [THIRD-PARTY.md](THIRD-PARTY.md) and in the in-app licenses dialog.

## Feedback

The running app links to the public feedback form. You can also open a GitHub issue. Do not add an email address to this repository.

A picture of the empty form is in [docs/form.png](docs/form.png).
