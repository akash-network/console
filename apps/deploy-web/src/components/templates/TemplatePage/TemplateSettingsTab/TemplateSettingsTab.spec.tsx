import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { MarketplaceTemplate } from "@src/types/marketplace-template";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, TemplateSettingsTab } from "./TemplateSettingsTab";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildProject } from "@tests/seeders/project";
import { buildMarketplaceTemplate } from "@tests/seeders/userTemplate";
import { MockComponents } from "@tests/unit/mocks";

type UpdateMutation = ReturnType<typeof DEPENDENCIES.useUpdateTemplateSettingsMutation>;
type DeleteMutation = ReturnType<typeof DEPENDENCIES.useDeleteMarketplaceTemplateMutation>;

const PROJECT = buildProject({ name: "Inference" });
const TEMPLATE = buildMarketplaceTemplate({
  id: "tpl-webui",
  title: "Open WebUI + vLLM",
  summary: "Private chat on your own GPU.",
  icon: "message-square",
  categories: ["Chat"],
  visibility: "private",
  projectId: PROJECT.id,
  publisher: { name: "Northwind Labs", slug: "northwind-labs", type: "team" },
  canEdit: true
});

describe(TemplateSettingsTab.name, () => {
  it("saves title, summary, icon, categories and visibility", async () => {
    const { user, updateSettings, enqueueSnackbar } = setup({});

    await replaceText(user, screen.getByRole("textbox", { name: "Title" }), "  Open WebUI  ");
    await replaceText(user, screen.getByRole("textbox", { name: "Summary" }), "Chat with any model.");
    await user.click(screen.getByRole("radio", { name: "server" }));
    await user.click(screen.getByRole("checkbox", { name: "Chat" }));
    await user.click(screen.getByRole("checkbox", { name: "AI - GPU" }));
    await user.click(screen.getByRole("checkbox", { name: "Tools" }));
    await user.click(screen.getByRole("radio", { name: /Organization/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateSettings).toHaveBeenCalledWith({
      id: "tpl-webui",
      data: { title: "Open WebUI", summary: "Chat with any model.", icon: "server", categories: ["AI - GPU", "Tools"], visibility: "organization" }
    });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
  });

  it("leaves visibility alone when it was not changed", async () => {
    const { user, updateSettings } = setup({});

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateSettings).toHaveBeenCalledWith({
      id: "tpl-webui",
      data: { title: "Open WebUI + vLLM", summary: "Private chat on your own GPU.", icon: "message-square", categories: ["Chat"] }
    });
  });

  it("clears a blank summary and keeps the default icon unset", async () => {
    const { user, updateSettings } = setup({ template: { ...TEMPLATE, icon: null } });

    expect(screen.getByRole("radio", { name: "box" })).toBeChecked();
    await replaceText(user, screen.getByRole("textbox", { name: "Summary" }), "   ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateSettings).toHaveBeenCalledWith({ id: "tpl-webui", data: expect.objectContaining({ summary: null, icon: null }) });
  });

  it("offers all 24 icons and marks the template's own", () => {
    setup({});

    const icons = within(screen.getByRole("radiogroup", { name: "Icon" })).getAllByRole("radio");
    expect(icons).toHaveLength(24);
    expect(screen.getByRole("radio", { name: "message-square" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "box" })).not.toBeChecked();
  });

  it("blocks a fourth category and an over-long title", async () => {
    const { user, updateSettings } = setup({ template: { ...TEMPLATE, categories: ["Chat", "Games"] } });

    await user.click(screen.getByRole("checkbox", { name: "Tools" }));
    expect(screen.getByRole("checkbox", { name: "Social" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Tools" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Chat" })).toBeEnabled();
    expect(screen.getByText("Pick up to 3")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Tools" }));
    expect(screen.getByRole("checkbox", { name: "Social" })).toBeEnabled();

    await replaceText(user, screen.getByRole("textbox", { name: "Title" }), "x".repeat(81));
    expect(screen.getByText("81 / 80")).toHaveClass("text-destructive");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(updateSettings).not.toHaveBeenCalled();

    await replaceText(user, screen.getByRole("textbox", { name: "Title" }), "x".repeat(80));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("requires a title and caps the summary at 200 characters", async () => {
    const { user } = setup({});

    await replaceText(user, screen.getByRole("textbox", { name: "Title" }), "   ");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await replaceText(user, screen.getByRole("textbox", { name: "Title" }), "Open WebUI");
    await replaceText(user, screen.getByRole("textbox", { name: "Summary" }), "s".repeat(201));
    expect(screen.getByText("201 / 200")).toHaveClass("text-destructive");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await replaceText(user, screen.getByRole("textbox", { name: "Summary" }), "s".repeat(200));
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("names who can deploy a private and an organization template", () => {
    setup({});

    expect(screen.getByText("Members of Inference can deploy it.")).toBeInTheDocument();
    expect(screen.getByText("Every member of Northwind Labs can deploy it.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Private/ })).toBeChecked();
  });

  it("falls back to the active organization and a generic project name", () => {
    setup({ template: { ...TEMPLATE, projectId: null, publisher: null }, hasProjects: false });

    expect(screen.getByText("Members of its project can deploy it.")).toBeInTheDocument();
    expect(screen.getByText("Every member of Acme Corp can deploy it.")).toBeInTheDocument();
  });

  it("reads the projects only when the organization has them", () => {
    const { useProjectsQuery } = setup({ hasProjects: false });

    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("never offers public visibility", async () => {
    const { user, updateSettings } = setup({ template: { ...TEMPLATE, visibility: "public", projectId: null } });

    const options = within(screen.getByRole("radiogroup", { name: "Who can use it" })).getAllByRole("radio");
    expect(options.map(option => option.id)).toEqual(["visibility-private", "visibility-organization"]);
    for (const option of options) expect(option).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("is the current state.", { exact: false })).toHaveTextContent("Public is the current state.");
    expect(screen.getByText(/Making it private or organization-only takes it off its public link\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(updateSettings).toHaveBeenCalledWith({ id: "tpl-webui", data: expect.not.objectContaining({ visibility: expect.anything() }) });
  });

  it("shows no public note for a template that is not public", () => {
    setup({});

    expect(screen.queryByText(/takes it off its public link/)).not.toBeInTheDocument();
  });

  it("moves a public template to the visibility picked", async () => {
    const { user, updateSettings } = setup({ template: { ...TEMPLATE, visibility: "public" } });

    await user.click(screen.getByRole("radio", { name: /Private/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateSettings).toHaveBeenCalledWith({ id: "tpl-webui", data: expect.objectContaining({ visibility: "private" }) });
  });

  it("explains a refused save", async () => {
    const { user, enqueueSnackbar } = setup({ updateError: new ApiError(403, { message: "You cannot change this template" }, "forbidden") });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't save the settings", subTitle: "You can no longer change this template." }) }),
      { variant: "error" }
    );
  });

  it("suggests a retry when the save fails for another reason", async () => {
    const { user, enqueueSnackbar } = setup({ updateError: new ApiError(503, { message: "Unavailable" }, "unavailable") });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ subTitle: "Try again in a moment." }) }), {
      variant: "error"
    });
  });

  it("deletes after the title is typed and goes to My templates", async () => {
    const { user, deleteTemplate, router, enqueueSnackbar } = setup({});

    await user.click(screen.getByRole("button", { name: "Delete template" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Delete template" })).toBeDisabled();

    await user.type(within(dialog).getByRole("textbox"), "Open WebUI + vLLM");
    await user.click(within(dialog).getByRole("button", { name: "Delete template" }));

    expect(deleteTemplate).toHaveBeenCalledWith({ id: "tpl-webui" });
    expect(router.push).toHaveBeenCalledWith(UrlService.myTemplates());
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
  });

  it("does not delete while the typed title differs", async () => {
    const { user, deleteTemplate, router } = setup({});

    await user.click(screen.getByRole("button", { name: "Delete template" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Open WebUI");
    await user.click(within(dialog).getByRole("button", { name: "Delete template" }));
    await user.type(within(dialog).getByRole("textbox"), " + vLLM{Enter}");

    expect(deleteTemplate).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog open and explains a refused delete", async () => {
    const { user, deleteTemplate, router } = setup({ deleteError: new ApiError(403, { message: "You cannot change this template" }, "forbidden") });

    await user.click(screen.getByRole("button", { name: "Delete template" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Open WebUI + vLLM");
    await user.click(within(dialog).getByRole("button", { name: "Delete template" }));

    expect(deleteTemplate).toHaveBeenCalled();
    expect(within(dialog).getByText("You can no longer delete this template.")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("suggests a retry when the delete fails for another reason", async () => {
    const { user } = setup({ deleteError: new ApiError(503, { message: "Unavailable" }, "unavailable") });

    await user.click(screen.getByRole("button", { name: "Delete template" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Open WebUI + vLLM");
    await user.click(within(dialog).getByRole("button", { name: "Delete template" }));

    expect(within(dialog).getByText("Try again in a moment.")).toBeInTheDocument();
  });

  it("closes the delete dialog without deleting on Cancel", async () => {
    const { user, deleteTemplate } = setup({});

    await user.click(screen.getByRole("button", { name: "Delete template" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteTemplate).not.toHaveBeenCalled();
  });

  async function replaceText(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
    await user.clear(field);
    if (text) await user.click(field);
    if (text) await user.paste(text);
  }

  function setup(input: { template?: MarketplaceTemplate; updateError?: Error; deleteError?: Error; hasProjects?: boolean }) {
    const user = userEvent.setup();
    const enqueueSnackbar = vi.fn();
    const updateSettings = vi.fn<UpdateMutation["mutateAsync"]>(async () => {
      if (input.updateError) throw input.updateError;
      return mock<Awaited<ReturnType<UpdateMutation["mutateAsync"]>>>();
    });
    const deleteTemplate = vi.fn<DeleteMutation["mutateAsync"]>(async () => {
      if (input.deleteError) throw input.deleteError;
      return mock<Awaited<ReturnType<DeleteMutation["mutateAsync"]>>>();
    });
    const updateMutation = mock<UpdateMutation>({ mutateAsync: updateSettings, isPending: false });
    const deleteMutation = mock<DeleteMutation>({ mutateAsync: deleteTemplate, isPending: false });
    const hasProjects = input.hasProjects ?? true;
    const projectsQuery = mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: hasProjects ? [structuredClone(PROJECT)] : undefined });
    const organization = mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({
      activeOrganization: { id: "org-1", name: "Acme Corp" },
      projectsEnabled: hasProjects
    });
    const snackbar = mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar });
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push: vi.fn().mockResolvedValue(true) });
    const useProjectsQuery = vi.fn<typeof DEPENDENCIES.useProjectsQuery>(() => projectsQuery);
    const dependencies = MockComponents(DEPENDENCIES, {
      useUpdateTemplateSettingsMutation: () => updateMutation,
      useDeleteMarketplaceTemplateMutation: () => deleteMutation,
      useActiveOrganization: () => organization,
      useProjectsQuery,
      useSnackbar: () => snackbar,
      useRouter: () => router
    });

    render(<TemplateSettingsTab template={structuredClone(input.template ?? TEMPLATE)} dependencies={dependencies} />);

    return { user, updateSettings, deleteTemplate, enqueueSnackbar, router, useProjectsQuery };
  }
});
