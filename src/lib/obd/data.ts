import type { ClearHistory, IdentityField, SensorKey } from "./protocol";
export type Language = "en" | "sr";
export type Fault = {
  code: string;
  status: "stored" | "pending" | "permanent";
  severity: "warning" | "danger" | "info";
  description: string;
  sr: string;
  cause: string;
  causeSr: string;
};
export type MileageModule = {
  name: string;
  short: string;
  mileage: number | null;
  header?: string;
  did?: string;
  scale?: number;
};
export type ModuleIdentity = Record<IdentityField, string | null> & {
  header: string;
  responded: boolean;
};
export type VehicleProfile = {
  vin: string;
  make: string;
  model: string;
  year: string;
  engine: string;
  fuel: string;
  protocol: string;
};
export type Readiness = {
  name: string;
  sr: string;
  status: "ready" | "incomplete" | "unsupported";
};
export type DiagnosticSnapshot = {
  connected: boolean;
  simulation: boolean;
  adapter: string;
  voltage: number | null;
  vehicle: VehicleProfile | null;
  faults: Fault[];
  scanned: boolean;
  sensors: Partial<Record<SensorKey, number>>;
  history: Record<string, number>[];
  mileage: MileageModule[];
  identities: ModuleIdentity[];
  dashboardMileage: number | null;
  hours: number | null;
  regenerations: number | null;
  readiness: Readiness[];
  clearHistory: ClearHistory | null;
  freeze: Partial<Record<SensorKey, number>>;
  logs: { direction: string; text: string; time: string }[];
  updated: string | null;
  error: string | null;
  busy: boolean;
};
export const faultDefinitions: Record<string, Omit<Fault, "code" | "status">> = {
  P0401: {
    severity: "warning",
    description: "Exhaust gas recirculation flow insufficient",
    sr: "Nedovoljan protok recirkulacije izduvnih gasova",
    cause:
      "Possible causes: carbon buildup, a blocked EGR valve, or a vacuum leak. Inspect before replacing parts.",
    causeSr:
      "Mogući uzroci: naslage ugljenika, blokiran EGR ventil ili curenje vakuuma. Proverite pre zamene delova.",
  },
  P0101: {
    severity: "warning",
    description: "Mass air flow sensor range / performance",
    sr: "Senzor protoka vazduha — opseg / performanse",
    cause: "Possible causes: a contaminated MAF sensor, intake leak, or wiring issue.",
    causeSr: "Mogući uzroci: zaprljan MAF senzor, curenje na usisu ili problem sa instalacijom.",
  },
  P0300: {
    severity: "danger",
    description: "Random / multiple cylinder misfire detected",
    sr: "Otkriveno nepravilno sagorevanje u više cilindara",
    cause:
      "Possible causes: ignition, fuel delivery, or compression. A flashing engine light requires stopping safely.",
    causeSr:
      "Mogući uzroci: paljenje, dovod goriva ili kompresija. Ako lampica motora treperi, bezbedno zaustavite vozilo.",
  },
};
export function makeFault(code: string, status: Fault["status"]): Fault {
  return {
    code,
    status,
    ...(faultDefinitions[code] ?? {
      severity: "info",
      description: "Manufacturer-specific or undefined diagnostic code",
      sr: "Proizvođački ili nedefinisan dijagnostički kod",
      cause: "Consult the vehicle manufacturer’s service documentation for this code.",
      causeSr: "Za ovaj kod pogledajte servisnu dokumentaciju proizvođača.",
    }),
  };
}
export function initialSnapshot(simulation = true): DiagnosticSnapshot {
  return {
    connected: false,
    simulation,
    adapter: "",
    voltage: null,
    vehicle: null,
    faults: [],
    scanned: false,
    sensors: {},
    history: [],
    mileage: ["Instrument cluster", "Engine control", "Transmission", "ABS / ESP"].map(
      (name, i) => ({ name, short: ["IPC", "ECM", "TCM", "ABS"][i] ?? "ECU", mileage: null }),
    ),
    identities: [],
    dashboardMileage: null,
    hours: null,
    regenerations: null,
    readiness: [],
    clearHistory: null,
    freeze: {},
    logs: [],
    updated: null,
    error: null,
    busy: false,
  };
}
/** Repository contract for a future authenticated vehicle / DID catalogue integration. */
export interface DiagnosticRepository {
  saveReport(report: DiagnosticSnapshot): Promise<string>;
  getVehicleProfiles(): Promise<VehicleProfile[]>;
  getManufacturerDids(vin: string): Promise<MileageModule[]>;
  getDtcDefinition(code: string): Promise<Fault | null>;
}
