export type ServiceToolId = "oil" | "dpf" | "epb" | "battery";
export type Brand = "vag" | "bmw" | "mercedes" | "opel" | "psa" | "renault";
export const brands: { id: Brand; label: string }[] = [
  { id: "vag", label: "VW / Audi / Škoda / Seat" },
  { id: "bmw", label: "BMW" },
  { id: "mercedes", label: "Mercedes-Benz" },
  { id: "opel", label: "Opel" },
  { id: "psa", label: "Peugeot / Citroën" },
  { id: "renault", label: "Renault / Dacia" },
];
export type ServiceTool = {
  id: ServiceToolId;
  name: string;
  sr: string;
  purpose: string;
  purposeSr: string;
};
export const serviceTools: ServiceTool[] = [
  { id: "oil", name: "Oil service reset", sr: "Reset servisa ulja", purpose: "Resets the service interval after an oil change.", purposeSr: "Vraća servisni interval posle zamene ulja." },
  { id: "dpf", name: "DPF forced regeneration", sr: "Prinudna DPF regeneracija", purpose: "Burns soot from the particulate filter while the car is stationary.", purposeSr: "Sagoreva čađ iz filtera čestica dok auto stoji." },
  { id: "epb", name: "Electronic parking brake service", sr: "Servis elektronske ručne", purpose: "Retracts the rear calipers for pad replacement.", purposeSr: "Uvlači zadnje čeljusti radi zamene pločica." },
  { id: "battery", name: "Battery registration", sr: "Registracija akumulatora", purpose: "Tells the car a new battery was fitted so charging adapts.", purposeSr: "Javlja autu da je ugrađen novi akumulator kako bi punjenje bilo prilagođeno." },
];
/** Verified manufacturer routines. Empty until a documented ECU profile is validated on a real vehicle. */
export const verifiedRoutines: Partial<Record<`${ServiceToolId}:${Brand}`, string[]>> = {};
export function routineFor(tool: ServiceToolId, brand: Brand) {
  return verifiedRoutines[`${tool}:${brand}`] ?? null;
}
export type PrecheckInput = { voltage: number | null; rpm: number | null; speed: number | null; coolant: number | null };
export type Precheck = { key: string; en: string; sr: string; ok: boolean | null };
/** Safety preconditions that must all pass before any service routine may run. */
export function servicePrechecks(tool: ServiceToolId, v: PrecheckInput): Precheck[] {
  const chk = (val: number | null, test: (n: number) => boolean) => (val === null ? null : test(val));
  const list: Precheck[] = [
    { key: "voltage", en: "Battery at least 12.5 V", sr: "Akumulator najmanje 12,5 V", ok: chk(v.voltage, (n) => n >= 12.5) },
    { key: "speed", en: "Vehicle stationary", sr: "Vozilo miruje", ok: chk(v.speed, (n) => n === 0) },
  ];
  if (tool === "dpf") {
    list.push(
      { key: "rpm", en: "Engine running", sr: "Motor radi", ok: chk(v.rpm, (n) => n > 500) },
      { key: "coolant", en: "Coolant at least 70 °C", sr: "Rashladna tečnost najmanje 70 °C", ok: chk(v.coolant, (n) => n >= 70) },
    );
  } else {
    list.push({ key: "rpm", en: "Engine off, ignition on", sr: "Motor ugašen, kontakt uključen", ok: chk(v.rpm, (n) => n === 0) });
  }
  return list;
}
export const prechecksPass = (c: Precheck[]) => c.every((x) => x.ok === true);
