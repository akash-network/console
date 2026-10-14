import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeployTarget } from "@src/hooks/useDeployTarget/useDeployTarget";
import type { Project } from "@src/types/project";
import type { DEPENDENCIES } from "./ConfigureDeployTargetChip";
import { ConfigureDeployTargetChip } from "./ConfigureDeployTargetChip";

import { render, screen } from "@testing-library/react";

describe(ConfigureDeployTargetChip.name, () => {
  it("shows where the deployment goes and lets the gate take a changed project", () => {
    const { DeployTargetChip, target } = setup({ project: mock<Project>({ id: "storefront" }) });

    expect(screen.getByText("chip")).toBeInTheDocument();
    const props = DeployTargetChip.mock.lastCall?.[0];
    expect(props?.target).toMatchObject({ isMissing: false, project: { id: "storefront" } });
    expect(props?.onChoose).toBe(target.chooseProject);
  });

  it("shows nothing once the deployment exists, since its project is settled", () => {
    setup({ project: mock<Project>({ id: "storefront" }), isFiled: true });

    expect(screen.queryByText("chip")).not.toBeInTheDocument();
  });

  it("shows nothing while no project is chosen, since the gate asks for one", () => {
    setup({ project: undefined });

    expect(screen.queryByText("chip")).not.toBeInTheDocument();
  });

  function setup(input: { project: Project | undefined; isFiled?: boolean }) {
    const target = mock<DeployTarget>({ project: input.project, isMissing: !input.project, isFiled: input.isFiled ?? false, chooseProject: vi.fn() });
    const DeployTargetChip = vi.fn<typeof DEPENDENCIES.DeployTargetChip>(() => <span>chip</span>);

    render(<ConfigureDeployTargetChip dependencies={{ useConfigureDeployTarget: () => target, DeployTargetChip }} />);

    return { DeployTargetChip, target };
  }
});
