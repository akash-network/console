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

  it("renders nothing when there is no archive to show", () => {
    setup({ count: 0 });

    expect(screen.queryByRole("button", { name: /Archive/ })).not.toBeInTheDocument();
  });

  function lastRenderedDeployments(DeploymentsCollection: Mock) {
    return DeploymentsCollection.mock.lastCall?.[0].deployments as NamedDeploymentDto[];
  }

  function setup(input: { count: number }) {
    const deployments = Array.from(
      { length: input.count },
      (_, index) => ({ dseq: `${100 + index}`, state: "closed", name: `archived-${index}` }) as NamedDeploymentDto
    );
    const DeploymentsCollection = vi.fn(() => <div>collection</div>);

    render(
      <DeploymentArchive deployments={deployments} providers={[]} viewMode="grid" dependencies={MockComponents(DEPENDENCIES, { DeploymentsCollection })} />
    );

    return { DeploymentsCollection };
  }
});
