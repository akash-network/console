import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, DeploymentDetail } from "./DeploymentDetail";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentDetail", () => {
  it("renders the tab bar and lease rows when the deployment and leases are loaded", () => {
    setup();

    expect(screen.getByRole("tab", { name: "Details" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Billing & Notifications" })).toBeInTheDocument();
    expect(screen.getByText("lease-row")).toBeInTheDocument();
  });

  it("tracks a navigate_tab analytics event when switching tabs", async () => {
    const { analyticsService } = setup();

    await userEvent.click(screen.getByRole("tab", { name: "Logs" }));

    expect(analyticsService.track).toHaveBeenCalledWith("navigate_tab", expect.objectContaining({ tab: "LOGS", category: "deployments" }));
    expect(window.location.search).toBe("?tab=LOGS");
    expect(screen.getByText("logs")).toBeInTheDocument();
  });

  it("opens the Settings tab from the ?tab= query param", () => {
    setup({ tab: "SETTINGS" });

    expect(screen.getByText("manifest-update")).toBeInTheDocument();
  });

  it("shows an inactive-state note instead of the shell when the deployment has no live lease", () => {
    setup({ tab: "SHELL", leaseState: "closed" });

    expect(screen.getByText("Available when the deployment is active.")).toBeInTheDocument();
    expect(screen.queryByText("shell")).not.toBeInTheDocument();
  });

  it("renders alerts on the Billing tab when the user is signed in", () => {
    setup({ tab: "BILLING" });

    expect(screen.getByText("alerts")).toBeInTheDocument();
  });

  it("shows a coming-soon note on the Billing tab when the user is not signed in", () => {
    setup({ tab: "BILLING", isSignedIn: false });

    expect(screen.getByText("Billing & notifications are coming soon.")).toBeInTheDocument();
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
    isSignedIn?: boolean;
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
    const useSettings: typeof DEPENDENCIES.useSettings = () => mock<ReturnType<typeof DEPENDENCIES.useSettings>>({ isSettingsInit: true });
    const useUser: typeof DEPENDENCIES.useUser = () =>
      mock<ReturnType<typeof DEPENDENCIES.useUser>>({
        user: input?.isSignedIn === false ? undefined : mock<NonNullable<ReturnType<typeof DEPENDENCIES.useUser>["user"]>>({ userId: "u1" })
      });
    const useRouter: typeof DEPENDENCIES.useRouter = () => router;
    const searchParams = new URLSearchParams(input?.tab ? `tab=${input.tab}` : "");
    const useSearchParams: typeof DEPENDENCIES.useSearchParams = () => searchParams as unknown as ReturnType<typeof DEPENDENCIES.useSearchParams>;
    const useDeploymentDetail: typeof DEPENDENCIES.useDeploymentDetail = () =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentDetail>>({ data: deployment, isFetching: false, error: input?.error ?? null });
    const useDeploymentLeaseList: typeof DEPENDENCIES.useDeploymentLeaseList = () =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentLeaseList>>({ data: leases, isLoading: false, isSuccess: input?.isLeasesLoaded ?? true });
    const useProviderList: typeof DEPENDENCIES.useProviderList = () =>
      mock<ReturnType<typeof DEPENDENCIES.useProviderList>>({ data: providers, isFetching: false });

    const LeaseRow = vi.fn(() => <div>lease-row</div>);
    const DeploymentLogs = vi.fn(() => <div>logs</div>);
    const DeploymentLeaseShell = vi.fn(() => <div>shell</div>);
    const ManifestUpdate = vi.fn(() => <div>manifest-update</div>);
    const DeploymentAlerts = vi.fn(() => <div>alerts</div>);

    render(
      <DeploymentDetail
        dseq="1786440078202"
        dependencies={MockComponents(DEPENDENCIES, {
          useServices,
          useWallet,
          useSettings,
          useUser,
          useRouter,
          useSearchParams,
          useDeploymentDetail,
          useDeploymentLeaseList,
          useProviderList,
          LeaseRow: LeaseRow as unknown as typeof DEPENDENCIES.LeaseRow,
          DeploymentLogs,
          DeploymentLeaseShell,
          ManifestUpdate,
          DeploymentAlerts
        })}
      />
    );

    return { router, analyticsService };
  }
});
