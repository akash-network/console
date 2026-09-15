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

  it("leaves the redesigned list on the chain while the api flag is off", () => {
    const { DeploymentsList, useFlag, useChainDeploymentsListSource } = setup({ isRedesignEnabled: true, isApiListEnabled: false });

    expect(useFlag).toHaveBeenCalledWith("ui_deployments_list_api");
    expect(DeploymentsList).toHaveBeenCalledWith(expect.objectContaining({ useDeploymentsListSource: useChainDeploymentsListSource }), expect.anything());
  });

  it("points the redesigned list at the console api once its flag is on", () => {
    const { DeploymentsList, useApiDeploymentsListSource } = setup({ isRedesignEnabled: true, isApiListEnabled: true });

    expect(DeploymentsList).toHaveBeenCalledWith(expect.objectContaining({ useDeploymentsListSource: useApiDeploymentsListSource }), expect.anything());
  });

  function setup(input: { isRedesignEnabled: boolean; isApiListEnabled?: boolean }) {
    const useFlag = vi.fn<typeof DEPENDENCIES.useFlag>(flag =>
      flag === "ui_deployments_list_api" ? input.isApiListEnabled ?? false : input.isRedesignEnabled
    );
    const DeploymentList = vi.fn(() => <div>current list</div>);
    const DeploymentsList = vi.fn(() => <div>redesigned list</div>);
    const useChainDeploymentsListSource = vi.fn<typeof DEPENDENCIES.useChainDeploymentsListSource>();
    const useApiDeploymentsListSource = vi.fn<typeof DEPENDENCIES.useApiDeploymentsListSource>();

    render(
      <DeploymentsListPage
        dependencies={MockComponents(DEPENDENCIES, { useFlag, DeploymentList, DeploymentsList, useChainDeploymentsListSource, useApiDeploymentsListSource })}
      />
    );

    return { useFlag, DeploymentsList, useChainDeploymentsListSource, useApiDeploymentsListSource };
  }
});
