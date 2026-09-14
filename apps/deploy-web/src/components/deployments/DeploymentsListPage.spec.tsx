import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, DeploymentsListPage } from "./DeploymentsListPage";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentsListPage", () => {
  it("serves the current list while the redesign flag is off", () => {
    setup({ isRedesignEnabled: false });

    expect(screen.getByText("current list")).toBeInTheDocument();
    expect(screen.queryByText("redesigned list")).not.toBeInTheDocument();
  });

  it("serves the redesigned list while the flag is on", () => {
    setup({ isRedesignEnabled: true });

    expect(screen.getByText("redesigned list")).toBeInTheDocument();
    expect(screen.queryByText("current list")).not.toBeInTheDocument();
  });

  it("reads the redesign flag by its name", () => {
    const { useFlag } = setup({ isRedesignEnabled: true });

    expect(useFlag).toHaveBeenCalledWith("ui_deployments_list_redesign");
  });

  function setup(input: { isRedesignEnabled: boolean }) {
    const useFlag = vi.fn<typeof DEPENDENCIES.useFlag>(() => input.isRedesignEnabled);
    const DeploymentList = vi.fn(() => <div>current list</div>);
    const DeploymentsList = vi.fn(() => <div>redesigned list</div>);

    render(<DeploymentsListPage dependencies={MockComponents(DEPENDENCIES, { useFlag, DeploymentList, DeploymentsList })} />);

    return { useFlag };
  }
});
