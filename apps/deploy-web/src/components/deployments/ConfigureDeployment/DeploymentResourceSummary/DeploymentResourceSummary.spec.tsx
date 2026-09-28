import { describe, expect, it } from "vitest";

import type { DeploymentResourceSegment } from "./deploymentResources";
import type { DEPENDENCIES } from "./DeploymentResourceSummary";
import { DeploymentResourceSummary } from "./DeploymentResourceSummary";

import { render, screen, within } from "@testing-library/react";

describe(DeploymentResourceSummary.name, () => {
  it("lists each resource segment with its value", () => {
    setup({
      segments: [
        { kind: "cpu", label: "4 vCPU" },
        { kind: "gpu", label: "1 GPU" },
        { kind: "memory", label: "16 GiB" },
        { kind: "storage", label: "100 GiB" }
      ]
    });

    const items = within(screen.getByRole("list", { name: "Deployment resources" })).getAllByRole("listitem");
    expect(items.map(item => item.textContent)).toEqual(["4 vCPU", "1 GPU", "16 GiB", "100 GiB"]);
  });

  it("gives every segment an icon that stays hidden from assistive technology", () => {
    const { container } = setup({ segments: [{ kind: "persistent", label: "10 GiB persistent" }] });

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders nothing for a spec without resources", () => {
    setup({ segments: [] });

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  function setup(input: { segments: DeploymentResourceSegment[] }) {
    const dependencies: typeof DEPENDENCIES = { useDeploymentResourceSummary: () => input.segments };
    return render(<DeploymentResourceSummary dependencies={dependencies} />);
  }
});
