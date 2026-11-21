import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Battery,
  Bluetooth,
  CarFront,
  Check,
  ChevronDown,
  ChevronRight,
  Fingerprint,
  CircleHelp,
  Clock3,
  Cpu,
  FileJson,
  FileText,
  Gauge,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ScanLine,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Terminal,
  TriangleAlert,
  Unplug,
  X,
  Zap,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useCockpit } from "./provider";
import { ServiceToolsSection } from "./service-tools";
import {
  assessClearHistory,
  decodeVinInfo,
  identificationDids,
  integrity,
  sensors,
  type IdentityField,
  type SensorKey,
  vinAgrees,
} from "@/lib/obd/protocol";
import { downloadReport } from "@/lib/obd/reports";
import type { MileageModule } from "@/lib/obd/data";
import carImage from "@/assets/golf-studio.jpg";
export type View =
  "overview" | "mileage" | "diagnostics" | "telemetry" | "freeze" | "readiness" | "service" | "reports";
const navigation = [
  { view: "overview", to: "/", label: "Overview", sr: "Pregled", icon: LayoutDashboard },
  {
    view: "mileage",
    to: "/mileage",
    label: "Mileage integrity",
    sr: "Provera kilometraže",
    icon: ShieldCheck,
  },
  {
    view: "diagnostics",
    to: "/diagnostics",
    label: "Diagnostics",
    sr: "Dijagnostika",
    icon: ScanLine,
  },
  {
    view: "telemetry",
    to: "/telemetry",
    label: "Live telemetry",
    sr: "Podaci uživo",
    icon: Activity,
  },
  {
    view: "freeze",
    to: "/freeze-frame",
    label: "Freeze frame",
    sr: "Zamrznuti podaci",
    icon: Snowflake,
  },
  {
    view: "readiness",
    to: "/readiness",
    label: "Readiness monitors",
    sr: "Spremnost sistema",
    icon: Gauge,
  },
  { view: "service", to: "/service-tools", label: "Service tools", sr: "Servisni alati", icon: Wrench },
  { view: "reports", to: "/reports", label: "Reports", sr: "Izveštaji", icon: FileText },
] as const;
const identityLabels: Record<IdentityField, [string, string]> = {
  vin: ["VIN in module", "VIN u modulu"],
  partNumber: ["Part number", "Broj dela"],
  softwareNumber: ["Software number", "Broj softvera"],
  softwareVersion: ["Software version", "Verzija softvera"],
  hardwareNumber: ["Hardware number", "Broj hardvera"],
  serial: ["Serial number", "Serijski broj"],
};
export function Dashboard({ view = "overview" }: { view?: View }) {
  const { service, snapshot: s, language, setLanguage, t } = useCockpit();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [terminal, setTerminal] = useState(false);
  const [adapterSettings, setAdapterSettings] = useState(false);
  const [help, setHelp] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [sensorModal, setSensorModal] = useState(false);
  const [clearModal, setClearModal] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<SensorKey[]>(["rpm", "speed", "coolant", "throttle"]);
  const [chartSensor, setChartSensor] = useState<SensorKey>("rpm");
  const [period, setPeriod] = useState("30s");
  const [faultFilter, setFaultFilter] = useState("all");
  const [error, setError] = useState("");
  const [uart, setUart] = useState({ service: "", notify: "", write: "" });
  const [profiles, setProfiles] = useState<MileageModule[]>(
    s.mileage.map((m) => ({ ...m, header: "", did: "", scale: 1 })),
  );
  const [profileModal, setProfileModal] = useState(false);
  const [identityHeaders, setIdentityHeaders] = useState(["7E0", "", "", ""]);
  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const title = navigation.find((n) => n.view === view);
  const score = integrity(
    s.dashboardMileage,
    s.mileage.map((m) => m.mileage),
  );
  const sensor = sensors.find((x) => x.key === chartSensor) ?? {
    name: "Engine RPM",
    sr: "Obrtaji motora",
    unit: "rpm",
  };
  const readyCount = s.readiness.filter((r) => r.status === "ready").length;
  const supported = s.readiness.filter((r) => r.status !== "unsupported").length;
  const faults = s.faults.filter((f) => faultFilter === "all" || f.status === faultFilter);
  const voltageGood = s.voltage !== null && s.voltage >= 12.4 && s.voltage <= 14.8;
  const format = (value: number | null | undefined) =>
    value === null || value === undefined
      ? "—"
      : value.toLocaleString(language === "en" ? "en-GB" : "sr-RS", { maximumFractionDigits: 1 });
  const scanButton = (
    <Button disabled={!s.connected || s.busy} onClick={() => run(() => service.scan())}>
      {s.busy ? <LoaderCircle className="spin" /> : <ScanLine />}
      {t("Run full scan", "Pokreni skeniranje")}
    </Button>
  );
  const sectionHeading = (
    icon: typeof Activity,
    en: string,
    sr: string,
    extra?: React.ReactNode,
  ) => {
    const Icon = icon;
    return (
      <div className="section-heading">
        <h2>
          <Icon />
          {t(en, sr)}
        </h2>
        {extra}
      </div>
    );
  };
  const statusLabel = (status: string) =>
    ({
      stored: t("Stored", "Sačuvan"),
      pending: t("Pending", "Na čekanju"),
      permanent: t("Permanent", "Trajan"),
      ready: t("Ready", "Spreman"),
      incomplete: t("Not ready", "Nije spreman"),
      unsupported: t("Not supported", "Nije podržan"),
    })[status] ?? status;
  const telemetrySection = (
    <section className="telemetry-section">
      {sectionHeading(
        Activity,
        "Live telemetry",
        "Podaci uživo",
        <div className="flex items-center gap-2">
          <span className={`live-label ${paused ? "muted" : ""}`}>
            <i />
            {paused
              ? t("Paused", "Pauzirano")
              : s.connected
                ? t("Live", "Uživo")
                : t("Disconnected", "Nije povezano")}
          </span>
          <Button variant="outline" size="sm" onClick={() => setSensorModal(true)}>
            <SlidersHorizontal />
            {t("Customize", "Prilagodi")}
          </Button>
        </div>,
      )}
      <div className="sensor-grid">
        {selected.map((key) => {
          const item = sensors.find((x) => x.key === key);
          if (!item) return null;
          return (
            <Button
              key={key}
              variant="ghost"
              className={`sensor-card ${chartSensor === key ? "selected" : ""}`}
              onClick={() => setChartSensor(key)}
            >
              <span className="sensor-top">
                {language === "en" ? item.name : item.sr}
                {key === "rpm" ? <Gauge /> : key === "speed" ? <CarFront /> : <Activity />}
              </span>
              <span className="sensor-number">
                {format(s.sensors[key])}
                <small>{item.unit}</small>
              </span>
              <span className="sensor-caption">
                <i />
                {s.connected && s.sensors[key] !== undefined
                  ? key === "coolant" && (s.sensors[key] ?? 0) > 110
                    ? t("High temperature", "Visoka temperatura")
                    : t("Within normal range", "U normalnom opsegu")
                  : t("No live reading", "Nema podataka")}
              </span>
              <span className="gauge-track">
                <span
                  className="gauge-fill"
                  data-level={
                    key === "rpm"
                      ? "low"
                      : key === "speed"
                        ? "zero"
                        : key === "coolant"
                          ? "high"
                          : "low"
                  }
                />
              </span>
            </Button>
          );
        })}
      </div>
      <div className="chart-panel">
        <div className="chart-heading">
          <div>
            <span className="chart-dot" />
            {language === "en" ? sensor.name : sensor.sr}
            <span className="text-muted-foreground text-xs ml-2">({sensor.unit})</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="period-control">
              {["15s", "30s"].map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className={period === p ? "active" : ""}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                paused
                  ? t("Resume telemetry", "Nastavi podatke")
                  : t("Pause telemetry", "Pauziraj podatke")
              }
              title={paused ? t("Resume", "Nastavi") : t("Pause", "Pauziraj")}
              onClick={() => {
                if (paused) service.startPolling();
                else service.stopPolling();
                setPaused(!paused);
              }}
            >
              {paused ? <Play /> : <Pause />}
            </Button>
          </div>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={s.history.slice(period === "15s" ? -10 : -22)}
              margin={{ top: 12, right: 10, bottom: 0, left: -20 }}
            >
              <defs>
                <linearGradient id="sensorFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 5" />
              <XAxis
                dataKey="time"
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}s`}
                minTickGap={45}
              />
              <YAxis
                domain={chartSensor === "rpm" ? [0, 1200] : ["auto", "auto"]}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip unit={sensor.unit} />} />
              <Area
                type="monotone"
                dataKey={chartSensor}
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#sensorFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-footer">
          <span>{t("Sample interval", "Interval očitavanja")}: ~1.4s</span>
          <span>
            {t("Protocol", "Protokol")}: {s.simulation ? "CAN · simulated" : "OBD-II"}{" "}
            <Radio size={12} />
          </span>
        </div>
      </div>
    </section>
  );
  const identitySection = (
    <section className="identity-section">
      {sectionHeading(Fingerprint, "Module identification", "Identifikacija modula")}
      <div className="identity-body">
        <p className="text-muted-foreground text-xs">
          {t(
            "Reads only standard identification data (VIN, part, software and hardware numbers) with ReadDataByIdentifier. Nothing is written to the vehicle. Modules that do not answer stay blank.",
            "Čita samo standardne identifikacione podatke (VIN, broj dela, softvera i hardvera) pomoću ReadDataByIdentifier. Na vozilo se ništa ne upisuje. Moduli koji ne odgovore ostaju prazni.",
          )}
        </p>
        <div className="identity-inputs">
          {identityHeaders.map((header, i) => (
            <label key={i}>
              CAN ID {i + 1}
              <input
                aria-label={`CAN ID ${i + 1}`}
                placeholder="—"
                maxLength={3}
                value={header}
                onChange={(e) =>
                  setIdentityHeaders(
                    identityHeaders.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)),
                  )
                }
              />
            </label>
          ))}
        </div>
        <Button
          disabled={!s.connected || s.busy || identityHeaders.every((h) => h.trim() === "")}
          onClick={() => run(() => service.readModuleIdentity(identityHeaders))}
        >
          {s.busy ? <LoaderCircle className="spin" /> : <Fingerprint />}
          {t("Read identification", "Pročitaj identifikaciju")}
        </Button>
        {s.identities.map((m) => {
          const agrees = vinAgrees(m.vin, s.vehicle?.vin ?? null);
          return (
            <div className="identity-row" key={m.header}>
              <div className="identity-head">
                <strong>CAN {m.header}</strong>
                <span className={m.responded ? "text-primary" : "text-muted-foreground"}>
                  {m.responded ? t("Responded", "Odgovorio") : t("No response", "Nema odgovora")}
                </span>
              </div>
              <dl>
                {identificationDids.map(({ field }) => {
                  const [en, sr] = identityLabels[field];
                  return (
                    <div key={field}>
                      <dt>{t(en, sr)}</dt>
                      <dd>{m[field] ?? "—"}</dd>
                    </div>
                  );
                })}
              </dl>
              {agrees === false && (
                <div className="buyer-alert recent">
                  <strong>{t("VIN mismatch", "VIN se ne poklapa")}</strong>
                  <span>
                    {t(
                      `Module CAN ${m.header} stores a different VIN than the vehicle. Check whether this module was replaced. This is an indicator, not proof.`,
                      `Modul CAN ${m.header} ima drugačiji VIN od vozila. Proverite da li je modul zamenjen. Ovo je pokazatelj, a ne dokaz.`,
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
  const mileageSection = (
    <section className="mileage-section">
      {sectionHeading(
        ShieldCheck,
        "Mileage integrity",
        "Provera kilometraže",
        <Link to="/mileage" className="section-link">
          {t("View report", "Pogledaj izveštaj")}
          <ArrowRight />
        </Link>,
      )}
      <div className="mileage-body">
        <div className={`integrity-banner ${score.level}`}>
          <div className="integrity-icon">
            <ShieldCheck />
          </div>
          <div>
            <strong>
              {score.level === "good"
                ? t("Mileage is consistent", "Kilometraža je usklađena")
                : score.level === "unknown"
                  ? t("Not enough data", "Nedovoljno podataka")
                  : t("Mileage discrepancy detected", "Otkriveno odstupanje")}
            </strong>
            <p>
              {score.level === "good"
                ? t(
                    `Readings agree across ${s.mileage.filter((m) => m.mileage !== null).length} control modules.`,
                    `Očitavanja su usklađena u ${s.mileage.filter((m) => m.mileage !== null).length} modula.`,
                  )
                : t(
                    "Compare verified ECU readings before drawing conclusions.",
                    "Uporedite proverena ECU očitavanja.",
                  )}
            </p>
          </div>
          <span className="integrity-check">
            <Check />
          </span>
        </div>
        <div className="module-table">
          {s.mileage.map((m) => (
            <div className="module-row" key={m.short}>
              <span className="module-icon">
                <Cpu />
              </span>
              <div>
                <strong>
                  {t(
                    m.name,
                    {
                      IPC: "Instrument tabla",
                      ECM: "Kontrola motora",
                      TCM: "Menjač",
                      ABS: "ABS / ESP",
                    }[m.short] ?? m.name,
                  )}
                </strong>
                <small>{m.short}</small>
              </div>
              <span className="module-value">
                {format(m.mileage)}
                <small> km</small>
              </span>
              {m.mileage !== null ? (
                <Check className="text-primary size-4" />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          ))}
        </div>
        <div className="mileage-summary">
          <div>
            <span>{t("Maximum deviation", "Najveće odstupanje")}</span>
            <strong>
              {format(score.difference)} <small>km</small>
              <em>{score.percent === null ? "—" : `${score.percent.toFixed(2)}%`}</em>
            </strong>
          </div>
          <div>
            <span>{t("Engine operating hours", "Radni sati motora")}</span>
            <strong>
              {format(s.hours)} <small>h</small>
            </strong>
          </div>
        </div>
        <div className="panel-note">
          <ShieldCheck size={13} />
          {s.simulation
            ? t(
                "Simulated comparison · not proof of true mileage",
                "Simulirano poređenje · nije dokaz stvarne kilometraže",
              )
            : t(
                "ECU agreement does not prove true mileage.",
                "Slaganje ECU podataka ne dokazuje stvarnu kilometražu.",
              )}
        </div>
      </div>
      {view === "mileage" && (
        <div className="detail-controls">
          <label>
            {t("Dashboard mileage (km)", "Kilometraža na tabli (km)")}
            <input
              type="number"
              min="0"
              value={s.dashboardMileage ?? ""}
              onChange={(e) =>
                service.setDashboardMileage(
                  e.target.value === "" ? null : Math.max(0, Number(e.target.value)),
                )
              }
            />
          </label>
          <Button variant="outline" onClick={() => setProfileModal(true)}>
            <Settings2 />
            {t("ECU profiles", "ECU profili")}
          </Button>
          <Button
            disabled={!s.connected || s.busy}
            onClick={() => run(() => service.verifyMileage(profiles))}
          >
            <RefreshCw />
            {t("Verify mileage", "Proveri kilometražu")}
          </Button>
          <p className="text-muted-foreground text-xs w-full">
            {t(
              "UDS mileage, operating hours, DPF counters and soot are manufacturer-specific. Real readings require documented ECU addresses, DIDs and scaling; unknown data stays unavailable. Estimated mileage is not evidence of tampering.",
              "UDS kilometraža, radni sati i DPF podaci zavise od proizvođača. Potrebne su dokumentovane ECU adrese, DID-ovi i skaliranje. Nepoznati podaci nisu dostupni. Procena nije dokaz manipulacije.",
            )}
          </p>
          <div className="estimate-row">
            <Clock3 />
            {t(
              "Hours-based estimate (44 km/h assumption)",
              "Procena po satima (pretpostavka 44 km/h)",
            )}
            : {s.hours === null ? "—" : format(s.hours * 44)} km ·{" "}
            {t("DPF regenerations", "DPF regeneracije")}: {format(s.regenerations)}
          </div>
        </div>
      )}
    </section>
  );
  const diagnosticsSection = (
    <section className="diagnostics-section">
      {sectionHeading(
        ScanLine,
        "Diagnostic trouble codes",
        "Dijagnostički kodovi",
        <span className="count-badge warning">
          {s.faults.length} {t("detected", "otkriveno")}
        </span>,
      )}
      <div className="fault-tabs">
        {["all", "stored", "pending", "permanent"].map((status) => (
          <Button
            key={status}
            variant="ghost"
            size="sm"
            className={faultFilter === status ? "active" : ""}
            onClick={() => setFaultFilter(status)}
          >
            {status === "all" ? t("All codes", "Svi kodovi") : statusLabel(status)}
            <small>{s.faults.filter((f) => status === "all" || f.status === status).length}</small>
          </Button>
        ))}
      </div>
      <div className="fault-list">
        {faults.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck />
            {s.scanned
              ? t("No codes in this category", "Nema kodova u ovoj kategoriji")
              : t("Run a scan to read fault codes", "Pokrenite skeniranje za očitavanje kodova")}
          </div>
        ) : (
          faults.map((f) => (
            <details className="fault-item" key={f.code + f.status}>
              <summary>
                <span className={`fault-icon ${f.severity}`}>
                  <TriangleAlert />
                </span>
                <div>
                  <div className="fault-code">
                    {f.code}
                    <span className={`severity-label ${f.severity}`}>
                      {f.severity === "warning"
                        ? t("Warning", "Upozorenje")
                        : f.severity === "danger"
                          ? t("Critical", "Kritično")
                          : t("Info", "Info")}
                    </span>
                  </div>
                  <p>{language === "en" ? f.description : f.sr}</p>
                  <span className="fault-meta">
                    {t("Powertrain", "Pogonski sistem")} <i />
                    {statusLabel(f.status)}
                  </span>
                </div>
                <ChevronRight className="fault-arrow" />
              </summary>
              <p className="fault-cause">{language === "en" ? f.cause : f.causeSr}</p>
            </details>
          ))
        )}
      </div>
      <div className="fault-footer">
        <span>
          <Clock3 size={12} />
          {s.scanned
            ? t("Last scan: this session", "Poslednje skeniranje: ova sesija")
            : t("Not scanned", "Nije skenirano")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!s.connected || !s.faults.length}
          onClick={() => {
            setConfirmed(false);
            setClearModal(true);
          }}
        >
          {t("Clear codes", "Obriši kodove")}
          <ArrowRight />
        </Button>
      </div>
      {view === "diagnostics" && (
        <p className="panel-note">
          {t(
            "Generic modes read emissions-related codes. Full body, chassis and network scans need manufacturer-specific protocols. Permanent codes cannot be erased with Mode 04.",
            "Opšti režimi čitaju kodove emisija. Za sve sisteme potrebni su protokoli proizvođača. Trajni kodovi se ne brišu režimom 04.",
          )}
        </p>
      )}
    </section>
  );
  const clearState = s.clearHistory ? assessClearHistory(s.clearHistory) : "unknown";
  const vinInfo = s.vehicle?.vin ? decodeVinInfo(s.vehicle.vin) : null;
  const fmt = (v: number | null | undefined, unit: string) =>
    v === null || v === undefined ? "—" : `${v.toLocaleString()} ${unit}`;
  const buyerSection = (
    <section className="buyer-section">
      {sectionHeading(TriangleAlert, "Buyer check", "Provera za kupca")}
      <div className={`buyer-alert ${clearState}`}>
        <strong>
          {clearState === "recent"
            ? t("Codes were erased recently", "Greške su nedavno obrisane")
            : clearState === "ok"
              ? t("No sign of recent code erasing", "Nema znakova skorog brisanja grešaka")
              : t("Run a scan to check code erasing", "Skenirajte za proveru brisanja grešaka")}
        </strong>
        <span>
          {clearState === "recent"
            ? t(
                "The seller may be hiding a fault. Ask why, and drive the car longer before buying.",
                "Prodavac možda krije kvar. Pitajte zašto i vozite auto duže pre kupovine.",
              )
            : t(
                "Distance, engine starts and time since the last erase of fault codes.",
                "Kilometraža, broj paljenja i vreme od poslednjeg brisanja grešaka.",
              )}
        </span>
      </div>
      <div className="readiness-list">
        <div className="readiness-row">
          <span>{t("Distance since erase", "Pređeno od brisanja")}</span>
          <span>{fmt(s.clearHistory?.km, "km")}</span>
        </div>
        <div className="readiness-row">
          <span>{t("Warm-ups since erase", "Zagrevanja od brisanja")}</span>
          <span>{fmt(s.clearHistory?.warmups, "")}</span>
        </div>
        <div className="readiness-row">
          <span>{t("Engine time since erase", "Rad motora od brisanja")}</span>
          <span>{fmt(s.clearHistory?.minutes, "min")}</span>
        </div>
      </div>
      {vinInfo && (
        <div className="readiness-list">
          <div className="readiness-row">
            <span>VIN</span>
            <span className="mono">{s.vehicle?.vin}</span>
          </div>
          <div className="readiness-row">
            <span>{t("Manufacturer", "Proizvođač")}</span>
            <span>{vinInfo.manufacturer ?? t("Unknown", "Nepoznat")}</span>
          </div>
          <div className="readiness-row">
            <span>{t("Region", "Region")}</span>
            <span>{vinInfo.region ?? "—"}</span>
          </div>
          <div className="readiness-row">
            <span>{t("Model year", "Godište")}</span>
            <span>{vinInfo.years.join(" / ") || "—"}</span>
          </div>
          <div className="readiness-row">
            <span>{t("Serial number", "Serijski broj")}</span>
            <span className="mono">{vinInfo.serial}</span>
          </div>
          <div className="readiness-row">
            <span>{t("Compare with", "Uporedite sa")}</span>
            <span>{t("chassis plate and registration", "šasijom i saobraćajnom")}</span>
          </div>
        </div>
      )}
    </section>
  );
  const readinessSection = (
    <section className="readiness-section">
      {sectionHeading(
        Gauge,
        "Readiness monitors",
        "Spremnost sistema",
        <span className="ready-total">
          {readyCount}/{supported} {t("ready", "spremno")}
        </span>,
      )}
      <div className="readiness-list">
        {s.readiness.length ? (
          s.readiness.map((r) => (
            <div className="readiness-row" key={r.name}>
              <span>{language === "en" ? r.name : r.sr}</span>
              <span className={`readiness-state ${r.status}`}>
                {r.status === "ready" ? (
                  <Check />
                ) : r.status === "incomplete" ? (
                  <Clock3 />
                ) : (
                  <span>—</span>
                )}
                {statusLabel(r.status)}
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state">
            {t("Run a scan to read readiness", "Pokrenite skeniranje za očitavanje")}
          </div>
        )}
      </div>
      <div className="panel-note">
        <CircleHelp size={13} />
        {t(
          "All supported monitors must be ready for inspection.",
          "Svi podržani sistemi moraju biti spremni za pregled.",
        )}
      </div>
    </section>
  );
  return (
    <div className="cockpit">
      <aside className={`sidebar ${mobileMenu ? "is-open" : ""}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            <ScanLine />
          </span>
          AUTOSCOPE<span className="brand-dot">.</span>
        </Link>
        <span className="brand-subtitle">{t("VEHICLE INTELLIGENCE", "INTELIGENCIJA VOZILA")}</span>
        <div className="sidebar-divider" />
        <div className="workspace-label">{t("WORKSPACE", "RADNI PROSTOR")}</div>
        <nav>
          {navigation.map((n) => (
            <Button
              asChild
              variant="ghost"
              key={n.view}
              className={`nav-item ${view === n.view ? "active" : ""}`}
            >
              <Link to={n.to} aria-label={t(n.label, n.sr)} onClick={() => setMobileMenu(false)}>
                <n.icon />
                {t(n.label, n.sr)}
                {n.view === "diagnostics" && s.faults.length > 0 && (
                  <span className="nav-count">{s.faults.length}</span>
                )}
                {view === n.view && <span className="nav-active-dot" />}
              </Link>
            </Button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="simulation-box">
            <div>
              <span className="simulation-icon">
                <Zap />
              </span>
              <strong>{t("Simulation mode", "Simulacija")}</strong>
              <Switch
                aria-label={t("Simulation mode", "Simulacija")}
                checked={s.simulation}
                onCheckedChange={(v) => service.setSimulation(v)}
              />
            </div>
            <p>{t("Demo vehicle · no adapter required", "Demo vozilo · adapter nije potreban")}</p>
          </div>
          <Button variant="ghost" className="bottom-nav" onClick={() => setAdapterSettings(true)}>
            <Settings2 />
            {t("Adapter settings", "Podešavanja adaptera")}
          </Button>
          <Button variant="ghost" className="bottom-nav" onClick={() => setHelp(true)}>
            <CircleHelp />
            {t("Help & compatibility", "Pomoć i kompatibilnost")}
            <ArrowRight className="ml-auto" />
          </Button>
          <div className="sidebar-divider" />
          <div className="system-version">
            <span>
              <i />
              {t("System operational", "Sistem je operativan")}
            </span>
            <small>v1.0.0</small>
          </div>
        </div>
      </aside>
      {mobileMenu && <div className="mobile-backdrop" onClick={() => setMobileMenu(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Menu"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu />
            </Button>
            <CarFront size={17} />
            <span>{t("My vehicle", "Moje vozilo")}</span>
            <ChevronRight size={12} />
            <strong>{t(title?.label ?? "Overview", title?.sr ?? "Pregled")}</strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-pill">
              <span />
              {s.simulation
                ? t("DEMO SESSION", "DEMO SESIJA")
                : t("LIVE SESSION", "AKTIVNA SESIJA")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === "en" ? "sr" : "en")}
              aria-label={t("Switch to Serbian", "Prebaci na engleski")}
            >
              {language.toUpperCase()}
              <ChevronDown size={12} />
            </Button>
            <div className="topbar-separator" />
            <span className="avatar">AK</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span />
                {t("VEHICLE DIAGNOSTICS", "DIJAGNOSTIKA VOZILA")}
              </div>
              <h1>
                {t(
                  title?.label === "Overview" ? "Vehicle overview" : (title?.label ?? ""),
                  title?.view === "overview" ? "Pregled vozila" : (title?.sr ?? ""),
                )}
              </h1>
              <p>
                {t(
                  "A clearer picture of your vehicle. Every module, every mile.",
                  "Jasnija slika vašeg vozila. Svaki modul, svaki kilometar.",
                )}
              </p>
            </div>
            <div className="page-actions">
              <Button variant="outline" onClick={() => setExportOpen(true)} disabled={!s.connected}>
                <ArrowDownToLine />
                {t("Export report", "Izvezi izveštaj")}
              </Button>
              {scanButton}
            </div>
          </div>
          {(error || s.error) && (
            <div role="alert" className="error-banner">
              <TriangleAlert />
              {error || s.error}
              <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={() => setError("")}>
                <X />
              </Button>
            </div>
          )}
          {(view === "overview" || view === "mileage") && (
            <section className="vehicle-strip">
              <div className="vehicle-info">
                <div className="vehicle-caption">
                  <span className="vehicle-logo">VW</span>
                  <span>{t("CONNECTED VEHICLE", "POVEZANO VOZILO")}</span>
                  {s.simulation && <span className="demo-tag">DEMO</span>}
                </div>
                <h2>
                  {s.vehicle
                    ? `${s.vehicle.make} ${s.vehicle.model}`
                    : t("No vehicle connected", "Nema povezanog vozila")}
                </h2>
                <p>
                  {s.vehicle?.year ?? "—"} <i />
                  {s.vehicle?.engine ?? "—"} <i />
                  {s.vehicle?.fuel ?? "—"}
                </p>
                <div className="vin-line">
                  <span>VIN</span>
                  <code>{s.vehicle?.vin ?? "—"}</code>
                  <span className="vin-check">
                    <ShieldCheck size={13} />
                    {t("Decoded", "Dekodiran")}
                  </span>
                </div>
              </div>
              <div className="vehicle-image">
                {s.simulation ? (
                  <img
                    src={carImage}
                    width="1200"
                    height="800"
                    alt={t(
                      "Silver Volkswagen Golf demo vehicle",
                      "Srebrni Volkswagen Golf demo vozilo",
                    )}
                  />
                ) : (
                  <CarFront className="real-car-icon" />
                )}
              </div>
              <div className="vehicle-connection">
                <div>
                  <span className={`status-dot ${s.connected ? "" : "offline"}`} />
                  <strong>
                    {s.connected
                      ? t("Adapter connected", "Adapter povezan")
                      : t("Adapter disconnected", "Adapter nije povezan")}
                  </strong>
                  <Bluetooth size={16} />
                </div>
                <p>{s.adapter || t("No adapter selected", "Adapter nije izabran")}</p>
                <div className="battery-line">
                  <Battery />
                  <strong>{format(s.voltage)} V</strong>
                  <span className={voltageGood ? "good-text" : "warning-text"}>
                    {s.voltage === null
                      ? "—"
                      : voltageGood
                        ? t("Healthy battery", "Zdrav akumulator")
                        : t("Check voltage", "Proverite napon")}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    s.connected && !s.simulation
                      ? service.disconnect()
                      : run(() =>
                          service.connect(
                            uart.service && uart.notify && uart.write ? uart : undefined,
                          ),
                        )
                  }
                >
                  {s.connected && !s.simulation ? <Unplug /> : <Bluetooth />}
                  {s.connected && !s.simulation
                    ? t("Disconnect", "Prekini vezu")
                    : t("Connect OBD2", "Poveži OBD2")}
                </Button>
              </div>
            </section>
          )}
          {view === "overview" && (
            <>
              <div className="overview-top">
                {mileageSection}
                {diagnosticsSection}
              </div>
              <div className="overview-bottom">
                {telemetrySection}
                {readinessSection}
              </div>
              {buyerSection}
            </>
          )}
          {view === "mileage" && mileageSection}
          {view === "diagnostics" && (
            <>
              {diagnosticsSection}
              {identitySection}
              {buyerSection}
            </>
          )}
          {view === "telemetry" && telemetrySection}
          {view === "service" && <ServiceToolsSection />}
          {view === "readiness" && (
            <>
              {readinessSection}
              <div className="detail-controls">{scanButton}</div>
            </>
          )}
          {view === "freeze" && (
            <section>
              {sectionHeading(
                Snowflake,
                "Freeze frame snapshot",
                "Zamrznuti podaci",
                <Button
                  variant="outline"
                  disabled={!s.connected || s.busy}
                  onClick={() => run(() => service.readFreeze())}
                >
                  <RefreshCw />
                  {t("Read freeze frame", "Očitaj zamrznute podatke")}
                </Button>,
              )}
              <div className="freeze-context">
                <TriangleAlert />
                {s.simulation ? "P0401" : t("Frame 00", "Okvir 00")} ·{" "}
                {t(
                  "Sensor values captured by the ECU when a fault was recorded",
                  "Vrednosti senzora koje je ECU zabeležio pri pojavi greške",
                )}
              </div>
              <div className="freeze-grid">
                {sensors
                  .filter((item) => s.freeze[item.key] !== undefined)
                  .map((item) => (
                    <div className="freeze-item" key={item.key}>
                      <Activity />
                      <span>{language === "en" ? item.name : item.sr}</span>
                      <strong>
                        {format(s.freeze[item.key])}
                        <small>{item.unit}</small>
                      </strong>
                    </div>
                  ))}
              </div>
              {!Object.keys(s.freeze).length && (
                <div className="empty-state">
                  {t("No freeze frame available", "Zamrznuti podaci nisu dostupni")}
                </div>
              )}
            </section>
          )}
          {view === "reports" && (
            <section>
              {sectionHeading(FileText, "Session reports", "Izveštaji sesije")}
              <div className="report-preview">
                <FileText size={40} />
                <div>
                  <h2>{t("Vehicle diagnostic report", "Dijagnostički izveštaj vozila")}</h2>
                  <p>
                    {s.vehicle?.make} {s.vehicle?.model} · {s.vehicle?.vin ?? "—"}
                  </p>
                  <span className="demo-pill">
                    {s.simulation
                      ? t("SIMULATED DATA", "SIMULIRANI PODACI")
                      : t("VEHICLE DATA", "PODACI VOZILA")}
                  </span>
                </div>
                <div className="report-buttons">
                  <Button
                    disabled={!s.connected}
                    onClick={() => run(() => downloadReport(s, "pdf", language))}
                  >
                    <FileText />
                    {t("Download PDF", "Preuzmi PDF")}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!s.connected}
                    onClick={() => run(() => downloadReport(s, "json", language))}
                  >
                    <FileJson />
                    {t("Download JSON", "Preuzmi JSON")}
                  </Button>
                </div>
              </div>
            </section>
          )}
          <footer className="page-footer">
            <span>
              <ShieldCheck size={13} />
              {t(
                "Read-only diagnostics. Your vehicle stays in your control.",
                "Dijagnostika samo za čitanje. Vi kontrolišete svoje vozilo.",
              )}
            </span>
            <span>
              {t("Session data", "Podaci sesije")} ·{" "}
              {t("Not saved to cloud", "Nije sačuvano u oblaku")}
            </span>
          </footer>
        </main>
        <div className="bottom-status">
          <span>
            <span className={`status-dot ${s.connected ? "" : "offline"}`} />
            {s.connected ? "OBD-II" : t("Disconnected", "Nije povezano")}
            <span className="status-separator">|</span>
            {s.simulation ? t("Simulation active", "Simulacija aktivna") : "BLE GATT"}
            <span className="status-separator">|</span>
            {t("CAN protocol", "CAN protokol")}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setTerminal(!terminal)}>
            <Terminal />
            {t("Terminal", "Terminal")}
            <ChevronDown />
          </Button>
        </div>
      </div>
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogTitle>
            {t("Export diagnostic report", "Izvezi dijagnostički izveštaj")}
          </DialogTitle>
          <DialogDescription>
            {s.simulation
              ? t(
                  "This report contains clearly marked simulated vehicle data.",
                  "Ovaj izveštaj sadrži jasno označene simulirane podatke.",
                )
              : t(
                  "Export readings from the current session.",
                  "Izvezite očitavanja trenutne sesije.",
                )}
          </DialogDescription>
          <div className="flex gap-3">
            <Button
              onClick={() =>
                run(async () => {
                  await downloadReport(s, "pdf", language);
                  setExportOpen(false);
                })
              }
            >
              <FileText />
              PDF
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                run(async () => {
                  await downloadReport(s, "json", language);
                  setExportOpen(false);
                })
              }
            >
              <FileJson />
              JSON
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={sensorModal} onOpenChange={setSensorModal}>
        <DialogContent>
          <DialogTitle>{t("Select live sensors", "Izaberi senzore")}</DialogTitle>
          <DialogDescription>
            {t(
              "Manufacturer-specific sensors may be unavailable on your vehicle.",
              "Senzori proizvođača možda nisu dostupni za vaše vozilo.",
            )}
          </DialogDescription>
          <div className="sensor-options">
            {sensors.map((item) => (
              <label key={item.key}>
                <input
                  type="checkbox"
                  checked={selected.includes(item.key)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, item.key]
                      : selected.filter((k) => k !== item.key);
                    setSelected(next);
                    service.setSelected(next);
                    if (!next.includes(chartSensor) && next[0]) setChartSensor(next[0]);
                  }}
                />
                {language === "en" ? item.name : item.sr}
                <span>{item.unit}</span>
              </label>
            ))}
          </div>
          <Button onClick={() => setSensorModal(false)}>{t("Done", "Gotovo")}</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={clearModal} onOpenChange={setClearModal}>
        <DialogContent>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="text-warning" />
            {t("Clear diagnostic codes?", "Obrisati dijagnostičke kodove?")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "This erases stored and pending codes, freeze-frame data, and resets readiness monitors. Permanent codes remain. Save a report first. Park safely, switch the engine OFF and leave ignition ON.",
              "Ovo briše sačuvane i kodove na čekanju, zamrznute podatke i resetuje spremnost sistema. Trajni kodovi ostaju. Prvo sačuvajte izveštaj. Parkirajte bezbedno, ugasite motor i ostavite kontakt uključen.",
            )}
          </DialogDescription>
          <div className="safety-readings">
            RPM: {format(s.sensors.rpm)} · {t("Speed", "Brzina")}: {format(s.sensors.speed)} km/h
          </div>
          {s.simulation && (
            <Button variant="outline" onClick={() => service.simulateEngineOff()}>
              <Unplug />
              {t("Simulate engine off", "Simuliraj ugašen motor")}
            </Button>
          )}
          <label className="confirm-label">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t(
              "I understand and confirm the vehicle is safely parked.",
              "Razumem i potvrđujem da je vozilo bezbedno parkirano.",
            )}
          </label>
          <Button
            variant="destructive"
            disabled={!confirmed || s.sensors.rpm !== 0 || s.sensors.speed !== 0}
            onClick={() =>
              run(async () => {
                await service.clearFaults(confirmed);
                setClearModal(false);
              })
            }
          >
            {t("Confirm & clear codes", "Potvrdi i obriši kodove")}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={adapterSettings} onOpenChange={setAdapterSettings}>
        <DialogContent>
          <DialogTitle>{t("Adapter settings", "Podešavanja adaptera")}</DialogTitle>
          <DialogDescription>
            {t(
              "Common BLE UART profiles are detected automatically. For other adapters, use the exact UUIDs from the manufacturer. OBDLink MX+ is Bluetooth Classic and cannot connect through Web Bluetooth.",
              "Uobičajeni BLE UART profili se automatski otkrivaju. Za druge adaptere koristite UUID-ove proizvođača. OBDLink MX+ koristi Bluetooth Classic i ne radi sa Web Bluetooth-om.",
            )}
          </DialogDescription>
          {(["service", "notify", "write"] as const).map((key) => (
            <label className="field-label" key={key}>
              {t(
                key === "service"
                  ? "Service UUID"
                  : key === "notify"
                    ? "Notify UUID"
                    : "Write UUID",
                key === "service"
                  ? "UUID servisa"
                  : key === "notify"
                    ? "UUID obaveštenja"
                    : "UUID upisa",
              )}
              <input
                value={uart[key]}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                onChange={(e) => setUart({ ...uart, [key]: e.target.value })}
              />
            </label>
          ))}
          <Button onClick={() => setAdapterSettings(false)}>
            {t("Save for this session", "Sačuvaj za ovu sesiju")}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={profileModal} onOpenChange={setProfileModal}>
        <DialogContent className="profile-dialog">
          <DialogTitle>{t("Manufacturer UDS profiles", "UDS profili proizvođača")}</DialogTitle>
          <DialogDescription>
            {t(
              "Only enter documented read-only mileage DIDs. Big-endian integer values are multiplied by the scale. Unsupported modules stay unavailable.",
              "Unesite samo dokumentovane DID-ove kilometraže za čitanje. Vrednosti big-endian se množe faktorom. Nepodržani moduli ostaju nedostupni.",
            )}
          </DialogDescription>
          {profiles.map((p, i) => (
            <div className="profile-row" key={p.short}>
              <strong>{p.short}</strong>
              {(["header", "did", "scale"] as const).map((key) => (
                <label key={key}>
                  {key === "header" ? "CAN ID" : key === "did" ? "DID" : t("Scale", "Faktor")}
                  <input
                    aria-label={`${p.short} ${key}`}
                    placeholder={key === "header" ? "7E0" : key === "did" ? "----" : "1"}
                    value={p[key] ?? ""}
                    onChange={(e) =>
                      setProfiles(
                        profiles.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                [key]:
                                  key === "scale"
                                    ? Number(e.target.value)
                                    : e.target.value.toUpperCase(),
                              }
                            : x,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          ))}
          <Button onClick={() => setProfileModal(false)}>
            {t("Save profiles", "Sačuvaj profile")}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogTitle>
            {t("Connection & compatibility", "Povezivanje i kompatibilnost")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "Use Chrome or Edge on Android, Windows or macOS over HTTPS. On iPhone / iPad, Safari and Chrome do not support Web Bluetooth — open the app in the free Bluefy browser from the App Store. A BLE OBD2 adapter exposing a supported GATT UART is required; Bluetooth Classic-only adapters, including OBDLink MX+, are not compatible. CX and Vgate variants require matching firmware / UUIDs. Never operate diagnostics while driving. Multi-ECU mileage comparison is an indicator, not a guarantee of actual mileage.",
              "Koristite Chrome ili Edge na Android-u, Windows-u ili macOS-u uz HTTPS. Na iPhone / iPad uređajima Safari i Chrome ne podržavaju Web Bluetooth — otvorite aplikaciju u besplatnom Bluefy pregledaču iz App Store-a. Potreban je BLE OBD2 adapter sa GATT UART servisom; Bluetooth Classic adapteri, uključujući OBDLink MX+, nisu kompatibilni. CX i Vgate modeli zahtevaju odgovarajući firmver / UUID-ove. Ne koristite dijagnostiku tokom vožnje. Poređenje kilometraže je pokazatelj, a ne garancija stvarne kilometraže.",
            )}
          </DialogDescription>
        </DialogContent>
      </Dialog>
      {terminal && (
        <div className="terminal-drawer">
          <div className="terminal-heading">
            <strong>
              <Terminal />
              {t("Adapter terminal", "Terminal adaptera")}
            </strong>
            <span>{s.simulation ? "SIMULATED AT / HEX" : "AT / HEX"}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close terminal"
              onClick={() => setTerminal(false)}
            >
              <X />
            </Button>
          </div>
          <div className="terminal-lines">
            {s.logs.map((l, i) => (
              <div key={i}>
                <span>{l.time}</span>
                <strong className={l.direction === "TX" ? "text-primary" : "text-info"}>
                  {l.direction}
                </strong>
                <code>{l.text}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function ChartTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: { value?: number }[];
  unit: string;
}) {
  return active && payload?.length ? (
    <div className="chart-tooltip">
      {payload[0]?.value} {unit}
    </div>
  ) : null;
}
