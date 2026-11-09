import { isIBANValid, isQRIBAN } from "swissqrbill/utils";
import { describe, expect, it } from "vitest";
import {
  buildIban,
  classifyAccount,
  formatIban,
  isIbanChecksumValid,
  isQrIban,
  isRegularCreditorIban,
} from "../src/lib/iban";

describe("IBAN and QR-IBAN", () => {
  it("accepts the published QR-IBAN sample, including spaces and lowercase", () => {
    expect(classifyAccount("CH4431999123000889012")).toEqual({
      kind: "qr-iban",
      iban: "CH4431999123000889012",
    });
    expect(classifyAccount("ch44 3199 9123 0008 8901 2").kind).toBe("qr-iban");
    expect(isQrIban("CH44 3199 9123 0008 8901 2")).toBe(true);
    expect(formatIban("CH4431999123000889012")).toBe("CH44 3199 9123 0008 8901 2");
  });

  it("accepts a regular Swiss IBAN and rejects a broken check digit", () => {
    expect(classifyAccount("CH93 0076 2011 6238 5295 7").kind).toBe("regular-iban");
    expect(isRegularCreditorIban("CH9300762011623852957")).toBe(true);
    expect(isQrIban("CH9300762011623852957")).toBe(false);
    expect(classifyAccount("CH4431999123000889013")).toMatchObject({
      kind: "invalid",
      reason: "checksum",
    });
    expect(isIbanChecksumValid("CH4431999123000889013")).toBe(false);
  });

  it("rejects foreign IBANs and the wrong length", () => {
    expect(classifyAccount("DE89370400440532013000")).toMatchObject({
      kind: "invalid",
      reason: "country",
    });
    expect(isIbanChecksumValid("DE89370400440532013000")).toBe(true);
    expect(classifyAccount("CH443199912300088901").reason).toBe("length");
    expect(classifyAccount("").reason).toBe("empty");
    expect(classifyAccount("CH44 3199 9123 0008 8901*").reason).toBe("characters");
  });

  it("treats IID 30000–31999 as QR-IBAN and the neighbours as regular", () => {
    const account = "000000000000";
    expect(classifyAccount(buildIban("CH", `30000${account}`)).kind).toBe("qr-iban");
    expect(classifyAccount(buildIban("CH", `31999${account}`)).kind).toBe("qr-iban");
    expect(classifyAccount(buildIban("CH", `29999${account}`)).kind).toBe("regular-iban");
    expect(classifyAccount(buildIban("CH", `32000${account}`)).kind).toBe("regular-iban");
    expect(classifyAccount(buildIban("LI", `30000${account}`)).kind).toBe("qr-iban");
    expect(classifyAccount(buildIban("LI", `00791${account}`)).kind).toBe("regular-iban");
  });

  it("reproduces the canonical QR-IBAN from its BBAN", () => {
    expect(buildIban("CH", "31999123000889012")).toBe("CH4431999123000889012");
  });

  it("agrees with swissqrbill on valid samples", () => {
    for (const iban of ["CH4431999123000889012", "CH9300762011623852957", "CH5800791123000889012"]) {
      expect(isIbanChecksumValid(iban)).toBe(isIBANValid(iban));
      expect(isQrIban(iban)).toBe(isQRIBAN(iban));
    }
    expect(isQRIBAN("CH4431999123000889013")).toBe(true);
    expect(isQrIban("CH4431999123000889013")).toBe(false);
  });
});
