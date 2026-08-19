import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, DeploymentDetail } from "./DeploymentDetail";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

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
  });

  it("redirects an in-progress deployment with no lease to the configure flow", () => {
    const { router } = setup({ leases: [] });

    expect(router.replace).toHaveBeenCalledWith(expect.stringContaining("configure"));
  });

  function setup(input?: {
    deployment?: DeploymentDto | null;
    leases?: LeaseDto[] | null;
    isLeasesLoaded?: boolean;
    error?: Error | null;
    tab?: string;
    leaseState?: string;
  }) {
    const deployment = input && "deployment" in input ? input.deployment : mock<DeploymentDto>({ dseq: "1786440078202", state: "active", groups: [] });
    const leases = input && "leases" in input ? input.leases : [mock<LeaseDto>({ id: "1", provider: "akash1provider", state: input?.leaseState ?? "active" })];
    const providers = [mock<ApiProviderList>({ owner: "akash1provider" })];

    const analyticsService = mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>();
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();

    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        deploymentLocalStorage: mock<ReturnType<typeof DEPENDENCIES.useServices>["deploymentLocalStorage"]>({ get: () => null }),
        sdlAnalyzer: mock<ReturnType<typeof DEPENDENCIES.useServices>["sdlAnalyzer"]>({ hasCiCdImage: () => false }),
        analyticsService
      });
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: "akash1test" });
    const useRouter: typeof DEPENDENCIES.useRouter = () => router;
    const searchParams = new URLSearchParams(input?.tab ? `tab=${input.tab}` : "");
    const useSearchParams: typeof DEPENDENCIES.useSearchParams = () => searchParams as unknown as ReturnType<typeof DEPENDENCIES.useSearchParams>;
    const useDeploymentDetail: typeof DEPENDENCIES.useDeploymentDetail = () =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentDetail>>({ data: deployment, isFetching: false, error: input?.error ?? null });
    const useDeploymentLeaseList: typeof DEPENDENCIES.useDeploymentLeaseList = () =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentLeaseList>>({ data: leases, isLoading: false, isSuccess: input?.isLeasesLoaded ?? true });
    const useProviderList: typeof DEPENDENCIES.useProviderList = () =>
      mock<ReturnType<typeof DEPENDENCIES.useProviderList>>({ data: providers, isFetching: false });

    const DeploymentPlacements = vi.fn(() => <div>placements</div>);
    const DeploymentLogs = vi.fn(() => <div>logs</div>);
    const DeploymentLeaseShell = vi.fn(() => <div>shell</div>);
    const ManifestUpdate = vi.fn(({ closeManifestEditor }: { closeManifestEditor: () => void }) => (
      <div>
        manifest-update
        <button onClick={closeManifestEditor}>close-manifest-editor</button>
      </div>
    ));
    const DeploymentSettings = vi.fn(() => <div>settings</div>);

    render(
      <DeploymentDetail
        dseq="1786440078202"
        dependencies={MockComponents(DEPENDENCIES, {
          useServices,
          useWallet,
          useRouter,
          useSearchParams,
          useDeploymentDetail,
          useDeploymentLeaseList,
          useProviderList,
          DeploymentPlacements,
          DeploymentLogs,
          DeploymentLeaseShell,
          ManifestUpdate,
          DeploymentSettings
        })}
      />
    );

    return { router, analyticsService };
  }
});
