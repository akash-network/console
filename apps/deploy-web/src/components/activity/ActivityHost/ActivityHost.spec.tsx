import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import { QueryKeys } from "@src/queries/queryKeys";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { DEPENDENCIES } from "./ActivityHost";
import { ActivityHost } from "./ActivityHost";

import { render } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(ActivityHost.name, () => {
  const OWNER = "akash1owner";

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
        QueryKeys.getWeeklyDeploymentCostKey()
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
      api.v1.getDeployment.getKey({ dseq: "1234" }),
      QueryKeys.getManagedWalletKey(user.id)
    ]);
  });

  function invalidatedKeysOf(queryClient: ReturnType<typeof DEPENDENCIES.useQueryClient>) {
    return vi.mocked(queryClient.invalidateQueries).mock.calls.map(([filters]) => filters?.queryKey);
  }

  function setup(input: { isEnabled?: boolean; isSignedIn?: boolean; activities?: Activity[]; address?: string } = {}) {
    const user = buildUser();
    let activities = input.activities;
    const useLatestActivitiesQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>(), { data: activities })) as typeof DEPENDENCIES.useLatestActivitiesQuery);
    const useFlag = vi.fn((() => input.isEnabled ?? true) as typeof DEPENDENCIES.useFlag);
    const enqueueSnackbar = vi.fn();
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();
    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.listDeployments.getKey.mockReturnValue(["listDeployments"]);
    api.v1.getDeployment.getKey.mockImplementation(request => ["getDeployment", request?.dseq ?? ""]);

    const dependencies: typeof DEPENDENCIES = {
      useFlag,
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : user }),
      useWallet: () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: input.address ?? OWNER }),
      useLatestActivitiesQuery,
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() }),
      useQueryClient: () => queryClient
    };

    const host = () => (
      <TestContainerProvider services={{ api: () => api }}>
        <ActivityHost dependencies={dependencies} />
      </TestContainerProvider>
    );
    const { rerender } = render(host());

    const receive = (next: Activity[]) => {
      activities = next;
      rerender(host());
    };

    return { useLatestActivitiesQuery, useFlag, enqueueSnackbar, queryClient, api, user, receive };
  }
});
