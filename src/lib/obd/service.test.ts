import { describe, expect, it, vi } from "vitest";
import { isIdentificationDid } from "./protocol";
import { OBD2Service } from "./service";

const VIN_RESPONSE =
  "7E8 10 14 62 F1 90 57 56 57\r7E8 21 5A 5A 5A 41 55 5A 4B\r7E8 22 57 30 30 30 30 30 31\r>";

/** Adapter double: answers from a script and records every command the service sends. */
function scriptedAdapter(script: Record<string, string | Error>) {
  const service = new OBD2Service();
  const sent: string[] = [];
  service.command = vi.fn(async (text: string) => {
    sent.push(text);
    const reply = script[text] ?? "NO DATA";
    if (reply instanceof Error) throw reply;
    return reply;
  });
  vi.spyOn(service, "startPolling").mockImplementation(() => undefined);
  service.snapshot = { ...service.snapshot, connected: true };
  return { service, sent };
}

describe("read-only module identification", () => {
  it("reads the identification identifiers and restores the functional address", async () => {
    const { service, sent } = scriptedAdapter({
      "22F190": VIN_RESPONSE,
      "22F189": "7E8 07 62 F1 89 31 2E 30 30\r>",
    });
    const [identity] = await service.readModuleIdentity(["7e0"]);
    expect(identity).toMatchObject({
      header: "7E0",
      responded: true,
      vin: "WVWZZZAUZKW000001",
      softwareVersion: "1.00",
      partNumber: null,
    });
    expect(sent[0]).toBe("ATSH7E0");
    expect(sent.at(-1)).toBe("ATSH7DF");
    expect(service.snapshot.identities).toEqual([identity]);
  });

  it("sends nothing except ATSH and identification reads", async () => {
    const { service, sent } = scriptedAdapter({ "22F190": VIN_RESPONSE });
    await service.readModuleIdentity(["7E0", "7E1"]);
    const allowed = sent.every(
      (c) =>
        c === "ATSH7E0" ||
        c === "ATSH7E1" ||
        c === "ATSH7DF" ||
        (c.startsWith("22") && isIdentificationDid(c.slice(2))),
    );
    expect(allowed).toBe(true);
    expect(sent.some((c) => /^(2E|31|27|04|10|11|14)/.test(c))).toBe(false);
  });

  it("refuses to run in simulation, so no simulated values reach the cockpit", async () => {
    const { service, sent } = scriptedAdapter({});
    service.snapshot = { ...service.snapshot, simulation: true };
    await expect(service.readModuleIdentity(["7E0"])).rejects.toThrow(/connected adapter/);
    expect(sent).toHaveLength(0);
  });

  it("rejects malformed CAN IDs before sending anything", async () => {
    const { service, sent } = scriptedAdapter({});
    await expect(service.readModuleIdentity(["7E"])).rejects.toThrow(/three hexadecimal/);
    expect(sent).toHaveLength(0);
  });

  it("restores the functional address after an adapter timeout", async () => {
    const { service, sent } = scriptedAdapter({
      "22F190": new Error("Adapter timeout: 22F190."),
    });
    await expect(service.readModuleIdentity(["7E0"])).rejects.toThrow("Adapter timeout");
    expect(sent.at(-1)).toBe("ATSH7DF");
  });
});
