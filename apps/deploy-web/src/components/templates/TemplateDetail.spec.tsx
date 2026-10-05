import React from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiTemplate } from "@src/types";
import { rehypeRemoveDeployBadge } from "./rehypeRemoveDeployBadge/rehypeRemoveDeployBadge";
import { DEPENDENCIES, TemplateDetail } from "./TemplateDetail";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(TemplateDetail.name, () => {
  it("shows the template's name without repeating the summary its README already opens with", () => {
    setup({});

    expect(screen.getByRole("heading", { level: 1, name: "ComfyUI" })).toBeInTheDocument();
    expect(screen.queryByText("The most powerful and modular stable diffusion GUI.")).not.toBeInTheDocument();
  });

  it("deploys the template through Configure", () => {
    setup({});

    expect(screen.getByRole("link", { name: "Deploy template" })).toHaveAttribute(
      "href",
      "/new-deployment/configure?templateId=akash-network-awesome-akash-comfyui"
    );
  });

  it("goes back to the previous page when the user arrived from within Console", () => {
    const { router, clickAndReportPrevented } = setup({ hasInAppHistory: true });

    const wasPrevented = clickAndReportPrevented(screen.getByRole("link", { name: "Back to templates" }));

    expect(wasPrevented).toBe(true);
    expect(router.back).toHaveBeenCalled();
  });

  it.each(["metaKey", "ctrlKey", "shiftKey", "altKey"] as const)("leaves a click with %s to the browser, to open the gallery elsewhere", modifier => {
    const { router, clickAndReportPrevented } = setup({ hasInAppHistory: true });

    const wasPrevented = clickAndReportPrevented(screen.getByRole("link", { name: "Back to templates" }), { [modifier]: true });

    expect(wasPrevented).toBe(false);
    expect(router.back).not.toHaveBeenCalled();
  });

  it("follows the link to the gallery when the user landed on the template directly", () => {
    const { router, clickAndReportPrevented } = setup({ hasInAppHistory: false });
    const backLink = screen.getByRole("link", { name: "Back to templates" });

    const wasPrevented = clickAndReportPrevented(backLink);

    expect(wasPrevented).toBe(false);
    expect(backLink).toHaveAttribute("href", "/templates");
    expect(router.back).not.toHaveBeenCalled();
  });

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

  it("shows the template's SDL read-only", async () => {
    const { SDLEditor } = setup({});

    await userEvent.click(screen.getByRole("tab", { name: "deploy.yaml" }));

    expect(SDLEditor).toHaveBeenCalledWith(expect.objectContaining({ value: "version: '2.0'", readonly: true }), expect.anything());
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

  it("describes what the template deploys as from its SDL", () => {
    const { TemplateDeploysAs } = setup({});

    expect(TemplateDeploysAs).toHaveBeenCalledWith({ sdl: "version: '2.0'" }, {});
  });

  it("explains what happens before deploying", () => {
    setup({});

    expect(screen.getByRole("region", { name: "Before you deploy" })).toBeInTheDocument();
  });

  function setup(input: { template?: Partial<ApiTemplate>; hasInAppHistory?: boolean }) {
    const template: ApiTemplate = {
      id: "akash-network-awesome-akash-comfyui",
      name: "ComfyUI",
      summary: "The most powerful and modular stable diffusion GUI.",
      readme: "# ComfyUI readme",
      deploy: "version: '2.0'",
      guide: "",
      githubUrl: "https://github.com/akash-network/awesome-akash/blob/9f6f799/comfyui",
      logoUrl: "https://example.com/comfyui.png",
      ...input.template
    };
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    const Markdown = vi.fn(({ children }: { children?: React.ReactNode }) => <div>{children}</div>);
    const SDLEditor = vi.fn(() => null);
    const TemplateDeploysAs = vi.fn(() => null);

    const dependencies = MockComponents(DEPENDENCIES, {
      useRouter: () => router,
      useHasInAppHistory: () => input.hasInAppHistory ?? false,
      Markdown,
      SDLEditor: SDLEditor as never,
      TemplateDeploysAs
    });

    const { container } = render(<TemplateDetail template={template} dependencies={dependencies} />);

    const clickAndReportPrevented = (element: HTMLElement, init?: MouseEventInit) => {
      let wasPrevented = false;
      const recordAndStopNavigation = (event: Event) => {
        wasPrevented = event.defaultPrevented;
        event.preventDefault();
      };
      container.addEventListener("click", recordAndStopNavigation);
      fireEvent.click(element, init);
      container.removeEventListener("click", recordAndStopNavigation);
      return wasPrevented;
    };

    return { container, router, Markdown, SDLEditor, TemplateDeploysAs, clickAndReportPrevented };
  }
});
