import { describe, expect, it, vi } from "vitest";

import type { OrganizationActivity } from "@src/types/organization-activity";
import { RecentActivityFeed } from "./RecentActivityFeed";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(RecentActivityFeed.name, () => {
  it("says so when nothing happened yet", () => {
    setup({ activities: [] });

    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("tells who did what, linking the deployment", () => {
    setup({
      activities: [activity({ actor: { id: "u1", username: "marcus" }, type: "deployment_created", payload: { dseq: "3140", name: "acme-storefront" } })]
    });

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("marcus deployed acme-storefront");
    expect(within(item).getByRole("link", { name: "acme-storefront" })).toHaveAttribute("href", "/deployments/3140");
  });

  it("shows a system icon instead of an avatar for an event nobody caused", () => {
    const { container } = setup({
      activities: [activity({ actor: null, type: "deployment_closed", payload: { dseq: "2987", name: "session-cache", reason: "runtime_limit_reached" } })]
    });

    expect(screen.getByRole("listitem")).toHaveTextContent("session-cache was closed when its runtime limit ran out");
    expect(container.querySelector("svg.lucide-clock")).not.toBeNull();
  });

  it("names an actor without a username generically", () => {
    setup({ activities: [activity({ actor: { id: "u1", username: null }, type: "organization_created", payload: {} })] });

    expect(screen.getByRole("listitem")).toHaveTextContent("A member created the organization");
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("says the activity could not be loaded and offers to retry", async () => {
    const { onRetry } = setup({ activities: [], isError: true });

    expect(screen.getByText("Couldn't load the activity.")).toBeInTheDocument();
    expect(screen.queryByText("No activity yet.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers no retry it cannot perform", () => {
    setup({ activities: [], isError: true, canRetry: false });

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("keeps the activity it already has when a later page fails", () => {
    setup({ activities: [activity({ type: "organization_created", payload: {} })], isError: true });

    expect(screen.getByRole("listitem")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load the activity.")).not.toBeInTheDocument();
  });

  it("shows the actor's initials", () => {
    setup({ activities: [activity({ actor: { id: "u1", username: "marcus chen" }, type: "organization_created", payload: {} })] });

    expect(screen.getByText("MC")).toBeInTheDocument();
  });

  it("names the project behind an item and links to it", () => {
    setup({
      activities: [activity({ projectId: "p1", actor: { id: "u1", username: "priya" }, type: "project_created", payload: { projectName: "storefront" } })],
      projects: [{ id: "p1", name: "storefront" }]
    });

    expect(screen.getByRole("link", { name: "storefront" })).toHaveAttribute("href", "/projects/p1");
  });

  it("tells how long ago each event happened", () => {
    setup({ activities: [activity({ createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() })] });

    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
  });

  it("offers more only while there is more, and asks for it on click", async () => {
    const { onShowMore } = setup({ activities: [activity({})], hasMore: true });

    await userEvent.click(screen.getByRole("button", { name: "Show more" }));

    expect(onShowMore).toHaveBeenCalledTimes(1);
  });

  function setup(input: {
    activities: OrganizationActivity[];
    projects?: { id: string; name: string }[];
    hasMore?: boolean;
    isError?: boolean;
    canRetry?: boolean;
  }) {
    const onShowMore = vi.fn();
    const onRetry = vi.fn();
    const view = render(
      <RecentActivityFeed
        activities={input.activities}
        projects={input.projects ?? []}
        hasMore={input.hasMore ?? false}
        onShowMore={onShowMore}
        isError={input.isError}
        onRetry={input.canRetry === false ? undefined : onRetry}
      />
    );
    return { ...view, onShowMore, onRetry };
  }
});

function activity(overrides: Partial<OrganizationActivity>): OrganizationActivity {
  return {
    id: "a1",
    projectId: null,
    actor: { id: "u1", username: "marcus" },
    type: "organization_created",
    payload: {},
    createdAt: new Date().toISOString(),
    ...overrides
  };
}
