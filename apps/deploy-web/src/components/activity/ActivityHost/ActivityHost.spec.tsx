import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import { QueryKeys } from "@src/queries/queryKeys";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { DEPENDENCIES } from "./ActivityHost";
import { ActivityHost } from "./ActivityHost";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(ActivityHost.name, () => {
  const OWNER = "akash1owner";
  const TOAST_KEY = "toast-1";

  it("asks for no activities while the activity center is switched off", () => {
    const { useLatestActivitiesQuery, useFlag } = setup({ isEnabled: false });

    expect(useFlag).toHaveBeenCalledWith("notifications_activity_center");
    expect(useLatestActivitiesQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("asks for no activities while nobody is signed in", () => {
    const { useLatestActivitiesQuery } = setup({ isSignedIn: false });

    expect(useLatestActivitiesQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("follows the activities of a signed-in user", () => {
    const { useLatestActivitiesQuery } = setup();

    expect(useLatestActivitiesQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("announces nothing for the actions that had already finished when it first heard of them", () => {
    const { enqueueSnackbar, queryClient } = setup({ activities: [buildActivity({ status: "succeeded" }), buildActivity({ status: "failed" })] });

    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it("announces a close that finishes and refreshes the data it changed", () => {
    const pending = buildActivity({ status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, queryClient, receive, api, user } = setup({ activities: [pending] });

    receive([{ ...pending, status: "succeeded" }]);

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "Deployment 1234 closed", subTitle: "It no longer runs or costs anything.", iconVariant: "success" })
      }),
      { variant: "success" }
    );
    expect(invalidatedKeysOf(queryClient)).toEqual(
      expect.arrayContaining([
        api.v1.listDeployments.getKey(),
        api.v1.getDeployment.getKey({ dseq: "1234" }),
        QueryKeys.getDeploymentListKey(OWNER),
        QueryKeys.getDeploymentDetailKey(OWNER, "1234"),
        QueryKeys.getLeasesKey(OWNER, "1234"),
        QueryKeys.getAllLeasesKey(OWNER),
        QueryKeys.getBalancesKey(OWNER),
        QueryKeys.getManagedWalletKey(user.id),
        QueryKeys.getWeeklyDeploymentCostKey(),
        api.v1.getSpendRate.getKey()
      ])
    );
  });

  it("announces a close that fails with the reason it failed", () => {
    const pending = buildActivity({ status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive } = setup({ activities: [pending] });

    receive([
      { ...pending, status: "failed", meta: { dseq: "1234", error: { code: "close_failed", message: "Not enough credits to close this deployment" } } }
    ]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          title: "Couldn't close deployment 1234",
          subTitle: "Not enough credits to close this deployment",
          iconVariant: "error"
        })
      }),
      { variant: "error" }
    );
  });

  it("opens the deployment a close finished for from its toast, and dismisses the toast", async () => {
    const pending = buildActivity({ status: "pending", meta: { dseq: "1234" } });
    const { receive, followToastAction, push, closeSnackbar } = setup({ activities: [pending] });

    receive([{ ...pending, status: "succeeded" }]);
    await followToastAction("View deployment");

    expect(push).toHaveBeenCalledWith("/deployments/1234");
    expect(closeSnackbar).toHaveBeenCalledWith(TOAST_KEY);
  });

  it("opens the settings where a failed close can be tried again from its toast", async () => {
    const pending = buildActivity({ status: "pending", meta: { dseq: "1234" } });
    const { receive, followToastAction, push } = setup({ activities: [pending] });

    receive([{ ...pending, status: "failed" }]);
    await followToastAction("Open settings");

    expect(push).toHaveBeenCalledWith("/deployments/1234?tab=SETTINGS");
  });

  it("names the deployment a close finished for", () => {
    const pending = buildActivity({ status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive } = setup({ activities: [pending], names: { "1234": "storefront" } });

    receive([{ ...pending, status: "succeeded" }]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "“storefront” closed" }) }), {
      variant: "success"
    });
  });

  it("names the deployment a close failed for", () => {
    const pending = buildActivity({ status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive } = setup({ activities: [pending], names: { "1234": "storefront" } });

    receive([{ ...pending, status: "failed" }]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't close “storefront”" }) }), {
      variant: "error"
    });
  });

  it("looks up the names of the deployments its activities are about", () => {
    const { useDeploymentNames } = setup({ activities: [buildActivity({ meta: { dseq: "1234" } }), buildActivity({ meta: { dseq: "5678" } })] });

    expect(useDeploymentNames).toHaveBeenLastCalledWith(["1234", "5678"]);
  });

  it("looks up no names before the activities have loaded", () => {
    const { useDeploymentNames } = setup({ activities: undefined });

    expect(useDeploymentNames).toHaveBeenLastCalledWith([]);
  });

  it("holds an announcement until the names of the deployments have loaded", () => {
    const finished = buildActivity({ status: "succeeded", meta: { dseq: "5678" } });
    const { enqueueSnackbar, receive } = setup({ activities: [], names: { "5678": "storefront" } });

    receive([finished], { isLoadingNames: true });
    const announcedWhileLoading = enqueueSnackbar.mock.calls.length;
    receive([finished]);

    expect(announcedWhileLoading).toBe(0);
    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "“storefront” closed" }) }), {
      variant: "success"
    });
  });

  it("asks the user to try again when a failed close carries no reason", () => {
    const pending = buildActivity({ status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive } = setup({ activities: [pending] });

    receive([{ ...pending, status: "failed" }]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ subTitle: "Try closing it again." }) }), {
      variant: "error"
    });
  });

  it("announces a close started elsewhere that finished between two checks", () => {
    const earlier = buildActivity({ status: "succeeded" });
    const { enqueueSnackbar, receive } = setup({ activities: [earlier] });

    receive([buildActivity({ status: "succeeded", meta: { dseq: "5678" } }), earlier]);

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Deployment 5678 closed" }) }), {
      variant: "success"
    });
  });

  it("announces nothing while an action is still pending", () => {
    const pending = buildActivity({ status: "pending" });
    const { enqueueSnackbar, receive } = setup({ activities: [] });

    receive([pending]);

    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("announces a finished action only once", () => {
    const pending = buildActivity({ status: "pending" });
    const { enqueueSnackbar, receive } = setup({ activities: [pending] });

    receive([{ ...pending, status: "succeeded" }]);
    receive([{ ...pending, status: "succeeded" }]);

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
  });

  it("refreshes only the data it can name while the wallet has no address yet", () => {
    const pending = buildActivity({ status: "pending", meta: { dseq: "1234" } });
    const { queryClient, receive, api, user } = setup({ activities: [pending], address: "" });

    receive([{ ...pending, status: "succeeded" }]);

    expect(invalidatedKeysOf(queryClient)).toEqual([
      api.v1.listDeployments.getKey(),
      QueryKeys.getWeeklyDeploymentCostKey(),
      api.v1.getSpendRate.getKey(),
      api.v1.getDeployment.getKey({ dseq: "1234" }),
      QueryKeys.getManagedWalletKey(user.id)
    ]);
  });

  describe("a bulk close", () => {
    const BATCH_ID = "b47c4a2e-5f0d-4c1e-9a7b-2d3e4f5a6b7c";

    function batchClose(dseq: string, status: Activity["status"] = "pending") {
      return buildActivity({ id: `close-${dseq}`, status, meta: { dseq, batchId: BATCH_ID } });
    }

    it("announces nothing until every close in it has finished, then sums them up once", () => {
      const { enqueueSnackbar, receive } = setup({ activities: [batchClose("1"), batchClose("2"), batchClose("3")] });

      receive([batchClose("1", "succeeded"), batchClose("2", "succeeded"), batchClose("3")]);
      const announcedWhileOneRuns = enqueueSnackbar.mock.calls.length;
      receive([batchClose("1", "succeeded"), batchClose("2", "succeeded"), batchClose("3", "succeeded")]);
      receive([batchClose("1", "succeeded"), batchClose("2", "succeeded"), batchClose("3", "succeeded")]);

      expect(announcedWhileOneRuns).toBe(0);
      expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({ title: "3 deployments closed", subTitle: "They no longer run or cost anything.", iconVariant: "success" })
        }),
        { variant: "success" }
      );
    });

    it("opens the deployments list from its summary, and dismisses the summary", async () => {
      const { receive, followToastAction, push, closeSnackbar } = setup({ activities: [batchClose("1"), batchClose("2")] });

      receive([batchClose("1", "succeeded"), batchClose("2", "failed")]);
      await followToastAction("View deployments");

      expect(push).toHaveBeenCalledWith("/deployments");
      expect(closeSnackbar).toHaveBeenCalledWith(TOAST_KEY);
    });

    it("opens the deployment of a bulk close of one from its toast", async () => {
      const { receive, followToastAction, push } = setup({ activities: [batchClose("1")] });

      receive([batchClose("1", "succeeded")]);
      await followToastAction("View deployment");

      expect(push).toHaveBeenCalledWith("/deployments/1");
    });

    it("refreshes the data of each close as soon as it finishes, before the summary", () => {
      const { queryClient, receive, api } = setup({ activities: [batchClose("1"), batchClose("2")] });

      receive([batchClose("1", "succeeded"), batchClose("2")]);

      expect(invalidatedKeysOf(queryClient)).toEqual(expect.arrayContaining([api.v1.getDeployment.getKey({ dseq: "1" })]));
    });

    it("names the deployments it could not close", () => {
      const { enqueueSnackbar, receive } = setup({
        activities: [batchClose("1"), batchClose("2"), batchClose("3")],
        names: { "2": "storefront" }
      });

      receive([batchClose("1", "succeeded"), batchClose("2", "failed"), batchClose("3", "failed")]);

      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            title: "Closed 1 of 3 deployments",
            subTitle: "Couldn't close “storefront” and deployment 3.",
            iconVariant: "warning"
          })
        }),
        { variant: "warning" }
      );
    });

    it("names the one deployment it could not close", () => {
      const { enqueueSnackbar, receive } = setup({ activities: [batchClose("1"), batchClose("2")], names: { "2": "storefront" } });

      receive([batchClose("1", "succeeded"), batchClose("2", "failed")]);

      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ title: "Closed 1 of 2 deployments", subTitle: "Couldn't close “storefront”." }) }),
        { variant: "warning" }
      );
    });

    it("names all three deployments it could not close", () => {
      const dseqs = ["1", "2", "3", "4"];
      const { enqueueSnackbar, receive } = setup({ activities: dseqs.map(dseq => batchClose(dseq)) });

      receive([batchClose("1", "succeeded"), batchClose("2", "failed"), batchClose("3", "failed"), batchClose("4", "failed")]);

      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ subTitle: "Couldn't close deployment 2, deployment 3 and deployment 4." }) }),
        { variant: "warning" }
      );
    });

    it("forgets a bulk close whose closes have all left the feed by the time it was sent", () => {
      const { enqueueSnackbar, receive } = setup({ activities: [] });

      receive([batchClose("1", "succeeded")], { closeBatchesBeingSent: [BATCH_ID] });
      receive([]);

      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it("names every deployment when none of them closed", () => {
      const { enqueueSnackbar, receive } = setup({ activities: [batchClose("1"), batchClose("2")], names: { "1": "api" } });

      receive([batchClose("1", "failed"), batchClose("2", "failed")]);

      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({ title: "Couldn't close 2 deployments", subTitle: "Try closing “api” and deployment 2 again.", iconVariant: "error" })
        }),
        { variant: "error" }
      );
    });

    it("names three deployments at most and counts the rest", () => {
      const dseqs = ["1", "2", "3", "4", "5"];
      const { enqueueSnackbar, receive } = setup({ activities: dseqs.map(dseq => batchClose(dseq)) });

      receive(dseqs.map(dseq => batchClose(dseq, "failed")));

      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ subTitle: "Try closing deployment 1, deployment 2, deployment 3 and 2 more again." }) }),
        { variant: "error" }
      );
    });

    it("announces a bulk close of one deployment as that close", () => {
      const { enqueueSnackbar, receive } = setup({ activities: [batchClose("1")], names: { "1": "storefront" } });

      receive([batchClose("1", "succeeded")]);

      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "“storefront” closed" }) }), {
        variant: "success"
      });
    });

    it("waits while this tab is still sending the bulk close, then sums it up", () => {
      const { enqueueSnackbar, receive } = setup({ activities: [] });

      receive([batchClose("1", "succeeded"), batchClose("2", "succeeded")], { closeBatchesBeingSent: [BATCH_ID] });
      const announcedWhileSending = enqueueSnackbar.mock.calls.length;
      receive([batchClose("1", "succeeded"), batchClose("2", "succeeded")]);

      expect(announcedWhileSending).toBe(0);
      expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "2 deployments closed" }) }), {
        variant: "success"
      });
    });

    it("announces nothing for a bulk close that had already finished when it first heard of it", () => {
      const { enqueueSnackbar, receive } = setup({ activities: [batchClose("1", "succeeded"), batchClose("2", "failed")] });

      receive([batchClose("1", "succeeded"), batchClose("2", "failed")]);

      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it("sums up two bulk closes apart", () => {
      const other = buildActivity({ id: "other", status: "pending", meta: { dseq: "9", batchId: "f2c1a9b8-0d3e-4f5a-8b7c-6d5e4f3a2b1c" } });
      const { enqueueSnackbar, receive } = setup({ activities: [batchClose("1"), batchClose("2"), other] });

      receive([batchClose("1", "succeeded"), batchClose("2", "succeeded"), { ...other, status: "succeeded" }]);

      expect(enqueueSnackbar).toHaveBeenCalledTimes(2);
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "2 deployments closed" }) }), {
        variant: "success"
      });
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Deployment 9 closed" }) }), {
        variant: "success"
      });
    });
  });

  function invalidatedKeysOf(queryClient: ReturnType<typeof DEPENDENCIES.useQueryClient>) {
    return vi.mocked(queryClient.invalidateQueries).mock.calls.map(([filters]) => filters?.queryKey);
  }

  function setup(input: { isEnabled?: boolean; isSignedIn?: boolean; activities?: Activity[]; address?: string; names?: Record<string, string> } = {}) {
    const user = buildUser();
    let activities = input.activities;
    let isLoadingNames = false;
    let closeBatchesBeingSent: ReadonlySet<string> = new Set();
    const useDeploymentNames = vi.fn((() =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentNames>>({
        getDeploymentName: dseq => input.names?.[String(dseq)] ?? null,
        isLoading: isLoadingNames
      })) as typeof DEPENDENCIES.useDeploymentNames);
    const useLatestActivitiesQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>(), { data: activities })) as typeof DEPENDENCIES.useLatestActivitiesQuery);
    const useFlag = vi.fn((() => input.isEnabled ?? true) as typeof DEPENDENCIES.useFlag);
    const enqueueSnackbar = vi.fn().mockReturnValue(TOAST_KEY);
    const closeSnackbar = vi.fn();
    const push = vi.fn();
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();
    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.listDeployments.getKey.mockReturnValue(["listDeployments"]);
    api.v1.getSpendRate.getKey.mockReturnValue(["getSpendRate"]);
    api.v1.getDeployment.getKey.mockImplementation(request => ["getDeployment", request?.dseq ?? ""]);

    const dependencies: typeof DEPENDENCIES = {
      useFlag,
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : user }),
      useWallet: () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: input.address ?? OWNER }),
      useLatestActivitiesQuery,
      useDeploymentNames,
      useCloseBatchesBeingSent: () => closeBatchesBeingSent,
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar }),
      useQueryClient: () => queryClient,
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push })
    };

    const host = () => (
      <TestContainerProvider services={{ api: () => api }}>
        <ActivityHost dependencies={dependencies} />
      </TestContainerProvider>
    );
    const { rerender } = render(host());

    const receive = (next: Activity[], options: { isLoadingNames?: boolean; closeBatchesBeingSent?: string[] } = {}) => {
      activities = next;
      isLoadingNames = options.isLoadingNames ?? false;
      closeBatchesBeingSent = new Set(options.closeBatchesBeingSent);
      rerender(host());
    };

    const followToastAction = async (name: string) => {
      render(<>{enqueueSnackbar.mock.lastCall?.[0]}</>);
      await userEvent.click(screen.getByRole("button", { name }));
    };

    return { useLatestActivitiesQuery, useDeploymentNames, useFlag, enqueueSnackbar, closeSnackbar, push, queryClient, api, user, receive, followToastAction };
  }
});
