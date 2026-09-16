import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";

import type { ListedDeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentArchive } from "./DeploymentArchive";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentArchive", () => {
  it("announces how many deployments are archived without listing them", () => {
    const { DeploymentsCollection } = setup({ count: 5 });

    expect(screen.getByRole("button", { name: /Archive \/\/ 5 closed/ })).toBeInTheDocument();
    expect(DeploymentsCollection).not.toHaveBeenCalled();
  });

  it("lists the archived deployments once expanded", async () => {
    const { DeploymentsCollection } = setup({ count: 2 });

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));

    expect(DeploymentsCollection).toHaveBeenCalledWith(
      expect.objectContaining({ deployments: expect.arrayContaining([expect.anything()]) }),
      expect.anything()
    );
  });

  it("lists only the page it was given, counting the whole archive in the header", async () => {
    const { DeploymentsCollection } = setup({ count: 10, totalCount: 38 });

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));

    expect(screen.getByRole("button", { name: /Archive \/\/ 38 closed/ })).toBeInTheDocument();
    expect(lastRenderedDeployments(DeploymentsCollection)).toHaveLength(10);
  });

  it("pages through the archive on demand", async () => {
    const { onNextPage, onPreviousPage } = setup({ count: 10, totalCount: 38, isPaginated: true, hasNextPage: true, pageIndex: 1 });

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));
    await userEvent.click(screen.getByRole("link", { name: "Go to next page" }));
    await userEvent.click(screen.getByRole("link", { name: "Go to previous page" }));

    expect(onNextPage).toHaveBeenCalled();
    expect(onPreviousPage).toHaveBeenCalled();
  });

  it("opens the way back once there is a page to go back to", async () => {
    setup({ count: 10, totalCount: 38, isPaginated: true, hasNextPage: true, pageIndex: 1 });

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));

    expect(screen.getByRole("link", { name: "Go to previous page" })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("offers no pagination when the archive fits on a single page", async () => {
    setup({ count: 5, totalCount: 5 });

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));

    expect(screen.queryByRole("link", { name: "Go to next page" })).not.toBeInTheDocument();
  });

  it("blocks the way back from the first page and the way on from the last", async () => {
    setup({ count: 10, totalCount: 38, isPaginated: true, hasNextPage: false });

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));

    expect(screen.getByRole("link", { name: "Go to previous page" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Go to next page" })).toHaveAttribute("aria-disabled", "true");
  });

  it("collapses again on demand", async () => {
    setup({ count: 2 });

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));
    expect(screen.getByRole("button", { name: /Archive/ })).toHaveAttribute("data-state", "open");

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));

    expect(screen.getByRole("button", { name: /Archive/ })).toHaveAttribute("data-state", "closed");
  });

  it("renders the archive in the view the reader picked", async () => {
    const { DeploymentsCollection } = setup({ count: 2, viewMode: "list" });

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));

    expect(DeploymentsCollection).toHaveBeenLastCalledWith(expect.objectContaining({ viewMode: "list" }), expect.anything());
  });

  it("names the archive without a count when the api could not count it", () => {
    setup({ count: 3, totalCount: null });

    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.queryByText(/closed/)).not.toBeInTheDocument();
  });

  it("still lists the rows it has when the count is unknown", async () => {
    const { DeploymentsCollection } = setup({ count: 3, totalCount: null });

    await userEvent.click(screen.getByRole("button", { name: "Archive" }));

    expect(lastRenderedDeployments(DeploymentsCollection)).toHaveLength(3);
  });

  it("renders nothing when the count is unknown and no rows came back", () => {
    setup({ count: 0, totalCount: null });

    expect(screen.queryByRole("button", { name: /Archive/ })).not.toBeInTheDocument();
  });

  it("renders nothing when there is no archive to show", () => {
    setup({ count: 0 });

    expect(screen.queryByRole("button", { name: /Archive/ })).not.toBeInTheDocument();
  });

  it("owns up to a failed archive query rather than looking like an account with no history", async () => {
    const { onRetry } = setup({ count: 0, isError: true });

    expect(screen.getByText("Couldn't load closed deployments.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Retry/ }));

    expect(onRetry).toHaveBeenCalled();
  });

  it("says the archive failed even when it still holds deployments from an earlier fetch", () => {
    setup({ count: 5, isError: true });

    expect(screen.getByText("Couldn't load closed deployments.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Archive \/\/ 5 closed/ })).not.toBeInTheDocument();
  });

  it("keeps the failure on screen and blocks a second Retry while the first is in flight", async () => {
    const { onRetry } = setup({ count: 0, isError: true, isRetrying: true });

    expect(screen.getByText("Couldn't load closed deployments.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Retry/ }), { pointerEventsCheck: 0 });

    expect(onRetry).not.toHaveBeenCalled();
  });

  function lastRenderedDeployments(DeploymentsCollection: Mock) {
    return DeploymentsCollection.mock.lastCall?.[0].deployments as ListedDeploymentDto[];
  }

  function setup(input: {
    count: number;
    totalCount?: number | null;
    viewMode?: "grid" | "list";
    isError?: boolean;
    isRetrying?: boolean;
    pageIndex?: number;
    isPaginated?: boolean;
    hasNextPage?: boolean;
  }) {
    const deployments = Array.from(
      { length: input.count },
      (_, index) => ({ dseq: `${100 + index}`, state: "closed", name: `archived-${index}` }) as ListedDeploymentDto
    );
    const DeploymentsCollection = vi.fn(() => <div>collection</div>);
    const onRetry = vi.fn();
    const onPreviousPage = vi.fn();
    const onNextPage = vi.fn();

    render(
      <DeploymentArchive
        deployments={deployments}
        totalCount={input.totalCount === undefined ? input.count : input.totalCount}
        providers={[]}
        viewMode={input.viewMode ?? "grid"}
        isError={input.isError ?? false}
        isRetrying={input.isRetrying ?? false}
        onRetry={onRetry}
        pageIndex={input.pageIndex ?? 0}
        hasNextPage={input.hasNextPage ?? false}
        isPaginated={input.isPaginated ?? false}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        dependencies={MockComponents(DEPENDENCIES, { DeploymentsCollection })}
      />
    );

    return { DeploymentsCollection, onRetry, onPreviousPage, onNextPage };
  }
});
