export type SensorKey =
  "rpm" | "speed" | "coolant" | "intake" | "maf" | "throttle" | "stft" | "ltft" | "boost" | "soot";
export const sensors: {
  key: SensorKey;
  name: string;
  sr: string;
  unit: string;
  pid?: string;
  max: number;
}[] = [
  { key: "rpm", name: "Engine RPM", sr: "Obrtaji motora", unit: "rpm", pid: "0C", max: 7000 },
  { key: "speed", name: "Vehicle speed", sr: "Brzina vozila", unit: "km/h", pid: "0D", max: 240 },
  {
    key: "coolant",
    name: "Coolant temperature",
    sr: "Temperatura rashladne tečnosti",
    unit: "°C",
    pid: "05",
    max: 130,
  },
  {
    key: "intake",
    name: "Intake air temperature",
    sr: "Temperatura usisnog vazduha",
    unit: "°C",
    pid: "0F",
    max: 100,
  },
  { key: "maf", name: "MAF airflow", sr: "Protok vazduha", unit: "g/s", pid: "10", max: 200 },
  {
    key: "throttle",
    name: "Throttle position",
    sr: "Položaj gasa",
    unit: "%",
    pid: "11",
    max: 100,
  },
  {
    key: "stft",
    name: "Short-term fuel trim",
    sr: "Kratkoročna korekcija goriva",
    unit: "%",
    pid: "06",
    max: 30,
  },
  {
    key: "ltft",
    name: "Long-term fuel trim",
    sr: "Dugoročna korekcija goriva",
    unit: "%",
    pid: "07",
    max: 30,
  },
  { key: "boost", name: "Turbo boost", sr: "Turbo pritisak", unit: "kPa", max: 250 },
  { key: "soot", name: "DPF soot load", sr: "Opterećenje DPF-a", unit: "%", max: 100 },
];
export function decodePid(pid: string, bytes: number[]): number | null {
  const [a, b] = bytes;
  if (a === undefined) return null;
  if (["0C", "10"].includes(pid) && b === undefined) return null;
  switch (pid) {
    case "0C":
      return (a * 256 + (b ?? 0)) / 4;
    case "0D":
    case "0B":
    case "33":
      return a;
    case "05":
    case "0F":
      return a - 40;
    case "10":
      return (a * 256 + (b ?? 0)) / 100;
    case "11":
      return (a * 100) / 255;
    case "06":
    case "07":
      return ((a - 128) * 100) / 128;
    default:
      return null;
  }
}
/** Handles ELM auto-formatted lines as well as headered ISO-TP CAN frames. */
export function parsePayloads(raw: string): number[][] {
  const completed: number[][] = [];
  const streams = new Map<string, { length: number; data: number[]; sequence: number }>();
  for (let line of raw.replace(/>/g, "").split(/[\r\n]+/)) {
    line = line.trim().toUpperCase();
    if (!line || /^(AT|SEARCHING|OK|NO DATA|STOPPED|ELM|STN|\?)/.test(line)) continue;
    line = line.replace(/^\d+:/, "").trim();
    let id = "default";
    const header = line.match(/^([0-9A-F]{3}|[0-9A-F]{8})\s+/);
    if (header) {
      id = header[1] ?? id;
      line = line.slice(header[0].length);
    } else if (/^7[0-9A-F]{2}[0-9A-F]+$/.test(line) && line.length % 2 === 1) {
      id = line.slice(0, 3);
      line = line.slice(3);
    }
    // CAN DLC may be included between the header and data.
    if (header && /^[0-8]\s/.test(line)) line = line.slice(2);
    const hex = line.replace(/\s/g, "");
    if (!/^(?:[0-9A-F]{2})+$/.test(hex)) continue;
    const bytes = hex.match(/../g)?.map((x) => parseInt(x, 16)) ?? [];
    const first = bytes[0];
    if (first === undefined) continue;
    const type = first >> 4;
    if (type === 0 && first > 0) completed.push(bytes.slice(1, 1 + first));
    else if (type === 1 && bytes[1] !== undefined)
      streams.set(id, {
        length: ((first & 15) << 8) + bytes[1],
        data: bytes.slice(2),
        sequence: 1,
      });
    else if (type === 2) {
      const stream = streams.get(id);
      if (!stream || (first & 15) !== stream.sequence) {
        streams.delete(id);
        continue;
      }
      stream.data.push(...bytes.slice(1));
      stream.sequence = (stream.sequence + 1) % 16;
      if (stream.data.length >= stream.length) {
        completed.push(stream.data.slice(0, stream.length));
        streams.delete(id);
      }
    } else if (type >= 4) completed.push(bytes);
  }
  return completed;
}
export function decodeDtc(bytes: number[]): string[] {
  const result: string[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const a = bytes[i],
      b = bytes[i + 1];
    if (a === undefined || b === undefined || (a === 0 && b === 0)) continue;
    result.push(
      `${"PCBU"[a >> 6]}${(a >> 4) & 3}${(a & 15).toString(16)}${b.toString(16).padStart(2, "0")}`.toUpperCase(),
    );
  }
  return result;
}
export function decodeVin(raw: string): string | null {
  const frames = parsePayloads(raw).filter((p) => p[0] === 0x49 && p[1] === 0x02);
  const vin = frames
    .map((p) =>
      p
        .slice(3)
        .map((n) => String.fromCharCode(n))
        .join(""),
    )
    .join("")
    .replace(/[^A-HJ-NPR-Z0-9]/g, "");
  return vin.length === 17 ? vin : null;
}
export function integrity(dashboard: number | null, modules: (number | null)[]) {
  const values = modules.filter((v): v is number => v !== null && Number.isFinite(v));
  if (dashboard === null || dashboard <= 0 || values.length < 2)
    return { level: "unknown" as const, difference: null, percent: null };
  const difference = Math.max(...values.map((v) => Math.abs(v - dashboard)));
  const percent = (difference / dashboard) * 100;
  return {
    level:
      percent > 5 ? ("danger" as const) : percent > 1 ? ("warning" as const) : ("good" as const),
    difference,
    percent,
  };
}
export function canClearFaults(confirmed: boolean, speed: number | null, rpm: number | null) {
  return confirmed && speed === 0 && rpm === 0;
}
/** Two-byte OBD value (A*256+B) from a mode 01 response for the given PID. */
export function decodeWord(raw: string, pid: number): number | null {
  const p = parsePayloads(raw).find((x) => x[0] === 0x41 && x[1] === pid);
  if (!p || p.length < 4) return null;
  return (p[2] ?? 0) * 256 + (p[3] ?? 0);
}
export function decodeByte(raw: string, pid: number): number | null {
  const p = parsePayloads(raw).find((x) => x[0] === 0x41 && x[1] === pid);
  return p && p.length >= 3 ? (p[2] ?? null) : null;
}
export type ClearHistory = { km: number | null; warmups: number | null; minutes: number | null };
/** Thresholds below which codes count as recently erased (likely before a sale). */
export const RECENT_CLEAR = { km: 200, warmups: 10, minutes: 120 };
export function assessClearHistory(h: ClearHistory): "recent" | "ok" | "unknown" {
  const checks = [
    h.km !== null ? h.km < RECENT_CLEAR.km : null,
    h.warmups !== null ? h.warmups < RECENT_CLEAR.warmups : null,
    h.minutes !== null ? h.minutes < RECENT_CLEAR.minutes : null,
  ].filter((v): v is boolean => v !== null);
  if (!checks.length) return "unknown";
  return checks.some(Boolean) ? "recent" : "ok";
}
const WMI: Record<string, string> = {
  WVW: "Volkswagen", WV1: "Volkswagen Commercial", WV2: "Volkswagen Commercial", WAU: "Audi",
  WBA: "BMW", WBS: "BMW M", WDB: "Mercedes-Benz", WDD: "Mercedes-Benz", W1K: "Mercedes-Benz",
  WP0: "Porsche", W0L: "Opel", WF0: "Ford Germany", TMB: "Škoda", VSS: "SEAT", VF1: "Renault",
  VF3: "Peugeot", VF7: "Citroën", ZFA: "Fiat", ZAR: "Alfa Romeo", YV1: "Volvo", SAL: "Land Rover",
  SAJ: "Jaguar", JTD: "Toyota", JT2: "Toyota", SB1: "Toyota UK", JHM: "Honda", JN1: "Nissan",
  JMZ: "Mazda", KMH: "Hyundai", KNA: "Kia", U5Y: "Kia", TMA: "Hyundai", UU1: "Dacia",
  VNK: "Toyota France", "1FA": "Ford USA", "1G1": "Chevrolet", "5YJ": "Tesla", LRW: "Tesla China",
};
const REGION: [string, string, string][] = [
  ["A", "H", "Africa"], ["J", "R", "Asia"], ["S", "Z", "Europe"], ["1", "5", "North America"],
  ["6", "7", "Oceania"], ["8", "9", "South America"],
];
const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789";
const TRANSLIT: Record<string, number> = Object.fromEntries(
  "A1B2C3D4E5F6G7H8J1K2L3M4N5P7R9S2T3U4V5W6X7Y8Z9".match(/../g)!.map((p) => [p[0], Number(p[1])]),
);
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
export function vinCheckDigitValid(vin: string): boolean {
  const sum = [...vin].reduce(
    (acc, c, i) => acc + (/\d/.test(c) ? Number(c) : (TRANSLIT[c] ?? 0)) * (WEIGHTS[i] ?? 0),
    0,
  );
  const r = sum % 11;
  return vin[8] === (r === 10 ? "X" : String(r));
}
export type VinInfo = {
  valid: boolean;
  manufacturer: string | null;
  region: string | null;
  years: number[];
  plant: string;
  serial: string;
  checkDigit: boolean;
};
/** Offline VIN decoding; check digit is mandatory in North America only. */
export function decodeVinInfo(vin: string): VinInfo {
  const v = vin.toUpperCase();
  const valid = /^[A-HJ-NPR-Z0-9]{17}$/.test(v);
  const first = v[0] ?? "";
  const region = REGION.find(([a, b]) => first >= a && first <= b)?.[2] ?? null;
  const idx = YEAR_CODES.indexOf(v[9] ?? "");
  const years = idx < 0 ? [] : [1980 + idx, 2010 + idx].filter((y) => y <= new Date().getFullYear() + 1);
  return {
    valid,
    manufacturer: WMI[v.slice(0, 3)] ?? null,
    region,
    years,
    plant: v[10] ?? "",
    serial: v.slice(11),
    checkDigit: valid && vinCheckDigitValid(v),
  };
}
/** Standard ISO 14229 identification identifiers. The identity read may request only these. */
export const identificationDids = [
  { did: "F190", field: "vin" },
  { did: "F187", field: "partNumber" },
  { did: "F188", field: "softwareNumber" },
  { did: "F189", field: "softwareVersion" },
  { did: "F191", field: "hardwareNumber" },
  { did: "F18C", field: "serial" },
] as const;
export type IdentityField = (typeof identificationDids)[number]["field"];
/** Read-only guard: true only for the identification identifiers listed above. */
export function isIdentificationDid(did: string): boolean {
  return identificationDids.some((d) => d.did === did.toUpperCase());
}
/** Data bytes of a positive ReadDataByIdentifier (0x22) response, or null when absent or negative. */
export function parseDidResponse(raw: string, did: string): number[] | null {
  if (!/^[0-9A-F]{4}$/i.test(did)) return null;
  const hi = parseInt(did.slice(0, 2), 16);
  const lo = parseInt(did.slice(2), 16);
  const payload = parsePayloads(raw).find((p) => p[0] === 0x62 && p[1] === hi && p[2] === lo);
  return payload ? payload.slice(3) : null;
}
/** Text when the bytes are printable; hexadecimal for binary identifiers so nothing is hidden. */
export function formatIdentity(bytes: number[]): string {
  const meaningful = bytes.filter((b) => b !== 0x00 && b !== 0xff);
  if (meaningful.length > 0 && meaningful.every((b) => b >= 0x20 && b <= 0x7e))
    return String.fromCharCode(...meaningful).trim();
  return bytes
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ")
    .toUpperCase();
}
/** Compares a module-stored VIN with the vehicle VIN; null when either cannot be compared. */
export function vinAgrees(moduleVin: string | null, vehicleVin: string | null): boolean | null {
  if (!moduleVin || moduleVin.length !== 17 || !vehicleVin) return null;
  return moduleVin.toUpperCase() === vehicleVin.toUpperCase();
}
