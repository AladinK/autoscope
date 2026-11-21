import {
  useContext,
  useState,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { OBD2Service } from "@/lib/obd/service";
import type { Language } from "@/lib/obd/data";
import { CockpitContext as Context } from "./context";
export function CockpitProvider({ children }: { children: ReactNode }) {
  const [service] = useState(() => new OBD2Service());
  const [language, setLanguage] = useState<Language>("en");
  useEffect(() => {
    return () => service.disconnect();
  }, [service]);
  return <Context.Provider value={{ service, language, setLanguage }}>{children}</Context.Provider>;
}
export function useCockpit() {
  const context = useContext(Context);
  if (!context) throw new Error("Cockpit provider missing");
  const snapshot = useSyncExternalStore(
    context.service.subscribe,
    context.service.getSnapshot,
    context.service.getServerSnapshot,
  );
  return {
    ...context,
    snapshot,
    t: (en: string, sr: string) => (context.language === "en" ? en : sr),
  };
}
