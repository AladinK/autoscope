import { describe, expect, it } from "vitest";
import {
  canClearFaults,
  decodeDtc,
  decodePid,
  decodeVin,
  integrity,
  parsePayloads,
} from "./protocol";
describe("OBD protocol", () => {
  it("decodes Mode 01 RPM using (256A+B)/4", () =>
    expect(decodePid("0C", [0x1a, 0xf8])).toBe(1726));
  it("decodes coolant offset and speed", () => {
    expect(decodePid("05", [129])).toBe(89);
    expect(decodePid("0D", [68])).toBe(68);
  });
  it("decodes all P C B U code families", () =>
    expect(decodeDtc([4, 1, 0x40, 1, 0x80, 1, 0xc0, 1])).toEqual([
      "P0401",
      "C0001",
      "B0001",
      "U0001",
    ]));
  it("assembles ISO-TP frames by ECU", () =>
    expect(parsePayloads("7E8 10 09 62 F1 90 01 02 03\r7E8 21 04 05 06 00 00 00 00\r>")).toEqual([
      [0x62, 0xf1, 0x90, 1, 2, 3, 4, 5, 6],
    ]));
  it("rejects out of sequence ISO-TP continuation", () =>
    expect(parsePayloads("7E8 10 09 62 F1 90 01 02 03\r7E8 22 04 05 06 00 00 00 00")).toEqual([]));
  it("decodes VIN from Mode 09 payload", () => {
    const vin = "WVWZZZAUZKW000001";
    const raw =
      "49 02 01 " +
      Array.from(vin)
        .map((c) => c.charCodeAt(0).toString(16))
        .join(" ");
    expect(decodeVin(raw)).toBe(vin);
  });
  it("reads headered single-frame PID", () =>
    expect(parsePayloads("7E8 04 41 0C 0C D0 00 00 00\r>")).toEqual([[0x41, 0x0c, 0x0c, 0xd0]]));
  it("requires confirmation before Mode 04", () => expect(canClearFaults(false, 0, 0)).toBe(false));
  it("blocks clearing with moving vehicle", () => expect(canClearFaults(true, 1, 0)).toBe(false));
  it("blocks clearing with running engine", () => expect(canClearFaults(true, 0, 820)).toBe(false));
  it("blocks clearing when sensor data is unavailable", () =>
    expect(canClearFaults(true, null, null)).toBe(false));
  it("allows clearing stationary engine-off vehicle after confirmation", () =>
    expect(canClearFaults(true, 0, 0)).toBe(true));
  it("never reports mileage integrity without enough readings", () =>
    expect(integrity(142580, [null, 142580]).level).toBe("unknown"));
  it("compares the simulated multi-ECU readings", () => {
    expect(integrity(142580, [142580, 142612, 142594, 142580]).difference).toBe(32);
    expect(integrity(142580, [142580, 142612, 142594, 142580]).level).toBe("good");
  });
  it("flags large mileage discrepancy", () =>
    expect(integrity(100000, [100000, 130000]).level).toBe("danger"));
});
import { assessClearHistory, decodeVinInfo, decodeWord } from "./protocol";
describe("buyer check", () => {
  it("flags codes erased under 200 km ago", () => {
    expect(assessClearHistory({ km: 150, warmups: 50, minutes: 900 })).toBe("recent");
  });
  it("accepts long history", () => {
    expect(assessClearHistory({ km: 5000, warmups: 80, minutes: 4000 })).toBe("ok");
  });
  it("decodes distance PID 31", () => {
    expect(decodeWord("41 31 01 2C", 0x31)).toBe(300);
  });
  it("decodes VIN manufacturer and year", () => {
    const v = decodeVinInfo("WVWZZZAUZKW000001");
    expect(v.manufacturer).toBe("Volkswagen");
    expect(v.years).toContain(2019);
  });
});
