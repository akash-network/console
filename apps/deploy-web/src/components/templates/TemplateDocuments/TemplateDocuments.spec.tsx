import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ApiTemplate } from "@src/types";
import { rehypeRemoveDeployBadge } from "../rehypeRemoveDeployBadge/rehypeRemoveDeployBadge";
import { DEPENDENCIES, TemplateDocuments } from "./TemplateDocuments";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(TemplateDocuments.name, () => {
  it("shows the README first, rendering its HTML for awesome-akash templates", () => {
    const { Markdown } = setup({});

    expect(screen.getByRole("tab", { name: "README.md" })).toHaveAttribute("aria-selected", "true");
    expect(Markdown).toHaveBeenCalledWith(expect.objectContaining({ hasHtml: true, children: "# ComfyUI readme" }), {});
  });

  it("renders the README of a template from elsewhere as plain markdown", () => {
    const { Markdown } = setup({ template: { id: "community-template" } });

    expect(Markdown).toHaveBeenCalledWith(expect.objectContaining({ hasHtml: false }), {});
  });

  it("renders the README as plain markdown for a template without an id", () => {
    const { Markdown } = setup({ template: { id: undefined } });

    expect(Markdown).toHaveBeenCalledWith(expect.objectContaining({ hasHtml: undefined }), {});
  });

  it("strips the GitHub deploy badge from the README and the guide", async () => {
    const { Markdown } = setup({ template: { guide: "# How to use it" } });

    await userEvent.click(screen.getByRole("tab", { name: "GUIDE.md" }));

    expect(Markdown).toHaveBeenCalledWith(expect.objectContaining({ children: "# ComfyUI readme", rehypePlugins: [rehypeRemoveDeployBadge] }), {});
    expect(Markdown).toHaveBeenCalledWith(expect.objectContaining({ children: "# How to use it", rehypePlugins: [rehypeRemoveDeployBadge] }), {});
  });

  it("shows the template's SDL read-only when asked to", async () => {
    const { SDLEditor } = setup({ showsSdl: true });

    await userEvent.click(screen.getByRole("tab", { name: "deploy.yaml" }));

    expect(SDLEditor).toHaveBeenCalledWith(expect.objectContaining({ value: "version: '2.0'", readonly: true }), expect.anything());
  });

  it("offers no SDL unless asked to", () => {
    const { SDLEditor } = setup({});

    expect(screen.queryByRole("tab", { name: "deploy.yaml" })).not.toBeInTheDocument();
    expect(SDLEditor).not.toHaveBeenCalled();
  });

  it("shows the guide when the template has one", async () => {
    const { Markdown } = setup({ template: { guide: "# How to use it" } });

    await userEvent.click(screen.getByRole("tab", { name: "GUIDE.md" }));

    expect(Markdown).toHaveBeenLastCalledWith(expect.objectContaining({ children: "# How to use it" }), {});
  });

  it("offers no guide when the template has none", () => {
    setup({ template: { guide: "" } });

    expect(screen.queryByRole("tab", { name: "GUIDE.md" })).not.toBeInTheDocument();
  });

  it("links to the template's source repository", () => {
    setup({});

    const sourceLink = screen.getByRole("link", { name: /View the source on GitHub/ });
    expect(sourceLink).toHaveAttribute("href", "https://github.com/akash-network/awesome-akash/blob/9f6f799/comfyui");
    expect(sourceLink).toHaveAttribute("target", "_blank");
    expect(sourceLink).toHaveTextContent("akash-network/awesome-akash/comfyui");
  });

  it("leaves out the source link when the template has no repository", () => {
    setup({ template: { githubUrl: "" } });

    expect(screen.queryByRole("link", { name: /View the source on GitHub/ })).not.toBeInTheDocument();
  });

  function setup(input: { template?: Partial<ApiTemplate>; showsSdl?: boolean }) {
    const template: ApiTemplate = {
      id: "akash-network-awesome-akash-comfyui",
      readme: "# ComfyUI readme",
      deploy: "version: '2.0'",
      guide: "",
      githubUrl: "https://github.com/akash-network/awesome-akash/blob/9f6f799/comfyui",
      ...input.template
    };
    const Markdown = vi.fn(({ children }: { children?: React.ReactNode }) => <div>{children}</div>);
    const SDLEditor = vi.fn(() => null);
    const dependencies = MockComponents(DEPENDENCIES, { Markdown, SDLEditor: SDLEditor as never });

    render(<TemplateDocuments template={template} showsSdl={input.showsSdl} dependencies={dependencies} />);

    return { Markdown, SDLEditor };
  }
});
