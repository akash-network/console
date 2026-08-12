import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, DeploymentDetailRouter } from "./DeploymentDetailRouter";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentDetailRouter", () => {
  it("renders the redesigned page when the redesign flag is on", () => {
    setup({ isRedesignEnabled: true });

    expect(screen.getByText("redesigned")).toBeInTheDocument();
    expect(screen.queryByText("legacy")).not.toBeInTheDocument();
  });

  it("renders the legacy page when the redesign flag is off", () => {
    setup({ isRedesignEnabled: false });

    expect(screen.getByText("legacy")).toBeInTheDocument();
    expect(screen.queryByText("redesigned")).not.toBeInTheDocument();
  });

  it("passes the dseq through to the rendered page", () => {
    const DeploymentDetail = vi.fn((_props: { dseq: string }) => <div>redesigned</div>);
    setup({ isRedesignEnabled: true, dependencies: { DeploymentDetail } });

    expect(DeploymentDetail.mock.calls[0]?.[0]).toEqual({ dseq: "1786440078202" });
  });

  function setup(input: { isRedesignEnabled: boolean; dependencies?: Partial<typeof DEPENDENCIES> }) {
    const useFlag: typeof DEPENDENCIES.useFlag = () => input.isRedesignEnabled;
    const DeploymentDetail = () => <div>redesigned</div>;
    const DeploymentDetailLegacy = () => <div>legacy</div>;

    return render(
      <DeploymentDetailRouter
        dseq="1786440078202"
        dependencies={MockComponents(DEPENDENCIES, { useFlag, DeploymentDetail, DeploymentDetailLegacy, ...input.dependencies })}
      />
    );
  }
});
