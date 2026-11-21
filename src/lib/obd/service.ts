/// <reference types="web-bluetooth" />
import {
  canClearFaults,
  decodeDtc,
  decodePid,
  decodeVin,
  decodeByte,
  decodeWord,
  formatIdentity,
  identificationDids,
  isIdentificationDid,
  parseDidResponse,
  parsePayloads,
  sensors,
  type SensorKey,
} from "./protocol";
import {
  initialSnapshot,
  makeFault,
  type DiagnosticSnapshot,
  type MileageModule,
  type ModuleIdentity,
  type Readiness,
} from "./data";
const BLE_PROFILES = [
  {
    service: "0000fff0-0000-1000-8000-00805f9b34fb",
    notify: "0000fff1-0000-1000-8000-00805f9b34fb",
    write: "0000fff2-0000-1000-8000-00805f9b34fb",
  },
  {
    service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
    notify: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
    write: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  },
];
export class OBD2Service {
  snapshot = initialSnapshot(false);
  private readonly serverSnapshot = initialSnapshot(false);
  private listeners = new Set<() => void>();
  private device: BluetoothDevice | undefined;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
  private notifyCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private pending:
    | {
        resolve: (v: string) => void;
        reject: (e: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  private buffer = "";
  private polling?: ReturnType<typeof setTimeout>;
  private tick = 0;
  private running = false;
  private selected: SensorKey[] = ["rpm", "speed", "coolant", "throttle"];
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.serverSnapshot;
  private update(patch: Partial<DiagnosticSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }
  private log(direction: string, text: string) {
    this.update({
      logs: [
        ...this.snapshot.logs.slice(-149),
        { direction, text, time: new Date().toLocaleTimeString("en-GB") },
      ],
    });
  }
  setSimulation(value: boolean) {
    this.disconnect();
    this.snapshot = initialSnapshot(value);
    this.listeners.forEach((l) => l());
    if (value) this.connectSimulation();
  }
  connectSimulation() {
    this.update({
      ...initialSnapshot(true),
      connected: true,
      adapter: "OBDLink CX · simulated",
      voltage: 14.2,
      vehicle: {
        vin: "WVWZZZAUZKW000001",
        make: "Volkswagen",
        model: "Golf VII",
        year: "2019",
        engine: "2.0 TDI · 150 hp",
        fuel: "Diesel",
        protocol: "ISO 15765-4 CAN (11 bit, 500 kbaud)",
      },
      faults: [makeFault("P0401", "stored"), makeFault("P0101", "pending")],
      scanned: true,
      clearHistory: { km: 38, warmups: 3, minutes: 47 },
      mileage: [
        { name: "Instrument cluster", short: "IPC", mileage: 142580 },
        { name: "Engine control", short: "ECM", mileage: 142612 },
        { name: "Transmission", short: "TCM", mileage: 142594 },
        { name: "ABS / ESP", short: "ABS", mileage: 142580 },
      ],
      dashboardMileage: 142580,
      hours: 3246,
      regenerations: 287,
      readiness: [
        { name: "Catalytic converter", sr: "Katalizator", status: "ready" },
        { name: "Oxygen sensor", sr: "Senzor kiseonika", status: "ready" },
        { name: "Oxygen sensor heater", sr: "Grejač senzora kiseonika", status: "ready" },
        { name: "EGR / VVT system", sr: "EGR / VVT sistem", status: "incomplete" },
        { name: "DPF / particulate filter", sr: "DPF / filter čestica", status: "ready" },
        { name: "Evaporative system", sr: "Sistem isparavanja", status: "unsupported" },
      ],
      freeze: {
        rpm: 2184,
        speed: 68,
        coolant: 89,
        intake: 27,
        maf: 24.6,
        throttle: 32.2,
        stft: 2.3,
        ltft: -1.6,
      },
      updated: new Date().toISOString(),
    });
    for (const command of ["ATZ", "ATE0", "ATL0", "ATS0", "ATH1", "ATSP0", "ATRV"]) {
      this.log("TX", command);
      this.log("RX", command === "ATRV" ? "14.2V" : "OK");
    }
    this.startPolling();
  }
  async connect(custom?: { service: string; notify: string; write: string }) {
    if (typeof navigator === "undefined" || !navigator.bluetooth)
      throw new Error(
        "Web Bluetooth is unavailable in this browser. On iPhone / iPad, open this app in the free Bluefy browser. On Android / desktop use Chrome or Edge. Bluetooth Classic-only adapters are not supported.",
      );
    this.disconnect();
    this.update({ ...initialSnapshot(false), busy: true });
    const profiles = custom ? [custom, ...BLE_PROFILES] : BLE_PROFILES;
    try {
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: profiles.map((p) => p.service),
      });
      this.device.addEventListener("gattserverdisconnected", this.onDisconnect);
      const server = await this.device.gatt?.connect();
      if (!server) throw new Error("Adapter has no GATT server.");
      for (const profile of profiles) {
        try {
          const service = await server.getPrimaryService(profile.service);
          const chars = await service.getCharacteristics();
          this.notifyCharacteristic =
            chars.find(
              (c) => c.uuid === profile.notify && (c.properties.notify || c.properties.indicate),
            ) ?? chars.find((c) => c.properties.notify || c.properties.indicate);
          this.writeCharacteristic =
            chars.find(
              (c) =>
                c.uuid === profile.write &&
                (c.properties.write || c.properties.writeWithoutResponse),
            ) ?? chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
          if (this.notifyCharacteristic && this.writeCharacteristic) break;
        } catch {
          /* Try the next explicitly permitted UART service. */
        }
      }
      if (!this.notifyCharacteristic || !this.writeCharacteristic)
        throw new Error(
          "No supported BLE UART service found. Enter the adapter’s documented GATT UUIDs in Adapter settings.",
        );
      await this.notifyCharacteristic.startNotifications();
      this.notifyCharacteristic.addEventListener("characteristicvaluechanged", this.onNotification);
      this.update({ connected: true, adapter: this.device.name || "BLE OBD2 adapter" });
      for (const command of ["ATZ", "ATE0", "ATL0", "ATS0", "ATH1", "ATSP0"]) {
        const response = await this.command(command);
        if (/\?|ERROR|UNABLE TO CONNECT/i.test(response))
          throw new Error(`Adapter initialization failed: ${command}`);
      }
      const voltage = parseFloat(await this.command("ATRV"));
      this.update({ voltage: Number.isFinite(voltage) ? voltage : null });
      const vin = decodeVin(await this.command("0902"));
      if (vin) {
        this.update({
          vehicle: {
            vin,
            make: "Unknown",
            model: "Unknown",
            year: "—",
            engine: "—",
            fuel: "—",
            protocol: "Automatic OBD-II",
          },
        });
        // Public VIN decoding is optional and never substitutes simulated vehicle data.
        try {
          const response = await fetch(
            `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`,
            { signal: AbortSignal.timeout(8000) },
          );
          const result = (await response.json()).Results?.[0];
          if (result)
            this.update({
              vehicle: {
                vin,
                make: result.Make || "Unknown",
                model: result.Model || "Unknown",
                year: result.ModelYear || "—",
                engine: result.DisplacementL ? `${result.DisplacementL} L` : "—",
                fuel: result.FuelTypePrimary || "—",
                protocol: "Automatic OBD-II",
              },
            });
        } catch {
          this.log("INFO", "VIN decoder unavailable; raw VIN retained.");
        }
      }
      this.startPolling();
    } catch (e) {
      this.disconnect();
      this.update({ error: e instanceof Error ? e.message : "Connection failed" });
      throw e;
    } finally {
      this.update({ busy: false });
    }
  }
  private onDisconnect = () => {
    this.stopPolling();
    this.pending?.reject(new Error("Adapter disconnected"));
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = undefined;
    this.update({ connected: false, busy: false });
  };
  disconnect() {
    this.stopPolling();
    this.notifyCharacteristic?.removeEventListener(
      "characteristicvaluechanged",
      this.onNotification,
    );
    this.device?.removeEventListener("gattserverdisconnected", this.onDisconnect);
    this.device?.gatt?.disconnect();
    this.onDisconnect();
    this.writeCharacteristic = undefined;
    this.notifyCharacteristic = undefined;
  }
  private onNotification = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;
    this.buffer += new TextDecoder().decode(value);
    if (this.buffer.includes(">") && this.pending) {
      const response = this.buffer.slice(0, this.buffer.indexOf(">"));
      this.buffer = "";
      clearTimeout(this.pending.timer);
      const pending = this.pending;
      this.pending = undefined;
      this.log("RX", response.trim());
      pending.resolve(response);
    }
  };
  command(text: string): Promise<string> {
    if (!/^[A-Z0-9 ]{2,40}$/i.test(text)) return Promise.reject(new Error("Invalid OBD command."));
    const execute = async () => {
      if (this.snapshot.simulation) {
        this.log("TX", text);
        this.log("RX", "SIMULATION");
        return "SIMULATION";
      }
      const characteristic = this.writeCharacteristic;
      if (!this.snapshot.connected || !characteristic) throw new Error("Connect an adapter first.");
      this.log("TX", text);
      this.buffer = "";
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending = undefined;
          reject(new Error(`Adapter timeout: ${text}. Reconnect before retrying.`));
          this.disconnect();
        }, 12000);
        this.pending = { resolve, reject, timer };
        const bytes = new TextEncoder().encode(text + "\r");
        const write = characteristic.properties.write
          ? characteristic.writeValueWithResponse(bytes)
          : characteristic.writeValueWithoutResponse(bytes);
        write.catch((error) => {
          clearTimeout(timer);
          this.pending = undefined;
          reject(error);
        });
      });
    };
    const result = this.queue.then(execute);
    this.queue = result.catch(() => undefined);
    return result;
  }
  async readSensor(key: SensorKey, mode = "01"): Promise<number | null> {
    const sensor = sensors.find((s) => s.key === key);
    if (!sensor?.pid) return null;
    const raw = await this.command(`${mode}${sensor.pid}${mode === "02" ? "00" : ""}`);
    const payload = parsePayloads(raw).find(
      (p) => p[0] === parseInt(mode, 16) + 0x40 && p[1] === parseInt(sensor.pid ?? "", 16),
    );
    return payload ? decodePid(sensor.pid, payload.slice(mode === "02" ? 3 : 2)) : null;
  }
  setSelected(keys: SensorKey[]) {
    this.selected = keys;
  }
  startPolling() {
    this.stopPolling();
    this.running = true;
    const poll = async () => {
      if (!this.running || !this.snapshot.connected) return;
      try {
        let values = { ...this.snapshot.sensors };
        if (this.snapshot.simulation) {
          this.tick++;
          const wave = Math.sin(this.tick * 0.37);
          values = {
            rpm: Math.round(820 + wave * 34),
            speed: 0,
            coolant: Math.round(89 + Math.sin(this.tick * 0.08)),
            intake: 26,
            maf: +(6.2 + wave * 0.3).toFixed(1),
            throttle: +(12.4 + wave * 0.5).toFixed(1),
            stft: 2.3,
            ltft: -1.6,
            boost: 0,
            soot: 24,
          };
        } else {
          for (const key of this.selected) {
            if (!this.running) return;
            const value = await this.readSensor(key);
            if (value !== null) values[key] = value;
            else delete values[key];
          }
        }
        if (this.running)
          this.update({
            sensors: values,
            history: [...this.snapshot.history.slice(-29), { time: this.tick++, ...values }],
            updated: new Date().toISOString(),
          });
      } catch (e) {
        this.update({ error: e instanceof Error ? e.message : "Polling failed" });
      }
      if (this.running) this.polling = setTimeout(poll, 1400);
    };
    void poll();
  }
  stopPolling() {
    this.running = false;
    if (this.polling) clearTimeout(this.polling);
  }
  async scan() {
    this.update({ busy: true, error: null });
    this.stopPolling();
    try {
      if (this.snapshot.simulation) {
        await new Promise((r) => setTimeout(r, 1200));
        this.update({
          faults: [makeFault("P0401", "stored"), makeFault("P0101", "pending")],
          scanned: true,
          clearHistory: { km: 38, warmups: 3, minutes: 47 },
        });
      } else {
        const faults = [];
        for (const [mode, status] of [
          ["03", "stored"],
          ["07", "pending"],
          ["0A", "permanent"],
        ] as const) {
          for (const payload of parsePayloads(await this.command(mode)).filter(
            (p) => p[0] === parseInt(mode, 16) + 0x40,
          ))
            faults.push(...decodeDtc(payload.slice(1)).map((code) => makeFault(code, status)));
        }
        this.update({ faults, scanned: true });
        await this.readReadiness();
        await this.readClearHistory();
      }
      this.update({ updated: new Date().toISOString() });
    } finally {
      this.update({ busy: false });
      if (this.snapshot.connected) this.startPolling();
    }
  }
  async clearFaults(confirmed: boolean) {
    if (
      !canClearFaults(
        confirmed,
        this.snapshot.sensors.speed ?? null,
        this.snapshot.sensors.rpm ?? null,
      )
    )
      throw new Error(
        "Clearing requires confirmation, vehicle speed 0, and engine RPM 0. Switch the engine off and keep ignition on.",
      );
    this.stopPolling();
    try {
      // Fresh readings protect against stale UI values on a physical vehicle.
      if (
        !this.snapshot.simulation &&
        !canClearFaults(confirmed, await this.readSensor("speed"), await this.readSensor("rpm"))
      )
        throw new Error("Vehicle must be stationary with the engine off.");
      const response = await this.command("04");
      if (!this.snapshot.simulation && !parsePayloads(response).some((p) => p[0] === 0x44))
        throw new Error("The ECU did not confirm fault clearing.");
      this.update({
        faults: this.snapshot.faults.filter((f) => f.status === "permanent"),
        readiness: this.snapshot.readiness.map((r) => ({
          ...r,
          status: r.status === "unsupported" ? "unsupported" : "incomplete",
        })),
        freeze: {},
      });
    } finally {
      if (this.snapshot.connected) this.startPolling();
    }
  }
  simulateEngineOff() {
    if (this.snapshot.simulation) {
      this.stopPolling();
      this.update({ sensors: { ...this.snapshot.sensors, rpm: 0, speed: 0 } });
    }
  }
  /** PIDs 30, 31 and 4E: warm-ups, distance and minutes since codes were last cleared. */
  async readClearHistory() {
    if (this.snapshot.simulation) return;
    const safe = async (cmd: string) => {
      try {
        return await this.command(cmd);
      } catch {
        return "";
      }
    };
    this.update({
      clearHistory: {
        warmups: decodeByte(await safe("0130"), 0x30),
        km: decodeWord(await safe("0131"), 0x31),
        minutes: decodeWord(await safe("014E"), 0x4e),
      },
    });
  }
  async readReadiness() {
    if (this.snapshot.simulation) return;
    const p = parsePayloads(await this.command("0101")).find((p) => p[0] === 0x41 && p[1] === 0x01);
    if (!p || p.length < 6) return;
    const diesel = Boolean((p[3] ?? 0) & 8);
    const labels = diesel
      ? [
          ["NMHC catalyst", "NMHC katalizator", 0],
          ["NOx / SCR", "NOx / SCR", 1],
          ["Boost pressure", "Turbo pritisak", 3],
          ["Exhaust gas sensor", "Senzor izduvnih gasova", 4],
          ["DPF / particulate filter", "DPF / filter čestica", 5],
          ["EGR / VVT system", "EGR / VVT sistem", 6],
        ]
      : [
          ["Catalytic converter", "Katalizator", 0],
          ["Heated catalyst", "Grejani katalizator", 1],
          ["Evaporative system", "Sistem isparavanja", 2],
          ["Oxygen sensor", "Senzor kiseonika", 5],
          ["Oxygen sensor heater", "Grejač senzora kiseonika", 6],
          ["EGR / VVT system", "EGR / VVT sistem", 7],
        ];
    const readiness: Readiness[] = labels.map(([name, sr, bit]) => ({
      name: String(name),
      sr: String(sr),
      status: !((p[4] ?? 0) & (1 << Number(bit)))
        ? "unsupported"
        : (p[5] ?? 0) & (1 << Number(bit))
          ? "incomplete"
          : "ready",
    }));
    this.update({ readiness });
  }
  async readFreeze() {
    if (this.snapshot.simulation) return;
    this.stopPolling();
    this.update({ busy: true });
    try {
      const freeze: Partial<Record<SensorKey, number>> = {};
      for (const sensor of sensors.filter((s) => s.pid)) {
        const v = await this.readSensor(sensor.key, "02");
        if (v !== null) freeze[sensor.key] = v;
      }
      this.update({ freeze });
    } finally {
      this.update({ busy: false });
      if (this.snapshot.connected) this.startPolling();
    }
  }
  /**
   * Read-only module identification. Sends ATSH and ReadDataByIdentifier (0x22) requests for the
   * standard identification DIDs only: no writes, routines, security access or session changes.
   */
  async readModuleIdentity(headers: string[]): Promise<ModuleIdentity[]> {
    const modules = headers.map((h) => h.trim().toUpperCase()).filter((h) => h !== "");
    if (modules.length === 0) throw new Error("Enter at least one CAN ID, for example 7E0.");
    if (modules.some((h) => !/^[0-9A-F]{3}$/.test(h)))
      throw new Error("A CAN ID has three hexadecimal digits, for example 7E0.");
    if (this.snapshot.simulation)
      throw new Error(
        "Module identification needs a connected adapter. Simulation has no real readings.",
      );
    if (!this.snapshot.connected) throw new Error("Connect an adapter first.");
    this.stopPolling();
    this.update({ busy: true, error: null });
    const identities: ModuleIdentity[] = [];
    try {
      for (const header of modules) {
        await this.command(`ATSH${header}`);
        const identity: ModuleIdentity = {
          header,
          responded: false,
          vin: null,
          partNumber: null,
          softwareNumber: null,
          softwareVersion: null,
          hardwareNumber: null,
          serial: null,
        };
        for (const { did, field } of identificationDids) {
          const data = await this.readIdentifier(did);
          if (!data) continue;
          identity.responded = true;
          identity[field] = formatIdentity(data);
        }
        identities.push(identity);
      }
      this.update({ identities, updated: new Date().toISOString() });
    } finally {
      await this.command("ATSH7DF").catch(() => undefined);
      this.update({ busy: false });
      if (this.snapshot.connected) this.startPolling();
    }
    return identities;
  }
  /** The only place identity reads send a request; refuses any DID outside the identification list. */
  private async readIdentifier(did: string): Promise<number[] | null> {
    if (!isIdentificationDid(did))
      throw new Error(`Refusing to request non-identification DID ${did}.`);
    return parseDidResponse(await this.command(`22${did}`), did);
  }
  setDashboardMileage(value: number | null) {
    this.update({ dashboardMileage: value });
  }
  async verifyMileage(profiles: MileageModule[]) {
    if (this.snapshot.simulation) {
      this.update({ busy: true });
      await new Promise((r) => setTimeout(r, 1000));
      this.update({ busy: false, updated: new Date().toISOString() });
      return;
    }
    this.stopPolling();
    this.update({ busy: true });
    const mileage: MileageModule[] = [];
    try {
      for (const profile of profiles) {
        let value: number | null = null;
        if (
          profile.header &&
          /^[0-9A-F]{3}$/i.test(profile.header) &&
          profile.did &&
          /^[0-9A-F]{4}$/i.test(profile.did) &&
          profile.scale &&
          profile.scale > 0
        ) {
          await this.command(`ATSH${profile.header}`);
          const payload = parsePayloads(await this.command(`22${profile.did}`)).find(
            (p) =>
              p[0] === 0x62 &&
              p[1] === parseInt(profile.did?.slice(0, 2) ?? "", 16) &&
              p[2] === parseInt(profile.did?.slice(2) ?? "", 16),
          );
          if (payload && payload.length > 3)
            value = payload.slice(3).reduce((acc, b) => acc * 256 + b, 0) * profile.scale;
        }
        mileage.push({ ...profile, mileage: value });
      }
      this.update({ mileage, updated: new Date().toISOString() });
    } finally {
      try {
        await this.command("ATSH7DF");
      } finally {
        this.update({ busy: false });
        if (this.snapshot.connected) this.startPolling();
      }
    }
  }
}
