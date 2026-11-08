import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { TemplateAskedValue } from "@src/types/marketplace-template";
import { DEPENDENCIES, TemplateReadmeTab } from "./TemplateReadmeTab";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildTemplateVersion } from "@tests/seeders/userTemplate";
import { MockComponents } from "@tests/unit/mocks";

type CreateVersionMutation = ReturnType<typeof DEPENDENCIES.useCreateTemplateVersionMutation>;

const SDL = 'version: "2.0"\nservices:\n  webui:\n    image: ghcr.io/open-webui/open-webui:0.4.8\n';
const ADMIN_EMAIL: TemplateAskedValue = {
  key: "ADMIN_EMAIL",
  label: "Admin email",
  required: true,
  bindings: [{ service: "webui", env: "ADMIN_EMAIL" }],
  type: "text"
};
const README = "# Open WebUI\n\nA private chat app for your team.";

describe(TemplateReadmeTab.name, () => {
  it("renders the README with the same markdown component and no raw HTML", () => {
    const { Markdown, container } = setup({ readme: "# Open WebUI\n\n<script>window.pwned = true</script>" });

    expect(screen.getByRole("heading", { name: "Open WebUI" })).toBeInTheDocument();
    expect(screen.getByText("<script>window.pwned = true</script>")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(Markdown).toHaveBeenCalledWith(expect.not.objectContaining({ hasHtml: expect.anything() }), expect.anything());
  });

  it("never links a README to a script", () => {
    setup({ readme: "[x](javascript:alert(1))" });

    expect(screen.getByRole("link", { name: "x" })).toHaveAttribute("href", "javascript:void(0)");
  });

  it("shows a placeholder when the version has no README", () => {
    setup({ readme: null });

    expect(screen.getByText("No README yet")).toBeInTheDocument();
  });

  it("offers editing the README only to editors", () => {
    setup({ canEdit: false });

    expect(screen.queryByRole("button", { name: "Edit README" })).not.toBeInTheDocument();
  });

  it("saves an edited README as a new version from the current one", async () => {
    const { createVersion, enqueueSnackbar } = setup({ canEdit: true });

    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));
    const editor = screen.getByRole("textbox", { name: "README" });
    expect(editor).toHaveValue(README);
    await userEvent.type(editor, "\n\nRuns on one GPU.");
    await userEvent.click(screen.getByRole("button", { name: "Save README" }));

    expect(createVersion).toHaveBeenCalledWith({
      id: "tpl-webui",
      data: { sdl: SDL, askedValues: [ADMIN_EMAIL], readme: `${README}\n\nRuns on one GPU.`, baseVersion: 3 }
    });
    expect(screen.queryByRole("textbox", { name: "README" })).not.toBeInTheDocument();
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
  });

  it("clears the README when the editor is emptied", async () => {
    const { createVersion } = setup({ canEdit: true });

    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "README" }));
    await userEvent.type(screen.getByRole("textbox", { name: "README" }), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Save README" }));

    expect(createVersion).toHaveBeenCalledWith({ id: "tpl-webui", data: expect.objectContaining({ readme: null }) });
  });

  it("starts an empty editor for a version without a README", async () => {
    setup({ canEdit: true, readme: null });

    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));

    expect(screen.getByRole("textbox", { name: "README" })).toHaveValue("");
  });

  it("previews the draft with the same markdown component", async () => {
    setup({ canEdit: true });

    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));
    await userEvent.type(screen.getByRole("textbox", { name: "README" }), "\n\n## First login");
    await userEvent.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByRole("heading", { name: "First login" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "README" })).not.toBeInTheDocument();
  });

  it("drops the draft on cancel", async () => {
    const { createVersion } = setup({ canEdit: true });

    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));
    await userEvent.type(screen.getByRole("textbox", { name: "README" }), " draft");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(createVersion).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "README" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Open WebUI" })).toBeInTheDocument();
  });

  it("shows the length limit on the README editor", async () => {
    setup({ canEdit: true, readme: "# Hi" });

    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));
    const editor = screen.getByRole("textbox", { name: "README" });
    expect(screen.getByText("4 / 50,000")).not.toHaveClass("text-destructive");
    expect(editor).toHaveAccessibleDescription("4 / 50,000");

    fireEvent.change(editor, { target: { value: "a".repeat(50_001) } });

    expect(screen.getByText("50,001 / 50,000")).toHaveClass("text-destructive");
    expect(screen.getByRole("button", { name: "Save README" })).toBeDisabled();
  });

  it("warns when someone saved a newer version", async () => {
    const { enqueueSnackbar } = setup({ canEdit: true, saveError: new ApiError(409, { message: "Version 3 is no longer current" }, "conflict") });

    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));
    await userEvent.type(screen.getByRole("textbox", { name: "README" }), " edited");
    await userEvent.click(screen.getByRole("button", { name: "Save README" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Someone saved a newer version. Reload to see it.");
    expect(screen.getByRole("textbox", { name: "README" })).toHaveValue(`${README} edited`);
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("forgets the newer-version warning once the editor is closed", async () => {
    setup({ canEdit: true, saveError: new ApiError(409, { message: "Version 3 is no longer current" }, "conflict") });

    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));
    await userEvent.click(screen.getByRole("button", { name: "Save README" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("accepts a README at the length limit", async () => {
    setup({ canEdit: true });

    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));
    fireEvent.change(screen.getByRole("textbox", { name: "README" }), { target: { value: "a".repeat(50_000) } });

    expect(screen.getByRole("button", { name: "Save README" })).toBeEnabled();
  });

  it("has nothing to preview for a blank draft", async () => {
    setup({ canEdit: true });

    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "README" }));
    await userEvent.type(screen.getByRole("textbox", { name: "README" }), "  ");
    await userEvent.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByText("Nothing to preview")).toBeInTheDocument();
  });

  it("reports any other failed save and keeps the draft", async () => {
    const { enqueueSnackbar } = setup({ canEdit: true, saveError: new ApiError(503, { message: "Unavailable" }, "unavailable") });

    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));
    await userEvent.click(screen.getByRole("button", { name: "Save README" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ subTitle: "Try again in a moment." }) }), {
      variant: "error"
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "README" })).toBeInTheDocument();
  });

  it("shows why the API refused the README instead of suggesting a retry", async () => {
    const issue = 'Service "web" env HF_TOKEN is bound to a secret but holds a plaintext value';
    const { enqueueSnackbar } = setup({
      canEdit: true,
      saveError: new ApiError(400, { code: "template_invalid", message: issue, data: { issues: [issue] } }, "bad request")
    });

    await userEvent.click(screen.getByRole("button", { name: "Edit README" }));
    await userEvent.click(screen.getByRole("button", { name: "Save README" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't save the README", subTitle: issue }) }),
      { variant: "error" }
    );
    expect(screen.getByRole("textbox", { name: "README" })).toBeInTheDocument();
  });

  function setup(input: { canEdit?: boolean; readme?: string | null; saveError?: unknown }) {
    const createVersion = vi.fn<CreateVersionMutation["mutateAsync"]>(async () => {
      if (input.saveError) throw input.saveError;
      return mock<Awaited<ReturnType<CreateVersionMutation["mutateAsync"]>>>();
    });
    const enqueueSnackbar = vi.fn();
    const createVersionMutation = mock<CreateVersionMutation>({ mutateAsync: createVersion, isPending: false });
    const snackbar = mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar });
    const Markdown = vi.fn(DEPENDENCIES.Markdown);
    const version = buildTemplateVersion({
      version: 3,
      sdl: SDL,
      askedValues: [structuredClone(ADMIN_EMAIL)],
      readme: input.readme === undefined ? README : input.readme
    });

    const dependencies = MockComponents(DEPENDENCIES, {
      Markdown,
      useCreateTemplateVersionMutation: () => createVersionMutation,
      useSnackbar: () => snackbar
    });

    const { container } = render(<TemplateReadmeTab templateId="tpl-webui" version={version} canEdit={input.canEdit ?? false} dependencies={dependencies} />);

    return { createVersion, enqueueSnackbar, Markdown, container };
  }
});
