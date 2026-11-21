import { describe, expect, it } from "vitest";
import { prechecksPass, routineFor, servicePrechecks } from "./service-tools";
describe("service tools", () => {
  it("DPF regen needs coolant at least 70 °C", () => {
    expect(prechecksPass(servicePrechecks("dpf", { voltage: 13.5, rpm: 800, speed: 0, coolant: 69 }))).toBe(false);
    expect(prechecksPass(servicePrechecks("dpf", { voltage: 13.5, rpm: 800, speed: 0, coolant: 70 }))).toBe(true);
  });
  it("battery under 12.5 V blocks service", () => {
    expect(prechecksPass(servicePrechecks("oil", { voltage: 12.4, rpm: 0, speed: 0, coolant: 20 }))).toBe(false);
  });
  it("parking brake service needs engine off", () => {
    expect(prechecksPass(servicePrechecks("epb", { voltage: 12.8, rpm: 750, speed: 0, coolant: 20 }))).toBe(false);
  });
  it("unknown readings never pass", () => {
    expect(prechecksPass(servicePrechecks("oil", { voltage: null, rpm: 0, speed: 0, coolant: 20 }))).toBe(false);
  });
  it("only verified routines are runnable", () => {
    expect(routineFor("oil", "vag")).toBeNull();
  });
});
