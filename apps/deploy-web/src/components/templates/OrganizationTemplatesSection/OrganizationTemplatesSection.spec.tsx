import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserTemplateListItem } from "@src/types/marketplace-template";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, OrganizationTemplatesSection } from "./OrganizationTemplatesSection";

import { render, screen, within } from "@testing-library/react";
import { buildUserTemplateListItem } from "@tests/seeders/userTemplate";
import { MockComponents } from "@tests/unit/mocks";

const COMFY = buildUserTemplateListItem({
  id: "tpl-comfy",
  title: "ComfyUI + Flux.1 dev",
  summary: "Image generation with a shared model cache.",
  icon: "image",
  visibility: "organization",
  currentVersion: { version: 4, status: "live", createdAt: "2026-11-05T12:00:00.000Z" }
});
const INTERNAL_API = buildUserTemplateListItem({
  id: "tpl-api",
  title: "Internal API",
  summary: null,
  icon: null,
  visibility: "organization",
  currentVersion: null
});
const OTHER_ORGANIZATION_TEMPLATE = buildUserTemplateListItem({
  id: "tpl-other",
  title: "Other org worker",
  summary: "Runs the queue.",
  icon: "server",
  visibility: "organization",
  currentVersion: { version: 2, status: "live", createdAt: "2026-11-06T12:00:00.000Z" }
});

type OrganizationTemplatesQuery = ReturnType<typeof DEPENDENCIES.useOrganizationTemplates>;
type CustomUser = ReturnType<typeof DEPENDENCIES.useCustomUser>;

describe(OrganizationTemplatesSection.name, () => {
  it("shows the organization's shared templates at the top of the gallery", () => {
    const { TemplateIcon } = setup({ templates: [COMFY, INTERNAL_API] });

    const section = screen.getByRole("region", { name: "Your organization" });
    const comfy = within(section).getByRole("link", { name: /ComfyUI \+ Flux\.1 dev/ });
    expect(comfy).toHaveAttribute("href", UrlService.template(COMFY.id));
    expect(within(comfy).getByText("Image generation with a shared model cache.")).toBeInTheDocument();
    expect(within(comfy).getByText("v4")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /Internal API/ })).toHaveAttribute("href", UrlService.template(INTERNAL_API.id));
    expect(TemplateIcon).toHaveBeenCalledWith(expect.objectContaining({ icon: "image" }), {});
    expect(TemplateIcon).toHaveBeenCalledWith(expect.objectContaining({ icon: null }), {});
  });

  it("deploys an organization template from its card", () => {
    setup({ templates: [COMFY] });

    const section = screen.getByRole("region", { name: "Your organization" });
    const deploy = within(section).getByRole("link", { name: "Deploy", description: "ComfyUI + Flux.1 dev" });
    expect(deploy).toHaveAttribute("href", UrlService.configureDeployment({ userTemplateId: COMFY.id }));
  });

  it("offers no deploy for a template saved without a version", () => {
    setup({ templates: [INTERNAL_API] });

    expect(within(screen.getByRole("region", { name: "Your organization" })).queryByRole("link", { name: "Deploy" })).not.toBeInTheDocument();
  });

  it("shows a template saved without a version without a version label", () => {
    setup({ templates: [INTERNAL_API] });

    expect(within(screen.getByRole("region", { name: "Your organization" })).queryByText(/^v\d/)).not.toBeInTheDocument();
  });

  it("asks for the organization's templates only for a signed in user with template_marketplace", () => {
    const { useOrganizationTemplates } = setup({ templates: [COMFY] });

    expect(useOrganizationTemplates).toHaveBeenLastCalledWith({ enabled: true });
  });

  it("stays hidden when the organization shares none", () => {
    setup({ templates: [] });

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("stays hidden while the templates load", () => {
    setup({ isLoading: true });

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("stays hidden when the templates could not be loaded", () => {
    setup({ isError: true });

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("stays hidden for visitors and without template_marketplace", () => {
    const visitor = setup({ templates: [COMFY], isSignedIn: false });

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(visitor.useOrganizationTemplates).toHaveBeenLastCalledWith({ enabled: false });
    visitor.unmount();

    const withoutFlag = setup({ templates: [COMFY], isFlagOn: false });

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(withoutFlag.useOrganizationTemplates).toHaveBeenLastCalledWith({ enabled: false });
  });

  it("shows the new organization's templates after a switch", () => {
    const { rerenderWithTemplates } = setup({ templates: [COMFY] });

    rerenderWithTemplates([OTHER_ORGANIZATION_TEMPLATE]);

    const section = screen.getByRole("region", { name: "Your organization" });
    expect(within(section).getByRole("link", { name: /Other org worker/ })).toHaveAttribute("href", UrlService.template(OTHER_ORGANIZATION_TEMPLATE.id));
    expect(within(section).queryByText("ComfyUI + Flux.1 dev")).not.toBeInTheDocument();
  });

  function setup(input: { templates?: UserTemplateListItem[]; isLoading?: boolean; isError?: boolean; isSignedIn?: boolean; isFlagOn?: boolean }) {
    let query = toQuery(input);
    const user = mock<CustomUser>({ user: input.isSignedIn === false ? undefined : mock<NonNullable<CustomUser["user"]>>({ userId: "user-1" }) });
    const TemplateIcon = vi.fn<typeof DEPENDENCIES.TemplateIcon>(() => null);
    const useOrganizationTemplates = vi.fn<typeof DEPENDENCIES.useOrganizationTemplates>(() => query);

    const dependencies = MockComponents(DEPENDENCIES, {
      useFlag: flag => flag === "template_marketplace" && input.isFlagOn !== false,
      useCustomUser: () => user,
      useOrganizationTemplates,
      TemplateIcon
    });

    const { rerender, unmount } = render(<OrganizationTemplatesSection dependencies={dependencies} />);

    const rerenderWithTemplates = (templates: UserTemplateListItem[]) => {
      query = toQuery({ templates });
      rerender(<OrganizationTemplatesSection dependencies={dependencies} />);
    };

    return { TemplateIcon, useOrganizationTemplates, rerenderWithTemplates, unmount };
  }

  function toQuery(input: { templates?: UserTemplateListItem[]; isLoading?: boolean; isError?: boolean }) {
    if (input.isLoading) return mock<OrganizationTemplatesQuery>({ data: undefined, isLoading: true, isError: false });
    if (input.isError) return mock<OrganizationTemplatesQuery>({ data: undefined, isLoading: false, isError: true });
    return mock<OrganizationTemplatesQuery>({ data: structuredClone(input.templates ?? []), isLoading: false, isError: false });
  }
});
