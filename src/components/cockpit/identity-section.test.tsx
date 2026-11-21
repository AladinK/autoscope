import { render, screen } from "@testing-library/react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { OBD2Service } from "@/lib/obd/service";
import { CockpitContext } from "./context";
import { Dashboard } from "./dashboard";

function renderDiagnostics(service: OBD2Service) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const diagnosticsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/diagnostics",
    component: () => <Dashboard view="diagnostics" />,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([diagnosticsRoute]),
    history: createMemoryHistory({ initialEntries: ["/diagnostics"] }),
  });
  return render(
    <CockpitContext.Provider value={{ service, language: "en", setLanguage: () => undefined }}>
      <RouterProvider router={router} />
    </CockpitContext.Provider>,
  );
}

describe("module identification section", () => {
  it("shows what each module reported and flags a VIN that differs from the vehicle", async () => {
    const service = new OBD2Service();
    service.snapshot = {
      ...service.snapshot,
      connected: true,
      vehicle: {
        vin: "WVWZZZAUZKW000001",
        make: "Volkswagen",
        model: "Golf VII",
        year: "2019",
        engine: "2.0 TDI",
        fuel: "Diesel",
        protocol: "ISO 15765-4 CAN",
      },
      identities: [
        {
          header: "7E0",
          responded: true,
          vin: "WVWZZZAUZKW000002",
          partNumber: "04L906022",
          softwareNumber: null,
          softwareVersion: "1.00",
          hardwareNumber: null,
          serial: null,
        },
      ],
    };
    renderDiagnostics(service);

    expect(await screen.findByText("CAN 7E0")).toBeInTheDocument();
    expect(screen.getByText("Responded")).toBeInTheDocument();
    expect(screen.getByText("WVWZZZAUZKW000002")).toBeInTheDocument();
    expect(screen.getByText("04L906022")).toBeInTheDocument();
    expect(screen.getByText("VIN mismatch")).toBeInTheDocument();
  });

  it("does not warn when the module VIN matches the vehicle", async () => {
    const service = new OBD2Service();
    service.snapshot = {
      ...service.snapshot,
      connected: true,
      vehicle: {
        vin: "WVWZZZAUZKW000001",
        make: "Volkswagen",
        model: "Golf VII",
        year: "2019",
        engine: "2.0 TDI",
        fuel: "Diesel",
        protocol: "ISO 15765-4 CAN",
      },
      identities: [
        {
          header: "7E0",
          responded: true,
          vin: "WVWZZZAUZKW000001",
          partNumber: null,
          softwareNumber: null,
          softwareVersion: null,
          hardwareNumber: null,
          serial: null,
        },
      ],
    };
    renderDiagnostics(service);

    expect(await screen.findByText("CAN 7E0")).toBeInTheDocument();
    expect(screen.queryByText("VIN mismatch")).not.toBeInTheDocument();
  });
});
