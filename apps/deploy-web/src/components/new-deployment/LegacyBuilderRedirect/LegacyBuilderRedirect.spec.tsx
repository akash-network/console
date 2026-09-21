import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES, LegacyBuilderRedirect } from "./LegacyBuilderRedirect";

import { render, screen } from "@testing-library/react";

describe(LegacyBuilderRedirect.name, () => {
  it("renders the picker for a bare new-deployment link", () => {
    const { replace } = setup({ query: {} });

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("picker")).toBeInTheDocument();
  });

  it("opens a template link on configure", () => {
    const { replace } = setup({ query: { step: "edit-deployment", templateId: "tpl-1" } });

    expect(replace).toHaveBeenCalledWith("/new-deployment/configure?templateId=tpl-1");
    expect(screen.queryByText("picker")).not.toBeInTheDocument();
  });

  it("opens a blank editor link on a blank configure", () => {
    const { replace } = setup({ query: { step: "edit-deployment" } });

    expect(replace).toHaveBeenCalledWith("/new-deployment/configure");
  });

  it("resumes a deployment that was mid-creation on configure", () => {
    const { replace } = setup({ query: { step: "create-leases", dseq: "555" } });

    expect(replace).toHaveBeenCalledWith("/new-deployment/configure/555");
  });

  it("sends a redeploy link to the deployment, where redeploy lives now", () => {
    const { replace } = setup({ query: { redeploy: "42", step: "edit-deployment", templateId: "x" } });

    expect(replace).toHaveBeenCalledWith(expect.stringContaining("/deployments/42"));
  });

  it.each([
    ["a git provider", { gitProvider: "github", templateId: "x" }, "/new-deployment/configure?templateId=x"],
    ["a repository badge", { repoUrl: "https://github.com/acme/app" }, "/new-deployment/configure"],
    ["an oauth callback", { code: "abc", state: "gitlab" }, "/new-deployment/configure"]
  ])("lands %s link, whose flow is retired, on configure", (_case, query, destination) => {
    const { replace } = setup({ query });

    expect(replace).toHaveBeenCalledWith(destination);
  });

  function setup(input: { query: Record<string, string> }) {
    const replace = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ query: input.query, replace })) as typeof DEPENDENCIES.useRouter
    };
    render(
      <LegacyBuilderRedirect dependencies={dependencies}>
        <div>picker</div>
      </LegacyBuilderRedirect>
    );
    return { replace };
  }
});
