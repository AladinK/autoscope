import { createContext } from "react";
import type { OBD2Service } from "@/lib/obd/service";
import type { Language } from "@/lib/obd/data";

export type CockpitContextValue = {
  service: OBD2Service;
  language: Language;
  setLanguage: (v: Language) => void;
};

// Kept in its own module so live reloads of the provider never create a second context.
export const CockpitContext = createContext<CockpitContextValue | null>(null);
