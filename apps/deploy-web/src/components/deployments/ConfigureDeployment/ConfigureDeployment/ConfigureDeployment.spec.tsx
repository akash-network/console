import { useFormContext, useWatch } from "react-hook-form";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import sdlStore from "@src/store/sdlStore";
import type { SdlBuilderFormValuesType, TemplateCreation } from "@src/types";
import { defaultService } from "@src/utils/sdl/data";
import type { DEPENDENCIES } from "./ConfigureDeployment";
import { ConfigureDeployment } from "./ConfigureDeployment";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const VALID_SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx:1.0",
  "    expose:",
  "      - port: 80",
  "        as: 80",
  "        to:",
  "          - global: true",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        web:",
  "          denom: uact",
  "          amount: 1000",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 1"
].join("\n");

const TWO_SERVICE_SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx:1.0",
  "    expose:",
  "      - port: 80",
  "        as: 80",
  "        to:",
  "          - global: true",
  "  api:",
  "    image: node:18",
  "    expose:",
  "      - port: 3000",
  "        as: 3000",
  "        to:",
  "          - global: true",
  "profiles:",
  "  compute:",
  "    web:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "    api:",
  "      resources:",
  "        cpu:",
  "          units: 0.5",
  "        memory:",
  "          size: 512Mi",
  "        storage:",
  "          - size: 512Mi",
  "  placement:",
  "    dcloud:",
  "      pricing:",
  "        web:",
  "          denom: uact",
  "          amount: 1000",
  "        api:",
  "          denom: uact",
  "          amount: 1000",
  "deployment:",
  "  web:",
  "    dcloud:",
  "      profile: web",
  "      count: 1",
  "  api:",
  "    dcloud:",
  "      profile: api",
  "      count: 1"
].join("\n");

describe("ConfigureDeployment", () => {
  it("seeds the panes with the carried-in template SDL", () => {
    const { ConfigureDeploymentPanes } = setup({
      deploySdl: mock<TemplateCreation>({ content: 'version: "2.0"' })
    });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ sdl: 'version: "2.0"' }), expect.anything());
  });

  it("generates the SDL of the default deployment when no template was carried in", () => {
    const { ConfigureDeploymentPanes } = setup({ deploySdl: null });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ sdl: expect.stringContaining('version: "2.0"') }), expect.anything());
  });

  it("selects the first service from the imported template", () => {
    const { ConfigureDeploymentPanes } = setup({ deploySdl: mock<TemplateCreation>({ content: VALID_SDL }) });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ selectedServiceId: expect.any(String) }), expect.anything());
  });

  it("hydrates the deployment pane with the imported template's services", () => {
    setup({ deploySdl: mock<TemplateCreation>({ content: TWO_SERVICE_SDL }), Panes: ServiceListProbePanes });

    expect(screen.getByTestId("service-titles").textContent).toBe("web,api");
  });

  it("surfaces an error and falls back to a default when the carried-in SDL cannot be imported", () => {
    const { ConfigureDeploymentPanes, enqueueSnackbar } = setup({ deploySdl: mock<TemplateCreation>({ content: "services: [unclosed" }) });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(
      expect.objectContaining({ sdl: expect.stringContaining('version: "2.0"'), selectedServiceId: expect.any(String) }),
      expect.anything()
    );
  });

  it("starts with a default service selected when no template was carried in", () => {
    const { ConfigureDeploymentPanes } = setup({ deploySdl: null });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ selectedServiceId: expect.any(String) }), expect.anything());
  });

  it("regenerates the SDL preview when the form changes", async () => {
    setup({ deploySdl: null, Panes: SdlProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "change image" }));

    await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("nginx:latest"));
  });

  it("reselects the first remaining service when the selected one is removed", async () => {
    setup({ deploySdl: null, Panes: SelectionProbePanes });
    const initialSelectedId = screen.getByTestId("selected").textContent;

    await userEvent.click(screen.getByRole("button", { name: "replace services" }));

    await waitFor(() => {
      expect(screen.getByTestId("selected").textContent).not.toBe(initialSelectedId);
      expect(screen.getByTestId("selected").textContent).toBe(screen.getByTestId("first-service-id").textContent);
    });
  });

  function setup(input: { deploySdl: TemplateCreation | null; Panes?: typeof SdlProbePanes }) {
    const ConfigureDeploymentPanes = vi.fn(input.Panes ?? (() => <div data-testid="panes-mock" />));
    const enqueueSnackbar = vi.fn();
    const Snackbar = vi.fn(() => null);
    const dependencies: typeof DEPENDENCIES = {
      Layout: vi.fn(({ children }) => <div data-testid="layout-mock">{children}</div>) as never,
      NextSeo: vi.fn(() => null) as never,
      ConfigureDeploymentHeader: vi.fn(() => <div data-testid="header-mock" />),
      ConfigureDeploymentPanes: ConfigureDeploymentPanes as never,
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      Snackbar: Snackbar as never
    };
    const store = createStore();
    store.set(sdlStore.deploySdl, input.deploySdl);

    render(
      <JotaiStoreProvider store={store}>
        <ConfigureDeployment dependencies={dependencies} />
      </JotaiStoreProvider>
    );

    return { ConfigureDeploymentPanes, enqueueSnackbar };
  }
});

interface ProbePanesProps {
  sdl: string;
  selectedServiceId: string | null;
}

/** Panes stand-in that mutates the shared form to drive the SDL preview subscription. */
function SdlProbePanes({ sdl }: ProbePanesProps) {
  const { setValue } = useFormContext<SdlBuilderFormValuesType>();
  return (
    <div>
      <div data-testid="sdl">{sdl}</div>
      <button type="button" onClick={() => setValue("services.0.image", "nginx:latest")}>
        change image
      </button>
    </div>
  );
}

/** Panes stand-in that reports the imported services so hydration can be asserted. */
function ServiceListProbePanes() {
  const services = useWatch<SdlBuilderFormValuesType>({ name: "services" });
  const titles = Array.isArray(services) ? (services as SdlBuilderFormValuesType["services"]).map(service => service.title) : [];
  return <div data-testid="service-titles">{titles.join(",")}</div>;
}

/** Panes stand-in that swaps out the services to drive the reselection subscription. */
function SelectionProbePanes({ selectedServiceId }: ProbePanesProps) {
  const { setValue, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const services = useWatch<SdlBuilderFormValuesType>({ name: "services" });
  const firstServiceId = Array.isArray(services) ? (services as SdlBuilderFormValuesType["services"])[0]?.id : undefined;
  return (
    <div>
      <div data-testid="selected">{selectedServiceId ?? ""}</div>
      <div data-testid="first-service-id">{firstServiceId ?? ""}</div>
      <button type="button" onClick={() => setValue("services", [defaultService(getValues("placements")[0].id, { title: "service-2" })])}>
        replace services
      </button>
    </div>
  );
}
