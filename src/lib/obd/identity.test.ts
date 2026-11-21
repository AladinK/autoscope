import { describe, expect, it } from "vitest";
import {
  formatIdentity,
  identificationDids,
  isIdentificationDid,
  parseDidResponse,
  vinAgrees,
} from "./protocol";

const VIN = "WVWZZZAUZKW000001";

describe("module identification parsing", () => {
  it("parses a multi-frame VIN response for F190", () => {
    const raw =
      "7E8 10 14 62 F1 90 57 56 57\r7E8 21 5A 5A 5A 41 55 5A 4B\r7E8 22 57 30 30 30 30 30 31\r>";
    const data = parseDidResponse(raw, "F190");
    expect(data && formatIdentity(data)).toBe(VIN);
  });

  it("treats a negative response as no data", () =>
    expect(parseDidResponse("7E8 03 7F 22 31\r>", "F187")).toBeNull());

  it("treats NO DATA as no data", () => expect(parseDidResponse("NO DATA\r>", "F191")).toBeNull());

  it("ignores a positive response for a different identifier", () =>
    expect(parseDidResponse("7E8 07 62 F1 89 31 2E 30 30\r>", "F187")).toBeNull());

  it("formats printable software versions as text", () =>
    expect(formatIdentity([0x31, 0x2e, 0x30, 0x30])).toBe("1.00"));

  it("formats binary identifiers as hexadecimal", () =>
    expect(formatIdentity([0x00, 0x12, 0xab, 0xff])).toBe("00 12 AB FF"));
});

describe("identification read guard", () => {
  it("lists only the six standard identification identifiers", () => {
    expect(identificationDids.map((d) => d.did)).toEqual([
      "F190",
      "F187",
      "F188",
      "F189",
      "F191",
      "F18C",
    ]);
  });

  it("accepts identification identifiers in any letter case", () => {
    expect(isIdentificationDid("F190")).toBe(true);
    expect(isIdentificationDid("f18c")).toBe(true);
  });

  it("refuses coding, routine and other non-identification identifiers", () => {
    for (const did of ["0600", "F1A0", "F186", "0102", "2E", ""])
      expect(isIdentificationDid(did)).toBe(false);
  });
});

describe("VIN cross-check", () => {
  it("agrees when module and vehicle VIN match, ignoring case", () =>
    expect(vinAgrees(VIN, VIN.toLowerCase())).toBe(true));

  it("disagrees when the module stores another VIN", () =>
    expect(vinAgrees(VIN, "WVWZZZAUZKW000002")).toBe(false));

  it("stays unknown without a module VIN or a vehicle VIN", () => {
    expect(vinAgrees(null, VIN)).toBeNull();
    expect(vinAgrees(VIN, null)).toBeNull();
  });

  it("stays unknown for text that is not a 17-character VIN", () =>
    expect(vinAgrees("ABC", VIN)).toBeNull());
});
