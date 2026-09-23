import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { DeploymentDto, DetectedGpusByLease, DetectedLeaseGpus, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import type { DeploymentUpdateProps } from "./DeploymentUpdate/DeploymentUpdate";
import { DEPENDENCIES, DeploymentDetail } from "./DeploymentDetail";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

const DETECTED_GPUS: DetectedLeaseGpus = {
  services: [{ service: "web", gpus: [{ vendor: "nvidia", model: "h100", displayName: "H100", memoryMb: 81559, interface: "sxm", count: 1 }] }],
  driverVersion: "550.54.15",
  detectedAt: "2026-09-21T10:00:00.000Z"
};

describe("DeploymentDetail", () => {
  afterEach(function restoreUrlMutatedByTabNavigation() {
    window.history.replaceState(window.history.state, "", "/");
  });

  it("renders the tab bar and lease rows when the deployment and leases are loaded", () => {
    setup();

    expect(screen.getByRole("tab", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Update" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Billing & Notifications" })).not.toBeInTheDocument();
    expect(screen.getByText("placements")).toBeInTheDocument();
  });

  it("renders the reclamation banner between the detail header and the tabs", () => {
    setup();

    const header = screen.getByText("detail-header");
    const banner = screen.getByText("reclamation-banner");
    const tabList = screen.getByRole("tablist");

    expect(isRenderedBefore(header, banner)).toBe(true);
    expect(isRenderedBefore(banner, tabList)).toBe(true);
  });

  it("tracks a navigate_tab analytics event when switching tabs", async () => {
    const { analyticsService } = setup();

    await userEvent.click(screen.getByRole("tab", { name: "Logs" }));

    expect(analyticsService.track).toHaveBeenCalledWith("navigate_tab", expect.objectContaining({ tab: "LOGS", category: "deployments" }));
    expect(window.location.search).toBe("?tab=LOGS");
    expect(screen.getByText("logs")).toBeInTheDocument();
  });

  it("opens the manifest editor on the Update tab from the ?tab= query param", () => {
    setup({ tab: "UPDATE" });

    expect(screen.getByText("manifest-update")).toBeInTheDocument();
  });

  it("returns to Details and clears the update tab from the url once the manifest editor closes", async () => {
    setup({ tab: "UPDATE" });

    await userEvent.click(screen.getByRole("button", { name: "close-manifest-editor" }));

    expect(window.location.search).toBe("?tab=DETAILS");
    expect(screen.getByText("placements")).toBeInTheDocument();
  });

  it("opens the deployment settings on the Settings tab from the ?tab= query param", () => {
    setup({ tab: "SETTINGS" });

    expect(screen.getByText("settings")).toBeInTheDocument();
    expect(screen.queryByText("manifest-update")).not.toBeInTheDocument();
  });

  it("shows an inactive-state note instead of the shell when the deployment has no live lease", () => {
    setup({ tab: "SHELL", leaseState: "closed" });

    expect(screen.getByText("Available when the deployment is active.")).toBeInTheDocument();
    expect(screen.queryByText("shell")).not.toBeInTheDocument();
  });

  it("shows a not-found message when the deployment does not exist", () => {
    const error = Object.assign(new Error("Deployment not found"), { response: { data: { message: "Deployment not found" } } });
    setup({ deployment: null, error });

    expect(screen.getByText(/this deployment does not exist/i)).toBeInTheDocument();
    expect(screen.queryByTestId("deployment-detail-skeleton")).not.toBeInTheDocument();
  });

  it("renders the page skeleton while the deployment loads", () => {
    setup({ deployment: null });

    expect(screen.getByTestId("deployment-detail-skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("renders the page skeleton until leases resolve", () => {
    setup({ isLeasesLoaded: false });

    expect(screen.getByTestId("deployment-detail-skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("keeps the skeleton away when leases fail to load", () => {
    setup({ isLeasesLoaded: false, isLeasesError: true });

    expect(screen.queryByTestId("deployment-detail-skeleton")).not.toBeInTheDocument();
  });

  it("holds only the placements until the definition resolves, so they never render with no services", () => {
    setup({ definition: { sdl: undefined, source: "resolving" } });

    expect(screen.getByTestId("deployment-placements-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("placements")).not.toBeInTheDocument();
    expect(screen.queryByTestId("deployment-detail-skeleton")).not.toBeInTheDocument();
    expect(screen.getByText("detail-header")).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("renders a tab that does not read the definition without waiting for it", () => {
    setup({ tab: "LOGS", definition: { sdl: undefined, source: "resolving" } });

    expect(screen.getByText("logs")).toBeInTheDocument();
    expect(screen.queryByTestId("deployment-detail-skeleton")).not.toBeInTheDocument();
    expect(screen.queryByTestId("deployment-placements-skeleton")).not.toBeInTheDocument();
  });

  it("redirects an in-progress deployment with no lease to the configure flow", () => {
    const { router } = setup({ leases: [] });

    expect(router.replace).toHaveBeenCalledWith(expect.stringContaining("configure"));
  });

  it("offers redeploy on the Update tab when a definition resolves", () => {
    const { redeploy, analyticsService, ManifestUpdate } = setup({
      tab: "UPDATE",
      definition: { sdl: "version: '2.0'", name: "My Storefront", source: "api" }
    });

    ManifestUpdate.mock.calls[0][0].onRedeploy?.();

    expect(redeploy).toHaveBeenCalledWith({ sdl: "version: '2.0'", name: "My Storefront", sourceDseq: expect.any(String) });
    expect(analyticsService.track).toHaveBeenCalledWith("redeploy_btn_clk", "Amplitude");
  });

  it("withholds redeploy from the Update tab when neither source holds a definition", () => {
    const { ManifestUpdate } = setup({ tab: "UPDATE", definition: { sdl: undefined, source: "absent" } });

    expect(ManifestUpdate.mock.calls[0][0].onRedeploy).toBeUndefined();
  });

  it("withholds redeploy from the Update tab when the definition is absent despite an inspection-only api sdl", () => {
    const { ManifestUpdate } = setup({ tab: "UPDATE", definition: { sdl: "version: '2.0' # not-self-contained", source: "absent" } });

    expect(ManifestUpdate.mock.calls[0][0].onRedeploy).toBeUndefined();
  });

  it("seeds the configure draft from the api definition when redirecting a lease-less deployment", () => {
    const { router } = setup({ leases: [], definition: { sdl: "version: '2.0' # from-the-api", source: "api" } });

    expect(router.replace).toHaveBeenCalledWith(expect.stringContaining("draftId"));
  });

  it("redirects a lease-less deployment without a draft when the definition is absent despite an inspection-only api sdl", () => {
    const { router } = setup({ leases: [], definition: { sdl: "version: '2.0' # not-self-contained", source: "absent" } });

    expect(router.replace).toHaveBeenCalledWith(expect.not.stringContaining("draftId"));
  });

  it("does not redirect a lease-less deployment until the definition resolves", () => {
    const { router } = setup({ leases: [], definition: { sdl: undefined, source: "resolving" } });

    expect(router.replace).not.toHaveBeenCalled();
  });

  it("orders the tabs with Update right after Details", () => {
    setup();

    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Details", "Update", "Logs", "Events", "Shell", "Settings"]);
  });

  describe("when the structured update editor is on", () => {
    it("opens the structured editor on the Update tab, with the raw editor as its fallback", () => {
      const { DeploymentUpdate } = setup({ tab: "UPDATE", isUpdateEditorEnabled: true });

      expect(screen.getByText("structured-update")).toBeInTheDocument();
      render(<>{DeploymentUpdate.mock.calls[0][0].fallback}</>);
      expect(screen.getByText("manifest-update")).toBeInTheDocument();
    });

    it("hands the editor the definition the page resolved", () => {
      const { DeploymentUpdate } = setup({
        tab: "UPDATE",
        isUpdateEditorEnabled: true,
        definition: { sdl: "version: '2.0'", source: "api", manifestVersion: "cmVjb3JkZWQ=" }
      });

      expect(DeploymentUpdate.mock.calls[0][0].definition).toMatchObject({ sdl: "version: '2.0'", source: "api", manifestVersion: "cmVjb3JkZWQ=" });
    });

    it("offers the editor a redeploy of the resolved definition", () => {
      const { DeploymentUpdate, redeploy } = setup({ tab: "UPDATE", isUpdateEditorEnabled: true, definition: { sdl: "version: '2.0'", source: "api" } });

      DeploymentUpdate.mock.calls[0][0].onRedeploy?.();

      expect(redeploy).toHaveBeenCalledWith(expect.objectContaining({ sdl: "version: '2.0'" }));
    });

    it("hands the editor the providers the page loaded", () => {
      const { DeploymentUpdate } = setup({ tab: "UPDATE", isUpdateEditorEnabled: true });

      expect(DeploymentUpdate.mock.calls[0][0].providers.map(provider => provider.owner)).toEqual(["akash1provider"]);
    });

    it("hands the editor no providers until they load", () => {
      const { DeploymentUpdate } = setup({ tab: "UPDATE", isUpdateEditorEnabled: true, providers: undefined });

      expect(DeploymentUpdate.mock.calls[0][0].providers).toEqual([]);
    });

    it("keeps the raw editor off the page while the structured editor renders", () => {
      setup({ tab: "UPDATE", isUpdateEditorEnabled: true });

      expect(screen.queryByText("manifest-update")).not.toBeInTheDocument();
    });
  });

  it("reloads the deployment once the raw editor closes", async () => {
    const { refetchDeployment } = setup({ tab: "UPDATE" });

    await userEvent.click(screen.getByRole("button", { name: "close-manifest-editor" }));

    expect(refetchDeployment).toHaveBeenCalled();
  });

  it("keeps the raw editor on the Update tab while the structured editor is off", () => {
    const { DeploymentUpdate } = setup({ tab: "UPDATE", isUpdateEditorEnabled: false });

    expect(screen.getByText("manifest-update")).toBeInTheDocument();
    expect(DeploymentUpdate).not.toHaveBeenCalled();
  });
  it("joins the gpus the console read onto the lease they were read from, even when they arrive after the leases", () => {
    const { DeploymentDetailHeader, rerenderWithDetectedGpus } = setup({ leases: [gpuLease()] });

    rerenderWithDetectedGpus({ "1/1/akash1provider": DETECTED_GPUS });

    expect(DeploymentDetailHeader.mock.lastCall?.[0].leases).toEqual([expect.objectContaining({ detectedGpus: DETECTED_GPUS })]);
  });

  it("hands its views the same leases across a render that changed nothing, so the logs and shell keep the lease picked", () => {
    const detected = { "1/1/akash1provider": DETECTED_GPUS };
    const { DeploymentDetailHeader, rerenderWithDetectedGpus } = setup({ leases: [gpuLease()], detectedGpus: detected });
    const before = DeploymentDetailHeader.mock.lastCall?.[0].leases;

    rerenderWithDetectedGpus(detected);

    expect(DeploymentDetailHeader.mock.lastCall?.[0].leases).toBe(before);
  });

  function gpuLease() {
    return mock<LeaseDto>({ id: "1", provider: "akash1provider", gseq: 1, oseq: 1, state: "active", gpuAmount: 1 });
  }

  function isRenderedBefore(earlier: Element, later: Element) {
    return Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function setup(input?: {
    deployment?: DeploymentDto | null;
    leases?: LeaseDto[] | null;
    isLeasesLoaded?: boolean;
    isLeasesError?: boolean;
    error?: Error | null;
    tab?: string;
    leaseState?: string;
    definition?: Partial<DeploymentDefinition>;
    isUpdateEditorEnabled?: boolean;
    providers?: ApiProviderList[];
    detectedGpus?: DetectedGpusByLease;
  }) {
    const deployment = input && "deployment" in input ? input.deployment : mock<DeploymentDto>({ dseq: "1786440078202", state: "active", groups: [] });
    const leases = input && "leases" in input ? input.leases : [mock<LeaseDto>({ id: "1", provider: "akash1provider", state: input?.leaseState ?? "active" })];
    const providers = input && "providers" in input ? input.providers : [mock<ApiProviderList>({ owner: "akash1provider" })];
    const refetchDeployment = vi.fn();

    const analyticsService = mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>();
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();

    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        analyticsService
      });
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1test" });
    const useRouter: typeof DEPENDENCIES.useRouter = () => router;
    const searchParams = new URLSearchParams(input?.tab ? `tab=${input.tab}` : "");
    const useSearchParams: typeof DEPENDENCIES.useSearchParams = () => searchParams as unknown as ReturnType<typeof DEPENDENCIES.useSearchParams>;
    const useDeploymentDetail: typeof DEPENDENCIES.useDeploymentDetail = () =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentDetail>>({
        data: deployment,
        isFetching: false,
        error: input?.error ?? null,
        refetch: refetchDeployment
      });
    const leaseList = mock<ReturnType<typeof DEPENDENCIES.useDeploymentLeaseList>>({
      data: leases,
      isLoading: false,
      isSuccess: input?.isLeasesLoaded ?? true,
      isError: input?.isLeasesError ?? false
    });
    const useDeploymentLeaseList: typeof DEPENDENCIES.useDeploymentLeaseList = () => leaseList;
    let detectedGpus = input?.detectedGpus ?? {};
    const useDetectedLeaseGpus: typeof DEPENDENCIES.useDetectedLeaseGpus = () => detectedGpus;
    const useProviderList: typeof DEPENDENCIES.useProviderList = () =>
      mock<ReturnType<typeof DEPENDENCIES.useProviderList>>({ data: providers, isFetching: false });
    const redeploy = vi.fn();
    const useRedeploy: typeof DEPENDENCIES.useRedeploy = () => redeploy;
    const definition: DeploymentDefinition = { sdl: "version: '2.0'", name: undefined, source: "local", ...input?.definition };
    const useDeploymentDefinition: typeof DEPENDENCIES.useDeploymentDefinition = () => definition;

    const DeploymentDetailHeader = vi.fn<(props: { leases?: LeaseDto[] | null }) => ReactElement>(() => <div>detail-header</div>);
    const ReclamationBanner = vi.fn(() => <div>reclamation-banner</div>);
    const DeploymentPlacements = vi.fn(() => <div>placements</div>);
    const DeploymentLogs = vi.fn(() => <div>logs</div>);
    const DeploymentLeaseShell = vi.fn(() => <div>shell</div>);
    const ManifestUpdate = vi.fn(({ closeManifestEditor }: { closeManifestEditor: () => void; onRedeploy?: () => void }) => (
      <div>
        manifest-update
        <button onClick={closeManifestEditor}>close-manifest-editor</button>
      </div>
    ));
    const DeploymentSettings = vi.fn(() => <div>settings</div>);
    const DeploymentUpdate = vi.fn((_props: DeploymentUpdateProps) => <div>structured-update</div>);
    const useFlag: typeof DEPENDENCIES.useFlag = flag => flag === "ui_deployment_update_editor" && !!input?.isUpdateEditorEnabled;

    const dependencies = MockComponents(DEPENDENCIES, {
      useServices,
      useWallet,
      useRouter,
      useSearchParams,
      useRedeploy,
      useDeploymentDefinition,
      useDeploymentDetail,
      useDeploymentLeaseList,
      useDetectedLeaseGpus,
      useProviderList,
      DeploymentDetailHeader,
      ReclamationBanner,
      DeploymentPlacements,
      DeploymentLogs,
      DeploymentLeaseShell,
      ManifestUpdate,
      DeploymentSettings,
      DeploymentUpdate,
      useFlag
    });
    const { rerender } = render(<DeploymentDetail dseq="1786440078202" dependencies={dependencies} />);

    return {
      router,
      analyticsService,
      redeploy,
      ManifestUpdate,
      DeploymentUpdate,
      refetchDeployment,
      DeploymentDetailHeader,
      rerenderWithDetectedGpus(next: DetectedGpusByLease) {
        detectedGpus = next;
        rerender(<DeploymentDetail dseq="1786440078202" dependencies={dependencies} />);
      }
    };
  }
});
