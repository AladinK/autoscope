import type { DiagnosticSnapshot, Language } from "./data";
import { integrity } from "./protocol";
export async function downloadReport(
  snapshot: DiagnosticSnapshot,
  format: "json" | "pdf",
  language: Language,
) {
  const report = {
    generatedAt: new Date().toISOString(),
    language,
    source: snapshot.simulation ? "SIMULATED DATA — NOT A VEHICLE VERIFICATION" : "BLE OBD-II",
    vehicle: snapshot.vehicle,
    mileage: snapshot.mileage,
    dashboardMileage: snapshot.dashboardMileage,
    integrity: integrity(
      snapshot.dashboardMileage,
      snapshot.mileage.map((m) => m.mileage),
    ),
    engineHours: snapshot.hours,
    dpfRegenerations: snapshot.regenerations,
    faults: snapshot.faults,
    readiness: snapshot.readiness,
    sensors: snapshot.sensors,
    freezeFrame: snapshot.freeze,
    disclaimer:
      language === "en"
        ? "ECU agreement is not proof of true mileage. Manufacturer-specific data requires validated DID profiles. Generic OBD does not cover all vehicle systems."
        : "Slaganje ECU podataka nije dokaz stvarne kilometraze. Potrebni su provereni profili proizvodjaca. OBD ne pokriva sve sisteme.",
  };
  if (format === "json") {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `autoscope-report-${snapshot.simulation ? "demo" : (snapshot.vehicle?.vin ?? "vehicle")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    // Standard PDF fonts do not support Serbian diacritics; transliterate for reliable exports.
    const ascii = (s: string) =>
      s
        .replace(/đ/g, "dj")
        .replace(/Đ/g, "Dj")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const lines = [
      language === "en" ? "AUTOSCOPE | Diagnostic report" : "AUTOSCOPE | Dijagnosticki izvestaj",
      report.generatedAt,
      report.source,
      "",
      `VIN: ${snapshot.vehicle?.vin ?? "Unknown"}`,
      `${snapshot.vehicle?.make ?? ""} ${snapshot.vehicle?.model ?? ""}`,
      "",
      language === "en" ? "MILEAGE COMPARISON" : "POREDJENJE KILOMETRAZE",
      ...snapshot.mileage.map((m) => `${m.short}: ${m.mileage ?? "N/A"} km`),
      `${language === "en" ? "Dashboard" : "Instrument tabla"}: ${snapshot.dashboardMileage ?? "N/A"} km`,
      `${language === "en" ? "Integrity status" : "Status"}: ${report.integrity.level}`,
      "",
      language === "en" ? "FAULT CODES" : "KODOVI GRESAKA",
      ...snapshot.faults.map(
        (f) => `${f.code} [${f.status}] ${language === "en" ? f.description : f.sr}`,
      ),
      "",
      language === "en" ? "READINESS" : "SPREMNOST",
      ...snapshot.readiness.map((r) => `${language === "en" ? r.name : r.sr}: ${r.status}`),
      "",
      language === "en" ? "LIVE SENSORS" : "SENZORI",
      ...Object.entries(snapshot.sensors).map(([key, value]) => `${key}: ${value}`),
      "",
      language === "en" ? "FREEZE FRAME" : "ZAMRZNUTI PODACI",
      ...Object.entries(snapshot.freeze).map(([key, value]) => `${key}: ${value}`),
      "",
      report.disclaimer,
    ];
    let y = 20;
    pdf.setFontSize(10);
    for (const line of lines) {
      for (const segment of pdf.splitTextToSize(ascii(line), 175)) {
        if (y > 278) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(segment, 18, y);
        y += 6;
      }
    }
    pdf.save("autoscope-diagnostic-report.pdf");
  }
}
