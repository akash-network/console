import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentCreation } from "@src/queries/useOrganizationActivitiesQuery";
import type { OrganizationType } from "@src/types/organization";
import { formatRelativeTime } from "@src/utils/relativeTime";
import type { DEPENDENCIES } from "./DeploymentCreatedBy";
import { DeploymentCreatedBy } from "./DeploymentCreatedBy";

import { render, screen } from "@testing-library/react";

describe("DeploymentCreatedBy", () => {
  it("names the member who deployed it in a team, with when", () => {
    const createdAt = "2026-11-20T10:00:00.000Z";
    const { container } = setup({ creation: { actor: { id: "u1", username: "lena" }, createdAt } });

    expect(screen.getByText("lena")).toBeInTheDocument();
    expect(container.textContent).toBe(`Deployed by lena·${formatRelativeTime(createdAt)}`);
    expect(container.querySelector("time")?.getAttribute("dateTime")).toBe(createdAt);
  });

  it("reads the deployment's creation in a team", () => {
    const { useDeploymentCreationQuery } = setup({ creation: null });

    expect(useDeploymentCreationQuery).toHaveBeenCalledWith("1786440078202", { enabled: true });
  });

  it("says a member who since deleted their account deployed it", () => {
    setup({ creation: { actor: null, createdAt: "2026-11-20T10:00:00.000Z" } });

    expect(screen.getByText("Deleted account")).toBeInTheDocument();
  });

  it("names a member without a username as a member", () => {
    setup({ creation: { actor: { id: "u1", username: null }, createdAt: "2026-11-20T10:00:00.000Z" } });

    expect(screen.getByText("a member")).toBeInTheDocument();
  });

  it("shows nothing for a deployment without a recorded creation", () => {
    const { container } = setup({ creation: null });

    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing and reads nothing in a personal organization, where only its owner deploys", () => {
    const { container, useDeploymentCreationQuery } = setup({
      organizationType: "personal",
      creation: { actor: { id: "u1", username: "lena" }, createdAt: "2026-11-20T10:00:00.000Z" }
    });

    expect(container).toBeEmptyDOMElement();
    expect(useDeploymentCreationQuery).toHaveBeenCalledWith("1786440078202", { enabled: false });
  });

  function setup(input: { creation: DeploymentCreation | null; organizationType?: OrganizationType }) {
    const useActiveOrganization: typeof DEPENDENCIES.useActiveOrganization = () =>
      mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
        activeOrganization: mock<NonNullable<ReturnType<typeof DEPENDENCIES.useActiveOrganization>["activeOrganization"]>>({
          type: input.organizationType ?? "team"
        })
      });
    const useDeploymentCreationQuery = vi.fn((_dseq: string, _options?: { enabled?: boolean }) =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentCreationQuery>>({ data: input.creation })
    );

    const { container } = render(<DeploymentCreatedBy dseq="1786440078202" dependencies={{ useActiveOrganization, useDeploymentCreationQuery }} />);

    return { container, useDeploymentCreationQuery };
  }
});
