/**
 * Characters allowed in the Swiss QR Code (Implementation Guidelines 4.1.1):
 * Basic Latin U+0020–U+007E, Latin-1 U+00A0–U+00FF, Latin Extended A
 * U+0100–U+017F, plus U+0218, U+0219, U+021A, U+021B, and the euro sign U+20AC.
 * Account numbers and references are not passed through this check.
 */
export function isAllowedQrCharacter(code: number): boolean {
  if (code >= 0x20 && code <= 0x7e) return true;
  if (code >= 0xa0 && code <= 0xff) return true;
  if (code >= 0x100 && code <= 0x17f) return true;
  return code === 0x218 || code === 0x219 || code === 0x21a || code === 0x21b || code === 0x20ac;
}

export function normalizeText(value: string): string {
  return value.replace(/\s*\n\s*/g, " ").replace(/[ \t]{2,}/g, " ").trim();
}

export function hasPermittedCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code === undefined || !isAllowedQrCharacter(code)) return false;
  }
  return true;
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
  return slug || "rechnung";
}
