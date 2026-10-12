import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentReadiness } from "@src/hooks/useDeploymentsReadiness/useDeploymentsReadiness";
import { QueryKeys } from "@src/queries/queryKeys";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./DeploymentReadyHost";
import { DeploymentReadyHost } from "./DeploymentReadyHost";

import { fireEvent, render, screen } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";

describe(DeploymentReadyHost.name, () => {
  const NOW = new Date("2026-10-12T12:00:00.000Z");

  it("follows the feed of a signed-in user", () => {
    const { useActivityFeedQuery, useFlag } = setup({});

    expect(useFlag).toHaveBeenCalledWith("notifications_activity_center");
    expect(useActivityFeedQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it.each([
    { case: "the activity center is switched off", isEnabled: false, isSignedIn: true },
    { case: "nobody is signed in", isEnabled: true, isSignedIn: false }
  ])("checks on no deployment while $case, even with a feed left in the cache", ({ isEnabled, isSignedIn }) => {
    const { useActivityFeedQuery, watchedDseqs } = setup({ isEnabled, isSignedIn, activities: [deploy("1", "pending")] });

    expect(useActivityFeedQuery).toHaveBeenCalledWith({ enabled: false });
    expect(watchedDseqs()).toEqual([]);
  });

  it("checks on the deployments whose deploy is underway or went through in the last half hour", () => {
    const { watchedDseqs } = setup({
      activities: [
        deploy("1", "pending"),
        deploy("2", "succeeded", minutesAgo(29)),
        deploy("3", "succeeded", minutesAgo(30)),
        deploy("4", "failed"),
        buildActivity({ type: "deployment_close", status: "pending", meta: { dseq: "5" } }),
        buildActivity({ type: "lease_create", status: "pending", meta: {} })
      ]
    });

    expect(watchedDseqs()).toEqual(["1", "2"]);
  });

  it("checks on no deployment while the feed is still loading", () => {
    const { watchedDseqs } = setup({ isFeedLoading: true });

    expect(watchedDseqs()).toEqual([]);
  });

  it("lets the newest deploy of a deployment decide whether it is checked on", () => {
    const { watchedDseqs } = setup({ activities: [deploy("1", "failed"), deploy("1", "pending")] });

    expect(watchedDseqs()).toEqual([]);
  });

  it("announces a deployment that spun up once every service is ready, with an action that opens it", () => {
    const { enqueueSnackbar, closeSnackbar, router, receive } = setup({ activities: [deploy("1", "pending")], names: { "1": "storefront" } });
    enqueueSnackbar.mockReturnValue("toast-1");

    receive({ "1": "starting" });
    receive({ "1": "ready" });

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    const [[toast, options]] = enqueueSnackbar.mock.calls;
    expect(options).toEqual({ variant: "success" });
    expect(toast.props).toMatchObject({ title: "“storefront” is ready", subTitle: "Its services are up and running.", iconVariant: "success" });

    render(toast);
    fireEvent.click(screen.getByRole("button", { name: "View deployment" }));

    expect(router.push).toHaveBeenCalledWith(UrlService.deploymentDetails("1"));
    expect(closeSnackbar).toHaveBeenCalledWith("toast-1");
  });

  it("refreshes what the providers report for a deployment once it is ready, so every view of it reads running", () => {
    const { queryClient, receive } = setup({ activities: [deploy("1", "pending")] });

    receive({ "1": "starting" });
    receive({ "1": "ready" });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: QueryKeys.getDeploymentLeaseStatusesKey("1") });
  });

  it("names a deployment without a name by its dseq", () => {
    const { enqueueSnackbar, receive } = setup({ activities: [deploy("1", "pending")] });

    receive({ "1": "starting" });
    receive({ "1": "ready" });

    expect(enqueueSnackbar.mock.calls[0][0].props.title).toBe("Deployment 1 is ready");
  });

  it("announces a ready deployment once and stops checking on it", () => {
    const { enqueueSnackbar, receive, watchedDseqs } = setup({ activities: [deploy("1", "pending"), deploy("2", "pending")] });

    receive({ "1": "starting", "2": "starting" });
    receive({ "1": "ready", "2": "starting" });
    receive({ "1": "ready", "2": "starting" });

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(watchedDseqs()).toEqual(["2"]);
  });

  it("announces nothing for a deployment already running when it was first checked, and stops checking on it", () => {
    const { enqueueSnackbar, queryClient, receive, watchedDseqs } = setup({ activities: [deploy("1", "succeeded", minutesAgo(5))] });

    receive({ "1": "ready" });

    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    expect(watchedDseqs()).toEqual([]);
  });

  it("stops checking on a deployment that closed while spinning up, without announcing it", () => {
    const { enqueueSnackbar, receive, watchedDseqs } = setup({ activities: [deploy("1", "pending")] });

    receive({ "1": "starting" });
    receive({ "1": "stopped" });

    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(watchedDseqs()).toEqual([]);
  });

  it("keeps checking on a deployment while how ready it is stays undecided, and does not count that as spinning up", () => {
    const { enqueueSnackbar, receive, watchedDseqs } = setup({ activities: [deploy("1", "pending")] });

    receive({ "1": undefined });

    expect(watchedDseqs()).toEqual(["1"]);

    receive({ "1": "ready" });

    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  function deploy(dseq: string, status: Activity["status"], updatedAt = NOW): Activity {
    return buildActivity({ type: "lease_create", status, meta: { dseq }, updatedAt: updatedAt.toISOString() });
  }

  function minutesAgo(minutes: number) {
    return new Date(NOW.getTime() - minutes * 60 * 1000);
  }

  function setup(input: { isEnabled?: boolean; isSignedIn?: boolean; isFeedLoading?: boolean; activities?: Activity[]; names?: Record<string, string> }) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    let readinessByDseq: Record<string, DeploymentReadiness | undefined> = {};
    const useFlag = vi.fn((() => input.isEnabled ?? true) as typeof DEPENDENCIES.useFlag);
    const useActivityFeedQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useActivityFeedQuery>>(), {
        data: input.isFeedLoading ? undefined : { activities: input.activities ?? [], unseenCount: 0 }
      })) as typeof DEPENDENCIES.useActivityFeedQuery);
    const useDeploymentsReadiness = vi.fn((dseqs: string[]) =>
      dseqs.map(dseq => ({ dseq, name: input.names?.[dseq] ?? null, readiness: readinessByDseq[dseq] }))
    );
    const enqueueSnackbar = vi.fn();
    const closeSnackbar = vi.fn();
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();

    const dependencies: typeof DEPENDENCIES = {
      useFlag,
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : buildUser() }),
      useActivityFeedQuery,
      useDeploymentsReadiness,
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar }),
      useQueryClient: () => queryClient,
      useRouter: () => router
    };

    const { rerender } = render(<DeploymentReadyHost dependencies={dependencies} />);

    const receive = (next: Record<string, DeploymentReadiness | undefined>) => {
      readinessByDseq = next;
      rerender(<DeploymentReadyHost dependencies={dependencies} />);
    };
    const watchedDseqs = () => useDeploymentsReadiness.mock.calls.at(-1)?.[0];

    return { useFlag, useActivityFeedQuery, useDeploymentsReadiness, enqueueSnackbar, closeSnackbar, queryClient, router, receive, watchedDseqs };
  }
});
