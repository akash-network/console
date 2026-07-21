import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { DEPENDENCIES, RedirectMappableBuilderToConfigure } from "./RedirectMappableBuilderToConfigure";

import { render, screen } from "@testing-library/react";

describe(RedirectMappableBuilderToConfigure.name, () => {
  it("redirects a template intent to configure", () => {
    const { replace } = setup({ query: { step: "edit-deployment", templateId: "tpl-1" } });
    expect(replace).toHaveBeenCalledWith("/new-deployment/configure?templateId=tpl-1");
    expect(screen.queryByText("classic")).not.toBeInTheDocument();
  });

  it("redirects a blank edit-deployment intent to blank configure", () => {
    const { replace } = setup({ query: { step: "edit-deployment" } });
    expect(replace).toHaveBeenCalledWith("/new-deployment/configure");
  });

  it("does not redirect a git intent", () => {
    const { replace } = setup({ query: { step: "edit-deployment", gitProvider: "github", templateId: "x" } });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("classic")).toBeInTheDocument();
  });

  it("does not redirect a redeploy intent", () => {
    const { replace } = setup({ query: { step: "edit-deployment", redeploy: "dseq-1", templateId: "x" } });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("classic")).toBeInTheDocument();
  });

  it("does not redirect a bare CI/CD template link (a git intent the classic builder owns)", () => {
    const { replace } = setup({ query: { templateId: CI_CD_TEMPLATE_ID } });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("classic")).toBeInTheDocument();
  });

  function setup(input: { query: Record<string, string> }) {
    const replace = vi.fn();
    const d: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ query: input.query, replace })) as typeof DEPENDENCIES.useRouter
    };
    render(
      <RedirectMappableBuilderToConfigure dependencies={d}>
        <div>classic</div>
      </RedirectMappableBuilderToConfigure>
    );
    return { replace };
  }
});
