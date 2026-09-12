import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";

import type { NamedDeploymentDto } from "@src/types/deployment";
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

  it("reveals a page at a time so a long archive does not mount every deployment at once", async () => {
    const { DeploymentsCollection } = setup({ count: 20 });

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));

    expect(lastRenderedDeployments(DeploymentsCollection)).toHaveLength(12);

    await userEvent.click(screen.getByRole("button", { name: "Show more" }));

    expect(lastRenderedDeployments(DeploymentsCollection)).toHaveLength(20);
  });

  it("offers no Show more when the archive fits in a single reveal", async () => {
    setup({ count: 12 });

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));

    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("offers Show more as soon as one deployment falls outside the first reveal", async () => {
    setup({ count: 13 });

    await userEvent.click(screen.getByRole("button", { name: /Archive/ }));

    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
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

  function lastRenderedDeployments(DeploymentsCollection: Mock) {
    return DeploymentsCollection.mock.lastCall?.[0].deployments as NamedDeploymentDto[];
  }

  function setup(input: { count: number; viewMode?: "grid" | "list"; isError?: boolean }) {
    const deployments = Array.from(
      { length: input.count },
      (_, index) => ({ dseq: `${100 + index}`, state: "closed", name: `archived-${index}` }) as NamedDeploymentDto
    );
    const DeploymentsCollection = vi.fn(() => <div>collection</div>);
    const onRetry = vi.fn();

    render(
      <DeploymentArchive
        deployments={deployments}
        providers={[]}
        viewMode={input.viewMode ?? "grid"}
        isError={input.isError}
        onRetry={onRetry}
        dependencies={MockComponents(DEPENDENCIES, { DeploymentsCollection })}
      />
    );

    return { DeploymentsCollection, onRetry };
  }
});
