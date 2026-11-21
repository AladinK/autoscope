import { useState } from "react";
import { Ban, Check, CircleHelp, Lock, Wrench, X } from "lucide-react";
import { useCockpit } from "./provider";
import { brands, prechecksPass, routineFor, servicePrechecks, serviceTools, type Brand } from "@/lib/obd/service-tools";

export function ServiceToolsSection() {
  const { snapshot: s, language, t } = useCockpit();
  const [brand, setBrand] = useState<Brand>("vag");
  const input = {
    voltage: s.voltage,
    rpm: s.sensors.rpm ?? null,
    speed: s.sensors.speed ?? null,
    coolant: s.sensors.coolant ?? null,
  };
  return (
    <section className="service-section">
      <div className="section-heading">
        <Wrench size={18} />
        <h2>{t("Service tools", "Servisni alati")}</h2>
      </div>
      <div className="service-brands" role="tablist">
        {brands.map((b) => (
          <button key={b.id} role="tab" aria-selected={brand === b.id} className={`service-brand ${brand === b.id ? "active" : ""}`} onClick={() => setBrand(b.id)}>
            {b.label}
          </button>
        ))}
      </div>
      <div className="service-grid">
        {serviceTools.map((tool) => {
          const checks = servicePrechecks(tool.id, input);
          const routine = routineFor(tool.id, brand);
          return (
            <article className="service-card" key={tool.id}>
              <h3>{language === "en" ? tool.name : tool.sr}</h3>
              <p>{language === "en" ? tool.purpose : tool.purposeSr}</p>
              <ul className="service-checks">
                {checks.map((c) => (
                  <li key={c.key} className={c.ok === true ? "ok" : c.ok === false ? "bad" : "unknown"}>
                    {c.ok === true ? <Check size={14} /> : c.ok === false ? <X size={14} /> : <CircleHelp size={14} />}
                    {language === "en" ? c.en : c.sr}
                  </li>
                ))}
              </ul>
              <button className="service-run" disabled={!routine || !s.connected || s.simulation || !prechecksPass(checks)}>
                <Lock size={14} />
                {routine ? t("Run procedure", "Pokreni proceduru") : t("Locked — no verified ECU profile", "Zaključano — nema proverenog ECU profila")}
              </button>
            </article>
          );
        })}
      </div>
      <div className="buyer-alert recent">
        <Ban size={16} />
        {t(
          "EGR / DPF software removal is not offered: it is illegal emissions tampering in Serbia and the EU and fails technical inspection.",
          "Softversko gašenje EGR i DPF nije ponuđeno: to je nezakonito diranje emisije u Srbiji i EU i auto pada tehnički pregled.",
        )}
      </div>
      <div className="panel-note">
        <CircleHelp size={13} />
        {t(
          "Procedures unlock only after a manufacturer routine is verified on a real car. Safety checks use live adapter readings.",
          "Procedure se otključavaju tek kada se proizvođačka rutina proveri na pravom autu. Bezbednosne provere koriste žive podatke sa adaptera.",
        )}
      </div>
    </section>
  );
}
