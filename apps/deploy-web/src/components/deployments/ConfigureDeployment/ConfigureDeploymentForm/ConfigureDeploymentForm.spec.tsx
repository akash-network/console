import { useFormContext, useWatch } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultService } from "@src/utils/sdl/data";
import { usePlacementManager } from "../DeploymentPane/usePlacementManager/usePlacementManager";
import type { DEPENDENCIES } from "./ConfigureDeploymentForm";
import { ConfigureDeploymentForm, firstBidReadyServiceId, nextUndoneServiceId } from "./ConfigureDeploymentForm";

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

describe(ConfigureDeploymentForm.name, () => {
  it("seeds the panes with the carried-in template SDL", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: VALID_SDL });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ sdl: VALID_SDL }), expect.anything());
  });

  it("threads both the live sdl and the debounced preview sdl into the panes", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: VALID_SDL });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ sdl: VALID_SDL, previewSdl: VALID_SDL }), expect.anything());
  });

  it("falls back to a default deployment when the carried-in SDL has no services", () => {
    const { ConfigureDeploymentPanes, enqueueSnackbar } = setup({ initialSdl: 'version: "2.0"' });

    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(
      expect.objectContaining({ sdl: expect.stringContaining('version: "2.0"'), selectedServiceId: expect.any(String) }),
      expect.anything()
    );
  });

  it("generates the SDL of the default deployment when no SDL was provided", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: undefined });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ sdl: expect.stringContaining('version: "2.0"') }), expect.anything());
  });

  it("seeds a fresh deployment on the small hardware preset (1 vCPU / 2Gi / 10Gi)", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: undefined });

    const sdl = ConfigureDeploymentPanes.mock.calls[0][0].sdl as string;
    expect(sdl).toContain("2Gi");
    expect(sdl).toContain("10Gi");
  });

  it("selects the first service from the imported template", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: VALID_SDL });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ selectedServiceId: expect.any(String) }), expect.anything());
  });

  it("hydrates the deployment pane with the imported template's services", () => {
    setup({ initialSdl: TWO_SERVICE_SDL, Panes: ServiceListProbePanes });

    expect(screen.getByTestId("service-titles").textContent).toBe("web,api");
  });

  it("surfaces an error and falls back to a default when the SDL cannot be imported", () => {
    const { ConfigureDeploymentPanes, enqueueSnackbar } = setup({ initialSdl: "services: [unclosed" });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(
      expect.objectContaining({ sdl: expect.stringContaining('version: "2.0"'), selectedServiceId: expect.any(String) }),
      expect.anything()
    );
  });

  it("starts with a default service selected when no SDL was provided", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: undefined });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ selectedServiceId: expect.any(String) }), expect.anything());
  });

  it("regenerates the SDL preview when the form changes", async () => {
    setup({ initialSdl: undefined, Panes: SdlProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "change image" }));

    await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("nginx:latest"));
  });

  it("drops the removed service from the preview after it is added then removed", async () => {
    setup({ initialSdl: undefined, Panes: AddRemoveProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "add service" }));
    await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("service-2"));

    await userEvent.click(screen.getByRole("button", { name: "remove service" }));

    await waitFor(() => expect(screen.getByTestId("sdl").textContent).not.toContain("service-2"));
  });

  it("keeps regenerating the preview after a placement is added then removed", async () => {
    setup({ initialSdl: undefined, Panes: AddRemoveProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "add placement" }));
    await userEvent.click(screen.getByRole("button", { name: "remove placement" }));
    await userEvent.click(screen.getByRole("button", { name: "change image" }));

    await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("nginx:latest"));
  });

  it("reselects the first remaining service when the selected one is removed", async () => {
    setup({ initialSdl: undefined, Panes: SelectionProbePanes });
    const initialSelectedId = screen.getByTestId("selected").textContent;

    await userEvent.click(screen.getByRole("button", { name: "replace services" }));

    await waitFor(() => {
      expect(screen.getByTestId("selected").textContent).not.toBe(initialSelectedId);
      expect(screen.getByTestId("selected").textContent).toBe(screen.getByTestId("first-service-id").textContent);
    });
  });

  it("persists the regenerated sdl to the draft after an edit settles", async () => {
    const { save } = setup({ initialSdl: undefined, Panes: SdlProbePanes, draftId: "draft-1" });

    await userEvent.click(screen.getByRole("button", { name: "change image" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.stringContaining("nginx:latest")));
  });

  function setup(input: { initialSdl: string | undefined; Panes?: typeof SdlProbePanes; draftId?: string }) {
    const ConfigureDeploymentPanes = vi.fn(input.Panes ?? (() => <div data-testid="panes-mock" />));
    const enqueueSnackbar = vi.fn();
    const Snackbar = vi.fn(() => null);
    const save = vi.fn<(sdl: string) => void>();
    const useConfigureDraft = vi.fn(() =>
      mock<ReturnType<typeof DEPENDENCIES.useConfigureDraft>>({ draftId: input.draftId ?? "draft-1", persistedSdl: undefined, save, clear: vi.fn() })
    );
    const dependencies: typeof DEPENDENCIES = {
      Layout: vi.fn(({ children }) => <div data-testid="layout-mock">{children}</div>) as never,
      NextSeo: vi.fn(() => null) as never,
      ConfigureDeploymentHeader: vi.fn(() => <div data-testid="header-mock" />),
      ConfigureDeploymentPanes: ConfigureDeploymentPanes as never,
      useConfigureDraft: useConfigureDraft as never,
      useDeploymentFlow: (() => mock<ReturnType<typeof DEPENDENCIES.useDeploymentFlow>>({ phase: "configuring", dseq: null, bidStrategy: "select" })) as never,
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      Snackbar: Snackbar as never,
      ReviewAndDeployModal: () => null,
      usePlacementsWithBids: () => new Set<string>()
    };

    render(
      <ConfigureDeploymentForm
        initialSdl={input.initialSdl}
        intent={{ sdlStrategy: "edit", bidStrategy: "select", dseq: undefined, draftId: input.draftId }}
        dependencies={dependencies}
      />
    );

    return { ConfigureDeploymentPanes, enqueueSnackbar, save };
  }
});

describe(nextUndoneServiceId.name, () => {
  it("falls back to the first undone placement's service when none have bids yet", () => {
    const placements = [placement("p1"), placement("p2")];
    const services = [service("s1", "p1"), service("s2", "p2")];
    expect(nextUndoneServiceId(placements, services, { p1: "bid" }, new Set())).toBe("s2");
  });

  it("prefers the first undone placement that already has bids", () => {
    const placements = [placement("p1"), placement("p2"), placement("p3")];
    const services = [service("s1", "p1"), service("s2", "p2"), service("s3", "p3")];
    expect(nextUndoneServiceId(placements, services, { p1: "bid" }, new Set(["p3"]))).toBe("s3");
  });

  it("returns null once every placement has a selection", () => {
    const placements = [placement("p1"), placement("p2")];
    const services = [service("s1", "p1"), service("s2", "p2")];
    expect(nextUndoneServiceId(placements, services, { p1: "b1", p2: "b2" }, new Set(["p1", "p2"]))).toBeNull();
  });

  function placement(id: string): PlacementType {
    return mock<PlacementType>({ id });
  }
  function service(id: string, placementId: string): ServiceType {
    return mock<ServiceType>({ id, placementId, title: id });
  }
});

describe(firstBidReadyServiceId.name, () => {
  it("returns the first unselected placement that has bids", () => {
    const placements = [placement("p1"), placement("p2")];
    const services = [service("s1", "p1"), service("s2", "p2")];
    expect(firstBidReadyServiceId(placements, services, {}, new Set(["p2"]))).toBe("s2");
  });

  it("returns null when no unselected placement has bids", () => {
    const placements = [placement("p1")];
    const services = [service("s1", "p1")];
    expect(firstBidReadyServiceId(placements, services, {}, new Set())).toBeNull();
  });

  function placement(id: string): PlacementType {
    return mock<PlacementType>({ id });
  }
  function service(id: string, placementId: string): ServiceType {
    return mock<ServiceType>({ id, placementId, title: id });
  }
});

interface ProbePanesProps {
  sdl: string;
  selectedServiceId: string;
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

/** Panes stand-in that adds then removes a service via the real manager before editing, mirroring the UI flow. */
function AddRemoveProbePanes({ sdl }: ProbePanesProps) {
  const manager = usePlacementManager();
  const { setValue, getValues } = useFormContext<SdlBuilderFormValuesType>();
  return (
    <div>
      <div data-testid="sdl">{sdl}</div>
      <button type="button" onClick={() => manager.addService(getValues("placements")[0].id)}>
        add service
      </button>
      <button type="button" onClick={() => manager.removeService(getValues("services")[1].id)}>
        remove service
      </button>
      <button type="button" onClick={() => manager.addPlacement()}>
        add placement
      </button>
      <button type="button" onClick={() => manager.removePlacement(getValues("placements")[1].id)}>
        remove placement
      </button>
      <button type="button" onClick={() => setValue("services.0.image", "nginx:latest")}>
        change image
      </button>
    </div>
  );
}

/** Panes stand-in that swaps out the services to drive the reselection subscription. */
function SelectionProbePanes({ selectedServiceId }: ProbePanesProps) {
  const { setValue, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const services = useWatch<SdlBuilderFormValuesType>({ name: "services" });
  const firstServiceId = Array.isArray(services) ? (services as SdlBuilderFormValuesType["services"])[0]?.id : undefined;
  return (
    <div>
      <div data-testid="selected">{selectedServiceId}</div>
      <div data-testid="first-service-id">{firstServiceId ?? ""}</div>
      <button type="button" onClick={() => setValue("services", [defaultService(getValues("placements")[0].id, { title: "service-2" })])}>
        replace services
      </button>
    </div>
  );
}
