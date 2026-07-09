import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { DEPENDENCIES, RedirectMappableBuilderToConfigure } from "./RedirectMappableBuilderToConfigure";

import { render, screen } from "@testing-library/react";

describe(RedirectMappableBuilderToConfigure.name, () => {
  it("redirects a template intent to configure when the flag is on", () => {
    const { replace } = setup({ flag: true, query: { step: "edit-deployment", templateId: "tpl-1" } });
    expect(replace).toHaveBeenCalledWith("/new-deployment/configure?templateId=tpl-1");
    expect(screen.queryByText("classic")).not.toBeInTheDocument();
  });

  it("redirects a blank edit-deployment intent to blank configure", () => {
    const { replace } = setup({ flag: true, query: { step: "edit-deployment" } });
    expect(replace).toHaveBeenCalledWith("/new-deployment/configure");
  });

  it("renders the classic builder when the flag is off", () => {
    const { replace } = setup({ flag: false, query: { step: "edit-deployment", templateId: "tpl-1" } });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("classic")).toBeInTheDocument();
  });

  it("does not redirect git or redeploy intents", () => {
    const { replace } = setup({ flag: true, query: { step: "edit-deployment", gitProvider: "github", templateId: "x" } });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("classic")).toBeInTheDocument();
  });

  it("does not redirect a bare CI/CD template link (a git intent the classic builder owns)", () => {
    const { replace } = setup({ flag: true, query: { templateId: CI_CD_TEMPLATE_ID } });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("classic")).toBeInTheDocument();
  });

  function setup(input: { flag: boolean; query: Record<string, string> }) {
    const replace = vi.fn();
    const d: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useFlag: (() => input.flag) as typeof DEPENDENCIES.useFlag,
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
