import { useController, useFormContext, useWatch } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultService } from "@src/utils/sdl/data";
import { ConfigurationPane } from "../ConfigurationPane/ConfigurationPane";
import { usePlacementManager } from "../DeploymentPane/usePlacementManager/usePlacementManager";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
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
    expect(screen.getByTestId("ghost-free").textContent).toBe("true");
  });

  it("drops the removed placement and its service from the preview after it is added then removed", async () => {
    setup({ initialSdl: undefined, Panes: AddRemoveProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "add placement" }));
    await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("placement-1"));

    await userEvent.click(screen.getByRole("button", { name: "remove placement" }));

    await waitFor(() => {
      const sdl = screen.getByTestId("sdl").textContent ?? "";
      expect(sdl).not.toContain("placement-1");
      expect(sdl).not.toContain("service-2");
    });
    expect(screen.getByTestId("ghost-free").textContent).toBe("true");
  });

  it("removes a non-selected service without a ghost and keeps the current selection", async () => {
    setup({ initialSdl: undefined, Panes: AddRemoveProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "add service" }));
    await userEvent.click(screen.getByRole("button", { name: "add service" }));
    await waitFor(() => expect(screen.getByTestId("sdl").textContent).toContain("service-3"));
    const selectedService3 = screen.getByTestId("selected").textContent;

    await userEvent.click(screen.getByRole("button", { name: "remove first service" }));

    await waitFor(() => expect(screen.getByTestId("sdl").textContent).not.toContain("service-1"));
    expect(screen.getByTestId("ghost-free").textContent).toBe("true");
    expect(screen.getByTestId("selected").textContent).toBe(selectedService3);
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

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.stringContaining("nginx:latest"), expect.any(String)));
  });

  it("clears the configure draft once the deployment is deployed", () => {
    const { clear } = setup({ initialSdl: undefined, deploySucceeded: true });

    expect(clear).toHaveBeenCalled();
  });

  it("keeps the configure draft while the deployment has not been deployed", () => {
    const { clear } = setup({ initialSdl: undefined, deploySucceeded: false });

    expect(clear).not.toHaveBeenCalled();
  });

  it("seeds the deployment name from initialName", () => {
    const { ConfigureDeploymentPanes } = setup({ initialSdl: undefined, initialName: "my-app" });

    expect(ConfigureDeploymentPanes).toHaveBeenCalledWith(expect.objectContaining({ deploymentName: "my-app" }), expect.anything());
  });

  it("persists the deployment name into the draft alongside the sdl", async () => {
    const { save } = setup({ initialSdl: undefined, initialName: "my-app", Panes: SdlProbePanes });

    await userEvent.click(screen.getByRole("button", { name: "change image" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.stringContaining("nginx:latest"), "my-app"));
  });

  it("toasts when the flow reports an error, such as the no-providers timeout", () => {
    const { enqueueSnackbar } = setup({ initialSdl: undefined, flowError: { message: "No providers are available" } });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
  });

  it("resets the trial before re-requesting quotes when a previous trial start terminally errored", () => {
    const { ConfigureDeploymentHeader, requestQuotes, retryTrial } = setup({ initialSdl: undefined, trialError: new Error("trial boom") });
    const headerFlow = (ConfigureDeploymentHeader as ReturnType<typeof vi.fn>).mock.calls[0][0].flow as DeploymentFlow;

    headerFlow.actions.requestQuotes("sdl-x");

    expect(retryTrial).toHaveBeenCalledTimes(1);
    expect(requestQuotes).toHaveBeenCalledWith("sdl-x");
  });

  it("does not reset the trial when re-requesting quotes without a prior trial error", () => {
    const { ConfigureDeploymentHeader, requestQuotes, retryTrial } = setup({ initialSdl: undefined });
    const headerFlow = (ConfigureDeploymentHeader as ReturnType<typeof vi.fn>).mock.calls[0][0].flow as DeploymentFlow;

    headerFlow.actions.requestQuotes("sdl-x");

    expect(retryTrial).not.toHaveBeenCalled();
    expect(requestQuotes).toHaveBeenCalledWith("sdl-x");
  });

  function setup(input: {
    initialSdl: string | undefined;
    initialName?: string;
    Panes?: typeof SdlProbePanes;
    draftId?: string;
    deploySucceeded?: boolean;
    flowError?: { message?: string };
    trialError?: unknown;
  }) {
    const ConfigureDeploymentPanes = vi.fn(input.Panes ?? (() => <div data-testid="panes-mock" />));
    const ConfigureDeploymentHeader = vi.fn(() => <div data-testid="header-mock" />);
    const enqueueSnackbar = vi.fn();
    const Snackbar = vi.fn(() => null);
    const save = vi.fn<(sdl: string, name?: string) => void>();
    const clear = vi.fn<() => void>();
    const requestQuotes = vi.fn();
    const retryTrial = vi.fn();
    const setDeploymentName = vi.fn();
    const useConfigureDraft = vi.fn(() =>
      mock<ReturnType<typeof DEPENDENCIES.useConfigureDraft>>({ draftId: input.draftId ?? "draft-1", persistedSdl: undefined, save, clear })
    );
    const useDeploymentName = ((args: { initialName?: string }) => ({ name: args.initialName ?? "", setName: setDeploymentName })) as never;
    // The base flow is created upstream by the DeploymentFlowProvider now, so it arrives as a prop rather than a hook.
    const flow = mock<DeploymentFlow>({
      phase: "configuring",
      dseq: null,
      bidStrategy: "select",
      deploySucceeded: input.deploySucceeded ?? false,
      error: input.flowError,
      actions: mock<DeploymentFlow["actions"]>({ requestQuotes })
    });
    const dependencies: typeof DEPENDENCIES = {
      Layout: vi.fn(({ children }) => <div data-testid="layout-mock">{children}</div>) as never,
      NextSeo: vi.fn(() => null) as never,
      ConfigureDeploymentHeader,
      ConfigureDeploymentPanes: ConfigureDeploymentPanes as never,
      useConfigureDraft: useConfigureDraft as never,
      useDeploymentName,
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      Snackbar: Snackbar as never,
      ReviewAndDeployModal: () => null,
      DeployProgressOverlay: () => null,
      usePlacementsWithBids: () => new Set<string>()
    };

    render(
      <ConfigureDeploymentForm
        initialSdl={input.initialSdl}
        initialName={input.initialName}
        intent={{ sdlStrategy: "edit", bidStrategy: "select", dseq: undefined, draftId: input.draftId }}
        flow={flow}
        trialError={input.trialError}
        retryTrial={retryTrial}
        dependencies={dependencies}
      />
    );

    return { ConfigureDeploymentPanes, ConfigureDeploymentHeader, enqueueSnackbar, save, clear, requestQuotes, retryTrial };
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
  onSelectService: (serviceId: string) => void;
}

/**
 * Stand-in for a real configuration card: registers fields on its service index via `useController`, exactly
 * like ImageCard/RuntimeCard/etc. This registration is what resurrected a removed service before the fix, so a
 * regression test must mount something that registers.
 */
function FieldRegisteringSection({ serviceIndex }: { serviceIndex: number }) {
  useController<SdlBuilderFormValuesType>({ name: `services.${serviceIndex}.image` as never });
  useController<SdlBuilderFormValuesType>({ name: `services.${serviceIndex}.title` as never });
  return null;
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

/**
 * Panes stand-in that adds then removes a service/placement via the real manager, mirroring the UI flow —
 * including selecting the newly added item and mounting the real ConfigurationPane, so its cards register
 * fields on the selected service. That registration is what made a removed service linger in the SDL, so it
 * must be present for the removal tests to guard the regression. `ghost-free` reports that every service in
 * the form still carries an id and placementId (a resurrected partial entry would be missing them).
 */
function AddRemoveProbePanes({ sdl, selectedServiceId, onSelectService }: ProbePanesProps) {
  const manager = usePlacementManager({ onSelectService });
  const { getValues } = useFormContext<SdlBuilderFormValuesType>();
  const services = (useWatch<SdlBuilderFormValuesType>({ name: "services" }) as SdlBuilderFormValuesType["services"]) ?? [];
  return (
    <div>
      <div data-testid="sdl">{sdl}</div>
      <div data-testid="selected">{selectedServiceId}</div>
      <div data-testid="ghost-free">{String(services.every(service => !!service?.id && !!service?.placementId))}</div>
      <button type="button" onClick={() => onSelectService(manager.addService(getValues("placements")[0].id))}>
        add service
      </button>
      <button type="button" onClick={() => manager.removeService(getValues("services")[1].id)}>
        remove service
      </button>
      <button type="button" onClick={() => manager.removeService(getValues("services")[0].id)}>
        remove first service
      </button>
      <button type="button" onClick={() => onSelectService(manager.addPlacement())}>
        add placement
      </button>
      <button type="button" onClick={() => manager.removePlacement(getValues("placements")[1].id)}>
        remove placement
      </button>
      <ConfigurationPane
        selectedServiceId={selectedServiceId}
        dependencies={{
          ImageSection: FieldRegisteringSection as never,
          HardwareSection: FieldRegisteringSection as never,
          AdditionalSection: FieldRegisteringSection as never
        }}
      />
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
