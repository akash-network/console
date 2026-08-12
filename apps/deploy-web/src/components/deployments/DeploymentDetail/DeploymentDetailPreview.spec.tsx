import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, DeploymentDetailPreview } from "./DeploymentDetailPreview";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentDetailPreview", () => {
  it("renders the deployment detail page when the preview flag is on", () => {
    const DeploymentDetail = vi.fn((_props: { dseq: string }) => <div>deployment-detail</div>);
    const { useFlag } = setup({ isPreviewEnabled: true, dependencies: { DeploymentDetail } });

    expect(screen.getByText("deployment-detail")).toBeInTheDocument();
    expect(useFlag).toHaveBeenCalledWith("deployment_detail_preview");
    expect(DeploymentDetail.mock.calls[0]?.[0]).toEqual({ dseq: "1786440078202" });
  });

  it("renders a not-available page when the preview flag is off", () => {
    setup({ isPreviewEnabled: false });

    expect(screen.getByText("This page is not available.")).toBeInTheDocument();
    expect(screen.queryByText("deployment-detail")).not.toBeInTheDocument();
  });

  function setup(input: { isPreviewEnabled: boolean; dependencies?: Partial<typeof DEPENDENCIES> }) {
    const useFlag = vi.fn(() => input.isPreviewEnabled);
    const DeploymentDetail = () => <div>deployment-detail</div>;

    return {
      useFlag,
      ...render(
        <DeploymentDetailPreview dseq="1786440078202" dependencies={MockComponents(DEPENDENCIES, { useFlag, DeploymentDetail, ...input.dependencies })} />
      )
    };
  }
});
