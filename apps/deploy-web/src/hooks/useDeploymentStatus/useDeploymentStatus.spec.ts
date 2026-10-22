import type { ConsoleCloseReason } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WorkloadStatus } from "@src/components/deployments/DeploymentDetail/DeploymentPlacements/placementModel";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { LeaseDto } from "@src/types/deployment";
import type { DEPENDENCIES } from "./useDeploymentStatus";
import { useDeploymentActivity, useDeploymentStatus } from "./useDeploymentStatus";

import { renderHook } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";

const DSEQ = "1234";

const PROVIDER = "akash1provider";

describe(useDeploymentStatus.name, () => {
  it("shows a deployment whose lease is still being created as spinning up, waiting on the providers it chose", () => {
    const { result } = setup({ activities: [leaseCreation({ status: "pending", providers: [PROVIDER] })], leases: [] });

    expect(result.current).toEqual({
      label: "Spinning up",
      summaryLabel: "Spinning up",
      tone: "loading",
      isSpinningUp: true,
      launch: { phase: "awaiting-lease", providers: [PROVIDER] }
    });
  });

  it("keeps spinning up once the lease exists, while a service still has no ready replica", () => {
    const { result } = setup({ activities: [leaseCreation({ status: "succeeded" })], leases: [liveLease()], workload: "starting" });

    expect(result.current).toEqual({ label: "Spinning up", summaryLabel: "Spinning up", tone: "loading", isSpinningUp: true });
  });

  it("keeps spinning up while the lease that landed is still missing from the lease list", () => {
    const { result } = setup({ activities: [leaseCreation({ status: "succeeded", providers: [PROVIDER] })], leases: [] });

    expect(result.current).toMatchObject({ label: "Spinning up", launch: { phase: "awaiting-lease", providers: [PROVIDER] } });
  });

  it("keeps spinning up while the lease is being created again for a deployment that already holds one", () => {
    const { result } = setup({ activities: [leaseCreation({ status: "pending" })], leases: [liveLease()], workload: "running" });

    expect(result.current).toEqual({ label: "Spinning up", summaryLabel: "Spinning up", tone: "loading", isSpinningUp: true });
  });

  it("keeps spinning up while the lease is being created again for a deployment whose earlier lease closed", () => {
    const { result } = setup({ activities: [leaseCreation({ status: "pending" })], leases: [mock<LeaseDto>({ state: "closed", reason: undefined })] });

    expect(result.current.launch).toEqual({ phase: "awaiting-lease", providers: [] });
  });

  it.each(["pending", "succeeded"] as const)("waits on the lease of a %s creation before the lease list has loaded", status => {
    const { result } = setup({ activities: [leaseCreation({ status })], leases: undefined });

    expect(result.current.launch).toEqual({ phase: "awaiting-lease", providers: [] });
  });

  it("follows the feed and the providers from spinning up to running", () => {
    const { result, receive } = setup({ activities: [leaseCreation({ status: "pending" })], leases: [] });
    const whileUnderway = result.current.label;

    receive({ activities: [leaseCreation({ status: "succeeded" })], leases: [liveLease()], workload: "starting" });
    const whileStarting = result.current.label;
    receive({ workload: "running" });

    expect([whileUnderway, whileStarting, result.current.label]).toEqual(["Spinning up", "Spinning up", "Running"]);
  });

  it("follows a close that starts after the deployment is shown", () => {
    const { result, receive } = setup({ activities: [], leases: [liveLease()], workload: "running" });

    receive({ activities: [buildActivity({ type: "deployment_close", status: "pending", meta: { dseq: DSEQ } })] });

    expect(result.current.label).toBe("Closing");
  });

  it("reads running once every service has a ready replica", () => {
    const { result } = setup({ activities: [leaseCreation({ status: "succeeded" })], leases: [liveLease()], workload: "running" });

    expect(result.current).toEqual({ label: "Running", summaryLabel: "Running", tone: "running" });
  });

  it("reports why the lease closed once the one that landed is no longer live", () => {
    const { result } = setup({ activities: [leaseCreation({ status: "succeeded" })], leases: [mock<LeaseDto>({ state: "closed", reason: undefined })] });

    expect(result.current.isSpinningUp).toBeUndefined();
    expect(result.current.tone).toBe("warning");
  });

  it("ends the spin up of a lease that was not created, offering to choose a provider again", () => {
    const { result } = setup({
      activities: [leaseCreation({ status: "failed", providers: [PROVIDER], error: { code: "lease_not_created", message: "The lease was not created." } })],
      leases: []
    });

    expect(result.current).toEqual({
      label: "Deploy failed",
      summaryLabel: "Deploy failed",
      tone: "warning",
      launch: { phase: "failed", providers: [PROVIDER], recovery: "choose-provider", reason: "The lease was not created." }
    });
  });

  it("tells a lease whose provider never got the deployment from one that was not created", () => {
    const { result } = setup({
      activities: [leaseCreation({ status: "failed", error: { code: "manifest_not_delivered", message: "Not sent." } })],
      leases: [liveLease()],
      workload: "loading"
    });

    expect(result.current).toMatchObject({ label: "Deploy failed", launch: { phase: "failed", recovery: "send-again", reason: "Not sent." } });
  });

  it("leads a lease its provider closed before getting the deployment to closing it, with the reason the api gave", () => {
    const { result } = setup({
      activities: [leaseCreation({ status: "failed", error: { code: "lease_closed_before_manifest", message: "Closed before it was sent." } })],
      leases: []
    });

    expect(result.current).toMatchObject({ label: "Deploy failed", launch: { phase: "failed", recovery: "close", reason: "Closed before it was sent." } });
  });

  it("reports a failed lease with no reason and no providers", () => {
    const { result } = setup({ activities: [leaseCreation({ status: "failed" })], leases: [] });

    expect(result.current.launch).toEqual({ phase: "failed", providers: [], recovery: "choose-provider", reason: undefined });
  });

  it("follows the newest lease creation, so a retry replaces the attempt that failed", () => {
    const { result } = setup({
      activities: [leaseCreation({ status: "pending" }), leaseCreation({ status: "failed", error: { code: "lease_not_created", message: "Gone." } })],
      leases: []
    });

    expect(result.current.label).toBe("Spinning up");
  });

  it("reads only the activities about this deployment", () => {
    const { result } = setup({
      activities: [
        buildActivity({ type: "lease_create", status: "pending", meta: { dseq: "9999" } }),
        buildActivity({ type: "deployment_close", status: "pending", meta: { dseq: "9999" } })
      ],
      leases: [liveLease()],
      workload: "running"
    });

    expect(result.current.label).toBe("Running");
  });

  it("shows a close running in the background over a lease being created", () => {
    const { result } = setup({
      activities: [buildActivity({ type: "deployment_close", status: "pending", meta: { dseq: DSEQ } }), leaseCreation({ status: "pending" })]
    });

    expect(result.current.label).toBe("Closing");
  });

  describe("while an update applies in the background", () => {
    it("shows the update over services still starting", () => {
      const { result } = setup({
        activities: [deploymentUpdate("pending"), leaseCreation({ status: "succeeded" })],
        leases: [liveLease()],
        workload: "starting"
      });

      expect(result.current).toEqual({ label: "Updating", summaryLabel: "Updating", tone: "loading" });
    });

    it("shows the update over a lease being created again for a deployment that already holds one", () => {
      const { result } = setup({ activities: [deploymentUpdate("pending"), leaseCreation({ status: "pending" })], leases: [liveLease()], workload: "running" });

      expect(result.current.label).toBe("Updating");
    });

    it("keeps a deployment still waiting for its lease spinning up, as no provider runs anything to update yet", () => {
      const { result } = setup({ activities: [deploymentUpdate("pending"), leaseCreation({ status: "pending", providers: [PROVIDER] })], leases: [] });

      expect(result.current).toMatchObject({ label: "Spinning up", launch: { phase: "awaiting-lease", providers: [PROVIDER] } });
    });

    it("holds back a failed deploy while the update sends the deployment to its provider again", () => {
      const { result } = setup({
        activities: [deploymentUpdate("pending"), leaseCreation({ status: "failed", error: { code: "manifest_not_delivered", message: "Not sent." } })],
        leases: [liveLease()],
        workload: "loading"
      });

      expect(result.current).toEqual({ label: "Updating", summaryLabel: "Updating", tone: "loading" });
    });

    it("shows a close over the update", () => {
      const { result } = setup({
        activities: [buildActivity({ type: "deployment_close", status: "pending", meta: { dseq: DSEQ } }), deploymentUpdate("pending")],
        leases: [liveLease()]
      });

      expect(result.current.label).toBe("Closing");
    });
  });

  describe("once an update has landed after a failed deploy", () => {
    const refusedManifest = () => leaseCreation({ status: "failed", error: { code: "manifest_not_delivered", message: "Not sent." } });

    it("drops the failure of a deployment its provider refused, as the update sent it again", () => {
      const { result } = setup({ activities: [deploymentUpdate("succeeded"), refusedManifest()], leases: [liveLease()], workload: "running" });

      expect(result.current).toEqual({ label: "Running", summaryLabel: "Running", tone: "running" });
    });

    it("keeps the failure of a lease that was never created, which no update brings back", () => {
      const { result } = setup({
        activities: [deploymentUpdate("succeeded"), leaseCreation({ status: "failed", error: { code: "lease_not_created", message: "Gone." } })],
        leases: []
      });

      expect(result.current.label).toBe("Deploy failed");
    });

    it("keeps the failure while the update that followed it failed too", () => {
      const { result } = setup({ activities: [deploymentUpdate("failed"), refusedManifest()], leases: [liveLease()] });

      expect(result.current.label).toBe("Deploy failed");
    });

    it("keeps following a lease creation still underway, whatever its last attempt reported", () => {
      const { result } = setup({
        activities: [deploymentUpdate("succeeded"), leaseCreation({ status: "pending", error: { code: "manifest_not_delivered", message: "Not sent." } })],
        leases: []
      });

      expect(result.current).toMatchObject({ label: "Spinning up", launch: { phase: "awaiting-lease" } });
    });

    it("keeps a refusal that came after the update", () => {
      const { result } = setup({ activities: [refusedManifest(), deploymentUpdate("succeeded")], leases: [liveLease()] });

      expect(result.current.label).toBe("Deploy failed");
    });

    it("keeps the refusal through a newer activity that is not an update", () => {
      const { result } = setup({
        activities: [buildActivity({ type: "deployment_close", status: "succeeded", meta: { dseq: DSEQ } }), refusedManifest()],
        leases: [liveLease()]
      });

      expect(result.current.label).toBe("Deploy failed");
    });
  });

  it("leaves a deployment that is closed as closed, whatever its last lease creation did", () => {
    const { result } = setup({ state: "closed", activities: [leaseCreation({ status: "failed" })], leases: [] });

    expect(result.current.label).toBe("Closed");
  });

  it("leaves a closed deployment with a pending lease creation as closed", () => {
    const { result } = setup({ state: "closed", activities: [leaseCreation({ status: "pending" })], leases: [] });

    expect(result.current.label).toBe("Closed");
  });

  it("names Console as the one who closed a deployment it closed with the owner's wallet, and says why", () => {
    const { result } = setup({
      state: "closed",
      activities: [],
      leases: [mock<LeaseDto>({ state: "closed", reason: "lease_closed_owner" })],
      consoleCloseReason: "runtime_limit_reached"
    });

    expect(result.current).toEqual({ label: "Closed by Console", summaryLabel: "Closed by Console", tone: "closed", reason: "It reached its runtime limit." });
  });

  it("follows why Console closed the deployment once its settings say so", () => {
    const { result, receive } = setup({ state: "closed", activities: [], leases: [mock<LeaseDto>({ state: "closed", reason: "lease_closed_owner" })] });
    expect(result.current.label).toBe("Closed by you");

    receive({ consoleCloseReason: "provider_unreachable" });

    expect(result.current.label).toBe("Closed by Console");
  });

  it("shows what the chain and providers say when the deployment has no lease creation in the feed", () => {
    const { result } = setup({ activities: [], leases: [liveLease()], workload: "running" });

    expect(result.current.label).toBe("Running");
  });

  it.each([
    { case: "the activity center is off", isEnabled: false, isSignedIn: true },
    { case: "no one is signed in", isEnabled: true, isSignedIn: false }
  ])("ignores the activities still cached once $case", ({ isEnabled, isSignedIn }) => {
    const { result } = setup({ activities: [leaseCreation({ status: "pending" })], leases: [], isEnabled, isSignedIn });

    expect(result.current).toEqual({ label: "Running", summaryLabel: "Running", tone: "running" });
  });

  function setup(input: {
    activities?: Activity[];
    state?: string;
    leases?: LeaseDto[];
    workload?: WorkloadStatus;
    consoleCloseReason?: ConsoleCloseReason;
    isEnabled?: boolean;
    isSignedIn?: boolean;
  }) {
    const current = { ...input };
    const dependencies = dependenciesFor(current);
    const { result, rerender } = renderHook(() =>
      useDeploymentStatus({
        dseq: DSEQ,
        state: current.state ?? "active",
        leases: current.leases,
        workload: current.workload,
        consoleCloseReason: current.consoleCloseReason,
        dependencies
      })
    );

    return {
      result,
      receive(next: Partial<typeof input>) {
        Object.assign(current, next);
        rerender();
      }
    };
  }
});

describe(useDeploymentActivity.name, () => {
  it("reports a close of the deployment still running in the background", () => {
    const { result } = setup({ activities: [buildActivity({ type: "deployment_close", status: "pending", meta: { dseq: DSEQ } })] });

    expect(result.current.isClosing).toBe(true);
  });

  it("reports no close once the close of the deployment has landed", () => {
    const { result } = setup({ activities: [buildActivity({ type: "deployment_close", status: "succeeded", meta: { dseq: DSEQ } })] });

    expect(result.current.isClosing).toBe(false);
  });

  it("reports no close for a pending lease creation", () => {
    const { result } = setup({ activities: [leaseCreation({ status: "pending" })] });

    expect(result.current).toMatchObject({ isClosing: false, isUpdating: false, leaseCreation: { type: "lease_create" } });
  });

  it("reports an update of the deployment still being applied in the background", () => {
    const { result } = setup({ activities: [deploymentUpdate("pending")] });

    expect(result.current).toMatchObject({ isUpdating: true, isClosing: false });
  });

  it("reports no update once the update of the deployment has landed", () => {
    const { result } = setup({ activities: [deploymentUpdate("succeeded")] });

    expect(result.current.isUpdating).toBe(false);
  });

  it("reports no update for an update of another deployment", () => {
    const { result } = setup({ activities: [buildActivity({ type: "deployment_update", status: "pending", meta: { dseq: "9999" } })] });

    expect(result.current.isUpdating).toBe(false);
  });

  it("hands back no lease creation for a deployment the feed holds only closes for", () => {
    const { result } = setup({ activities: [buildActivity({ type: "deployment_close", status: "failed", meta: { dseq: DSEQ } })] });

    expect(result.current.leaseCreation).toBeUndefined();
  });

  it("reports the feed as resolving until it is read again after mounting, since a cached read can miss a lease just requested", () => {
    expect(setup({ activities: [], isFetchedAfterMount: false }).result.current.isResolving).toBe(true);
    expect(setup({ activities: [], isFetchedAfterMount: true }).result.current.isResolving).toBe(false);
  });

  it("does not wait on a feed it does not follow", () => {
    expect(setup({ isFetchedAfterMount: false, isEnabled: false }).result.current.isResolving).toBe(false);
    expect(setup({ isFetchedAfterMount: false, isSignedIn: false }).result.current.isResolving).toBe(false);
  });

  it("reads the feed the activity host polls without polling it again, only while the activity center is on for a signed-in user", () => {
    expect(setup({ isEnabled: true }).useActivityFeedQuery).toHaveBeenCalledWith({ enabled: true });
    expect(setup({ isEnabled: false }).useActivityFeedQuery).toHaveBeenCalledWith({ enabled: false });
    expect(setup({ isSignedIn: false }).useActivityFeedQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("reads nothing before the feed has loaded", () => {
    const { result } = setup({ activities: undefined });

    expect(result.current).toEqual({ isClosing: false, isUpdating: false, leaseCreation: undefined, isResolving: false });
  });

  function setup(input: { activities?: Activity[]; isFetchedAfterMount?: boolean; isEnabled?: boolean; isSignedIn?: boolean }) {
    const dependencies = dependenciesFor(input);
    const { result } = renderHook(() => useDeploymentActivity(DSEQ, dependencies));

    return { result, useActivityFeedQuery: dependencies.useActivityFeedQuery };
  }
});

function leaseCreation(input: { status: Activity["status"]; providers?: string[]; error?: { code: string; message: string } }): Activity {
  return buildActivity({ type: "lease_create", status: input.status, meta: { dseq: DSEQ, providers: input.providers, error: input.error } });
}

function deploymentUpdate(status: Activity["status"]): Activity {
  return buildActivity({ type: "deployment_update", status, meta: { dseq: DSEQ } });
}

function liveLease(): LeaseDto {
  return mock<LeaseDto>({ state: "active", reclamation: undefined });
}

function dependenciesFor(input: { activities?: Activity[]; isFetchedAfterMount?: boolean; isEnabled?: boolean; isSignedIn?: boolean }) {
  const useActivityFeedQuery = vi.fn((() =>
    Object.assign(mock<ReturnType<typeof DEPENDENCIES.useActivityFeedQuery>>(), {
      data: input.activities && { activities: input.activities, unseenCount: 0, newestCreatedAt: input.activities[0]?.createdAt },
      isFetchedAfterMount: input.isFetchedAfterMount ?? true
    })) as typeof DEPENDENCIES.useActivityFeedQuery);

  return {
    useFlag: vi.fn((flag: string) => flag === "notifications_activity_center" && (input.isEnabled ?? true)) as typeof DEPENDENCIES.useFlag,
    useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : buildUser() }),
    useActivityFeedQuery
  } satisfies typeof DEPENDENCIES;
}
