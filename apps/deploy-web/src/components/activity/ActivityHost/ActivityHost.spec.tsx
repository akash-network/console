import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import { QueryKeys } from "@src/queries/queryKeys";
import type { Activity, ActivityOfAnyType } from "@src/queries/useLatestActivitiesQuery";
import type { AnalyticsService, EventProperties } from "@src/services/analytics/analytics.service";
import { createApiSdk } from "@src/services/api-sdk/createApiSdk";
import { ActivityHost, DEPENDENCIES } from "./ActivityHost";

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildActivity, buildActivityOfUnknownType } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";
import { jsonResponse } from "@tests/unit/jsonResponse";
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

  it("announces a create that finishes", () => {
    const pending = buildActivity({ type: "deployment_create", status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive } = setup({ activities: [pending], names: { "1234": "storefront" } });

    receive([{ ...pending, status: "succeeded" }]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "“storefront” created", subTitle: "Choose a provider to start it.", iconVariant: "success" })
      }),
      { variant: "success" }
    );
  });

  it("leads a created deployment to choosing a provider for it from its toast", async () => {
    const pending = buildActivity({ type: "deployment_create", status: "pending", meta: { dseq: "1234" } });
    const { receive, followToastAction, push } = setup({ activities: [pending] });

    receive([{ ...pending, status: "succeeded" }]);
    await followToastAction("Choose a provider");

    expect(push).toHaveBeenCalledWith("/new-deployment/configure/1234");
  });

  it("leads a failed create back to configuring a new deployment from its toast", async () => {
    const pending = buildActivity({ type: "deployment_create", status: "pending", meta: { dseq: "1234" } });
    const { receive, followToastAction, push } = setup({ activities: [pending] });

    receive([{ ...pending, status: "failed" }]);
    await followToastAction("New deployment");

    expect(push).toHaveBeenCalledWith("/new-deployment/configure");
  });

  describe("with the create_deployment event a page held for a background create", () => {
    it("tracks it once the create succeeds", () => {
      const pending = buildActivity({ id: "activity-1", type: "deployment_create", status: "pending", meta: { dseq: "1234" } });
      const createdEvent = { category: "deployments" as const, dseq: "1234", secretCount: 0 };
      const { receive, analyticsService, takeHeldCreateEvent } = setup({ activities: [pending], heldCreateEvents: { "activity-1": createdEvent } });

      receive([{ ...pending, status: "succeeded" }]);

      expect(takeHeldCreateEvent).toHaveBeenCalledWith("activity-1");
      expect(analyticsService.track).toHaveBeenCalledTimes(1);
      expect(analyticsService.track).toHaveBeenCalledWith("create_deployment", createdEvent);
    });

    it("drops it without tracking once the create fails", () => {
      const pending = buildActivity({ id: "activity-1", type: "deployment_create", status: "pending", meta: { dseq: "1234" } });
      const { receive, analyticsService, takeHeldCreateEvent } = setup({ activities: [pending], heldCreateEvents: { "activity-1": { dseq: "1234" } } });

      receive([{ ...pending, status: "failed" }]);

      expect(takeHeldCreateEvent).toHaveBeenCalledWith("activity-1");
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("tracks nothing for a create no page here held an event for", () => {
      const pending = buildActivity({ id: "activity-1", type: "deployment_create", status: "pending", meta: { dseq: "1234" } });
      const { receive, analyticsService } = setup({ activities: [pending] });

      receive([{ ...pending, status: "succeeded" }]);

      expect(analyticsService.track).not.toHaveBeenCalled();
    });
  });

  it.each([
    {
      meta: { dseq: "1234", error: { code: "create_incomplete", message: "The deployment was not created. Try creating it again." } },
      subTitle: "The deployment was not created. Try creating it again."
    },
    { meta: { dseq: "1234" }, subTitle: "Try creating it again." }
  ])("announces a create that fails, saying $subTitle", ({ meta, subTitle }) => {
    const pending = buildActivity({ type: "deployment_create", status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive } = setup({ activities: [pending] });

    receive([{ ...pending, status: "failed", meta }]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't create deployment 1234", subTitle, iconVariant: "error" }) }),
      { variant: "error" }
    );
  });

  it("announces an update that finishes", () => {
    const pending = buildActivity({ type: "deployment_update", status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive } = setup({ activities: [pending], names: { "1234": "storefront" } });

    receive([{ ...pending, status: "succeeded" }]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "“storefront” updated", subTitle: "The new configuration is being applied to it.", iconVariant: "success" })
      }),
      { variant: "success" }
    );
  });

  it.each([
    { meta: { dseq: "1234", error: { code: "update_failed", message: "Deployment closed" } }, subTitle: "Deployment closed" },
    { meta: { dseq: "1234" }, subTitle: "Try updating it again." }
  ])("announces an update that fails, saying $subTitle", ({ meta, subTitle }) => {
    const pending = buildActivity({ type: "deployment_update", status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive } = setup({ activities: [pending] });

    receive([{ ...pending, status: "failed", meta }]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't update deployment 1234", subTitle, iconVariant: "error" }) }),
      { variant: "error" }
    );
  });

  it("opens the update tab where a failed update can be tried again from its toast", async () => {
    const pending = buildActivity({ type: "deployment_update", status: "pending", meta: { dseq: "1234" } });
    const { receive, followToastAction, push } = setup({ activities: [pending] });

    receive([{ ...pending, status: "failed" }]);
    await followToastAction("Open update");

    expect(push).toHaveBeenCalledWith("/deployments/1234?tab=UPDATE");
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

  it("announces a deployment whose lease was created and manifest sent", () => {
    const pending = buildActivity({ type: "lease_create", status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive } = setup({ activities: [pending], names: { "1234": "storefront" } });

    receive([{ ...pending, status: "succeeded" }]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "“storefront” deployed", subTitle: "Its provider is starting it.", iconVariant: "success" })
      }),
      { variant: "success" }
    );
  });

  it("announces a deployment whose lease could not be created with the reason it failed", () => {
    const pending = buildActivity({ type: "lease_create", status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive } = setup({ activities: [pending] });

    receive([{ ...pending, status: "failed", meta: { dseq: "1234", error: { code: "lease_not_created", message: "The lease was not created." } } }]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "Couldn't deploy deployment 1234", subTitle: "The lease was not created.", iconVariant: "error" })
      }),
      { variant: "error" }
    );
  });

  it("asks the user to choose a provider again when a failed deployment carries no reason", () => {
    const pending = buildActivity({ type: "lease_create", status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive } = setup({ activities: [pending] });

    receive([{ ...pending, status: "failed" }]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ subTitle: "Choose a provider again." }) }), {
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

  it.each([
    { type: "deployment_create", status: "succeeded" },
    { type: "lease_create", status: "succeeded" },
    { type: "lease_create", status: "failed" },
    { type: "deployment_update", status: "succeeded" },
    { type: "deployment_update", status: "failed" }
  ] as const)("announces no $type that had already $status when it first heard of it, once its page showed how it ended", ({ type, status }) => {
    const handled = buildActivity({ type, status, meta: { dseq: "5678" } });
    const { enqueueSnackbar, queryClient, receive, api, forgetHandledOutcome } = setup({ activities: [], handled: [handled] });

    receive([handled]);

    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(forgetHandledOutcome).toHaveBeenCalledWith(handled);
    expect(invalidatedKeysOf(queryClient)).toEqual(expect.arrayContaining([api.v1.getDeployment.getKey({ dseq: "5678" })]));
  });

  it("announces a deploy that had already finished when it first heard of it, when no page showed how it ended", () => {
    const { enqueueSnackbar, receive, forgetHandledOutcome } = setup({ activities: [] });

    receive([buildActivity({ type: "lease_create", status: "failed", meta: { dseq: "5678" } })]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't deploy deployment 5678" }) }), {
      variant: "error"
    });
    expect(forgetHandledOutcome).not.toHaveBeenCalled();
  });

  it("announces a deploy it saw running in the background, and forgets the outcome its page marked", () => {
    const pending = buildActivity({ type: "lease_create", status: "pending", meta: { dseq: "1234" } });
    const settled = { ...pending, status: "succeeded" as const };
    const { enqueueSnackbar, receive, forgetHandledOutcome } = setup({ activities: [pending], handled: [settled] });

    receive([settled]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Deployment 1234 deployed" }) }), {
      variant: "success"
    });
    expect(forgetHandledOutcome).toHaveBeenCalledWith(settled);
  });

  it.each(["succeeded", "failed"] as const)(
    "announces no create it saw pending that %s while its page followed it until it settled, and forgets the mark",
    status => {
      const pending = buildActivity({ id: "activity-1", type: "deployment_create", status: "pending", meta: { dseq: "1234" } });
      const settled = { ...pending, status };
      const { enqueueSnackbar, queryClient, receive, api, forgetHandledOutcome } = setup({ activities: [pending], followed: ["activity-1"] });

      receive([settled]);

      expect(enqueueSnackbar).not.toHaveBeenCalled();
      expect(forgetHandledOutcome).toHaveBeenCalledWith(settled);
      expect(invalidatedKeysOf(queryClient)).toEqual(expect.arrayContaining([api.v1.getDeployment.getKey({ dseq: "1234" })]));
    }
  );

  it("announces a create once no page follows it any more", () => {
    const pending = buildActivity({ id: "activity-1", type: "deployment_create", status: "pending", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive, forgetHandledOutcome } = setup({ activities: [pending], followed: ["activity-2"] });

    receive([{ ...pending, status: "succeeded" }]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Deployment 1234 created" }) }), {
      variant: "success"
    });
    expect(forgetHandledOutcome).not.toHaveBeenCalled();
  });

  it("announces a deploy that ended differently from what its page showed", () => {
    const deployed = buildActivity({ type: "lease_create", status: "succeeded", meta: { dseq: "1234" } });
    const { enqueueSnackbar, receive } = setup({ activities: [], handled: [{ ...deployed, status: "failed" }] });

    receive([deployed]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Deployment 1234 deployed" }) }), {
      variant: "success"
    });
  });

  it("forgets no mark for a close it announces", () => {
    const pending = buildActivity({ status: "pending", meta: { dseq: "1234" } });
    const { receive, forgetHandledOutcome } = setup({ activities: [pending] });

    receive([{ ...pending, status: "succeeded" }]);

    expect(forgetHandledOutcome).not.toHaveBeenCalled();
  });

  it("announces a close Console made once it shows up in the feed, saying why, and refreshes the data it changed", () => {
    const { enqueueSnackbar, queryClient, receive, api } = setup({ activities: [], names: { "1234": "storefront" } });

    receive([buildActivity({ status: "succeeded", initiator: "system", meta: { dseq: "1234", reason: "runtime_limit_reached" } })]);

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "Console closed “storefront”", subTitle: "It reached its runtime limit.", iconVariant: "info" })
      }),
      { variant: "info" }
    );
    expect(invalidatedKeysOf(queryClient)).toEqual(expect.arrayContaining([api.v1.listDeployments.getKey(), api.v1.getDeployment.getKey({ dseq: "1234" })]));
  });

  it("holds the announcement of a close Console made until the name of its deployment has loaded", () => {
    const systemClose = buildActivity({ status: "succeeded", initiator: "system", meta: { dseq: "1234", reason: "provider_unreachable" } });
    const { enqueueSnackbar, receive } = setup({ activities: [], names: { "1234": "storefront" } });

    receive([systemClose], { isLoadingNames: true });
    const announcedWhileLoading = enqueueSnackbar.mock.calls.length;
    receive([systemClose]);

    expect(announcedWhileLoading).toBe(0);
    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Console closed “storefront”" }) }), {
      variant: "info"
    });
  });

  it("announces a close Console made for a reason it has no words for as a plain close by Console", () => {
    const { enqueueSnackbar, receive } = setup({ activities: [] });

    receive([buildActivity({ status: "succeeded", initiator: "system", meta: { dseq: "1234" } })]);

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "Console closed deployment 1234", subTitle: "It no longer runs or costs anything." })
      }),
      { variant: "info" }
    );
  });

  it("opens the deployment Console closed from its toast", async () => {
    const { receive, followToastAction, push } = setup({ activities: [] });

    receive([buildActivity({ status: "succeeded", initiator: "system", meta: { dseq: "1234", reason: "no_lease" } })]);
    await followToastAction("View deployment");

    expect(push).toHaveBeenCalledWith("/deployments/1234");
  });

  it("announces nothing for a close Console made that was already in the feed when it first heard of it", () => {
    const { enqueueSnackbar } = setup({
      activities: [buildActivity({ status: "succeeded", initiator: "system", meta: { dseq: "1234", reason: "trial_ended" } })]
    });

    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("announces nothing while an action is still pending", () => {
    const pending = buildActivity({ status: "pending" });
    const { enqueueSnackbar, receive } = setup({ activities: [] });

    receive([pending]);

    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("announces nothing and refreshes nothing when an alert fires", () => {
    const { enqueueSnackbar, queryClient, receive } = setup({ activities: [] });

    receive([
      buildActivity({
        type: "deployment_closed_alert",
        status: "info",
        meta: { alertId: "4f1c2a8e-0b5d-4e6f-9a7b-1c2d3e4f5a6b", summary: "Deployment 1234 closed", dseq: "1234" }
      })
    ]);

    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
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

  describe("with a feed carrying a type it doesn't know yet", () => {
    it("announces and refreshes only the actions it knows when they finish together", async () => {
      const unknown = buildActivityOfUnknownType({ status: "pending", meta: { dseq: "9999" } });
      const known = buildActivity({ status: "pending", meta: { dseq: "1234" } });
      const { enqueueSnackbar, queryClient, receive } = await setupFeed({ activities: [unknown, known] });

      await receive([
        { ...unknown, status: "succeeded" },
        { ...known, status: "succeeded" }
      ]);

      await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledTimes(1));
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Deployment 1234 closed" }) }), {
        variant: "success"
      });
      expect(invalidatedKeysOf(queryClient)).toContainEqual(QueryKeys.getDeploymentDetailKey(OWNER, "1234"));
      expect(invalidatedKeysOf(queryClient)).not.toContainEqual(QueryKeys.getDeploymentDetailKey(OWNER, "9999"));
    });

    it("looks up the names of the deployments only for the actions it knows", async () => {
      const { useDeploymentNames } = await setupFeed({
        activities: [buildActivityOfUnknownType({ meta: { dseq: "9999" } }), buildActivity({ meta: { dseq: "1234" } })]
      });

      expect(useDeploymentNames).toHaveBeenLastCalledWith(["1234"]);
    });

    async function setupFeed(input: { activities: ActivityOfAnyType[] }) {
      let activities = input.activities;
      const fetch = vi.fn(async () => jsonResponse({ data: { activities, unseenCount: 0, pagination: { limit: 100, hasMore: false, nextCursor: null } } }));
      const feedClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();
      const enqueueSnackbar = vi.fn().mockReturnValue(TOAST_KEY);
      const useLatestActivitiesQuery = vi.fn(DEPENDENCIES.useLatestActivitiesQuery);
      const useDeploymentNames = vi.fn((() =>
        mock<ReturnType<typeof DEPENDENCIES.useDeploymentNames>>({
          getDeploymentName: () => null,
          isLoading: false
        })) as typeof DEPENDENCIES.useDeploymentNames);

      const dependencies: typeof DEPENDENCIES = {
        useFlag: () => true,
        useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: buildUser() }),
        useWallet: () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: OWNER }),
        useLatestActivitiesQuery,
        useDeploymentNames,
        useCloseBatchesBeingSent: () => new Set(),
        useHandledActivityOutcomes: () => ({ isOutcomeHandled: () => false, isFollowedOnItsPage: () => false, forgetHandledOutcome: vi.fn() }),
        useTakeHeldCreateEvent: () => vi.fn(),
        useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() }),
        useQueryClient: () => queryClient,
        useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>()
      };

      render(
        <TestContainerProvider services={{ queryClient: () => feedClient, api: () => createProxy(createApiSdk({ baseUrl: "", fetch })) }}>
          <ActivityHost dependencies={dependencies} />
        </TestContainerProvider>
      );
      await waitFor(() => expect(useLatestActivitiesQuery).toHaveLastReturnedWith(expect.objectContaining({ isSuccess: true })));

      const receive = async (next: ActivityOfAnyType[]) => {
        activities = next;
        await act(() => feedClient.refetchQueries());
      };

      return { enqueueSnackbar, queryClient, useDeploymentNames, receive };
    }
  });

  function invalidatedKeysOf(queryClient: ReturnType<typeof DEPENDENCIES.useQueryClient>) {
    return vi.mocked(queryClient.invalidateQueries).mock.calls.map(([filters]) => filters?.queryKey);
  }

  function setup(
    input: {
      isEnabled?: boolean;
      isSignedIn?: boolean;
      activities?: Activity[];
      address?: string;
      names?: Record<string, string>;
      heldCreateEvents?: Record<string, EventProperties>;
      handled?: Activity[];
      followed?: string[];
    } = {}
  ) {
    const user = buildUser();
    const forgetHandledOutcome = vi.fn();
    const isOutcomeHandled = (activity: Activity) =>
      (input.handled ?? []).some(handled => handled.type === activity.type && handled.meta.dseq === activity.meta.dseq && handled.status === activity.status);
    const isFollowedOnItsPage = (activity: Activity) => (input.followed ?? []).includes(activity.id);
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
    const takeHeldCreateEvent = vi.fn((activityId: string) => input.heldCreateEvents?.[activityId]);
    const analyticsService = mock<AnalyticsService>();
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
      useHandledActivityOutcomes: () => ({ isOutcomeHandled, isFollowedOnItsPage, forgetHandledOutcome }),
      useTakeHeldCreateEvent: () => takeHeldCreateEvent,
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar }),
      useQueryClient: () => queryClient,
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push })
    };

    const host = () => (
      <TestContainerProvider services={{ api: () => api, analyticsService: () => analyticsService }}>
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

    return {
      useLatestActivitiesQuery,
      useDeploymentNames,
      useFlag,
      enqueueSnackbar,
      closeSnackbar,
      push,
      queryClient,
      api,
      user,
      forgetHandledOutcome,
      receive,
      followToastAction,
      analyticsService,
      takeHeldCreateEvent
    };
  }
});
