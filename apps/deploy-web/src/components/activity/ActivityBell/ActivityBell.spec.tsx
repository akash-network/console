import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { DEPENDENCIES } from "./ActivityBell";
import { ActivityBell } from "./ActivityBell";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(ActivityBell.name, () => {
  it("renders nothing while the activity center is off", () => {
    const { useLatestActivitiesQuery, useUnseenActivityCountQuery } = setup({ isEnabled: false });

    expect(screen.queryByRole("button", { name: /activity/i })).not.toBeInTheDocument();
    expect(useLatestActivitiesQuery).toHaveBeenCalledWith({ enabled: false });
    expect(useUnseenActivityCountQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("renders nothing for a signed-out visitor", () => {
    setup({ isSignedIn: false });

    expect(screen.queryByRole("button", { name: /activity/i })).not.toBeInTheDocument();
  });

  it("shows how many entries the user hasn't seen", () => {
    setup({ unseenCount: 3 });

    expect(screen.getByRole("button", { name: "Activity, 3 unseen" })).toHaveTextContent("3");
  });

  it("shows a count of 9 as it is", () => {
    setup({ unseenCount: 9 });

    expect(screen.getByRole("button", { name: "Activity, 9 unseen" })).toHaveTextContent(/^9$/);
  });

  it("caps the count it shows at 9+", () => {
    setup({ unseenCount: 12 });

    expect(screen.getByRole("button", { name: "Activity, 12 unseen" })).toHaveTextContent("9+");
  });

  it("shows no count once everything is seen", () => {
    setup({ unseenCount: 0 });

    expect(screen.getByRole("button", { name: "Activity" })).toHaveTextContent("");
  });

  it("lists recent entries newest first, each linking to the deployment it is about", async () => {
    const { useDeploymentNames } = setup({
      activities: [buildActivity({ status: "succeeded", meta: { dseq: "1" } }), buildActivity({ status: "pending", meta: { dseq: "2" } })],
      names: { "1": "web-api" }
    });

    await open();

    expect(useDeploymentNames).toHaveBeenCalledWith(["1", "2"]);
    const entries = screen.getAllByRole("menuitem");
    expect(entries.map(entry => entry.getAttribute("href"))).toEqual(["/deployments/1", "/deployments/2"]);
    expect(entries[0]).toHaveTextContent("Closed “web-api”");
    expect(entries[1]).toHaveTextContent("Closing deployment 2");
  });

  it("shows a spinner on an entry still running", async () => {
    setup({ activities: [buildActivity({ status: "pending", meta: { dseq: "2" } })] });

    await open();

    expect(within(screen.getByRole("menuitem")).getByRole("status")).toBeInTheDocument();
  });

  it("shows why an entry failed and links it to where the deployment can be closed again", async () => {
    setup({
      activities: [buildActivity({ status: "failed", meta: { dseq: "1", error: { code: "close_incomplete", message: "The deployment is still open." } } })]
    });

    await open();

    const entry = screen.getByRole("menuitem");
    expect(entry).toHaveTextContent("Couldn't close deployment 1");
    expect(entry).toHaveTextContent("The deployment is still open.");
    expect(entry).toHaveAttribute("href", "/deployments/1?tab=SETTINGS");
  });

  it("shows how long ago each entry happened", async () => {
    setup({ activities: [buildActivity({ status: "succeeded", createdAt: new Date(Date.now() - 5 * 60_000).toISOString() })] });

    await open();

    expect(screen.getByRole("menuitem")).toHaveTextContent("5 minutes ago");
  });

  it("lists at most 10 entries", async () => {
    setup({ activities: Array.from({ length: 12 }, () => buildActivity()) });

    await open();

    expect(screen.getAllByRole("menuitem")).toHaveLength(10);
  });

  it("says so when there is no activity yet", async () => {
    setup({ activities: [] });

    await open();

    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("marks everything up to the newest entry seen once opened", async () => {
    const newest = buildActivity({ createdAt: "2026-10-08T10:00:00.000Z" });
    const { markSeen } = setup({ activities: [newest, buildActivity({ createdAt: "2026-10-08T09:00:00.000Z" })], unseenCount: 2 });

    await open();

    expect(markSeen).toHaveBeenCalledWith({ data: { upTo: "2026-10-08T10:00:00.000Z" } });
  });

  it("marks nothing when opened with nothing unseen", async () => {
    const { markSeen } = setup({ activities: [buildActivity()], unseenCount: 0 });

    await open();

    expect(markSeen).not.toHaveBeenCalled();
  });

  it("refreshes the feed once entries are marked seen", () => {
    const { api, queryClient } = setup({});

    api.v1.markActivitiesSeen.useMutation.mock.calls.at(-1)?.[0]?.onSuccess?.(mock(), mock(), mock());

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["listActivities"] });
  });

  async function open() {
    await userEvent.click(screen.getByRole("button", { name: /^Activity/ }));
  }

  function setup(input: { isEnabled?: boolean; isSignedIn?: boolean; activities?: Activity[]; unseenCount?: number; names?: Record<string, string> }) {
    const markSeen = vi.fn();
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();
    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.listActivities.getKey.mockReturnValue(["listActivities"]);
    api.v1.markActivitiesSeen.useMutation.mockReturnValue(mock<ReturnType<typeof api.v1.markActivitiesSeen.useMutation>>({ mutate: markSeen }));
    const useUnseenActivityCountQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useUnseenActivityCountQuery>>(), {
        data: input.unseenCount ?? 0
      })) as typeof DEPENDENCIES.useUnseenActivityCountQuery);
    const useDeploymentNames = vi.fn((() =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentNames>>({
        getDeploymentName: dseq => input.names?.[String(dseq)] ?? null,
        isLoading: false
      })) as typeof DEPENDENCIES.useDeploymentNames);
    const useLatestActivitiesQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>(), {
        data: input.activities ?? [buildActivity()]
      })) as typeof DEPENDENCIES.useLatestActivitiesQuery);

    const dependencies: typeof DEPENDENCIES = {
      useFlag: flag => flag === "notifications_activity_center" && (input.isEnabled ?? true),
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : buildUser() }),
      useLatestActivitiesQuery,
      useUnseenActivityCountQuery,
      useDeploymentNames,
      useQueryClient: () => queryClient
    };

    render(
      <TestContainerProvider services={{ api: () => api }}>
        <ActivityBell dependencies={dependencies} />
      </TestContainerProvider>
    );

    return { markSeen, api, queryClient, useLatestActivitiesQuery, useUnseenActivityCountQuery, useDeploymentNames };
  }
});
