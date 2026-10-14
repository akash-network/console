import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./ProjectFolderMenu";
import { ProjectFolderMenu } from "./ProjectFolderMenu";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProjectFolderMenu.name, () => {
  it("renames the project in a dialog that knows the names in use", async () => {
    const { RenameProjectDialog } = setup({});

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Rename" }));

    expect(RenameProjectDialog.mock.lastCall?.[0]).toMatchObject({ project: { id: "p1", name: "storefront" }, takenNames: ["storefront", "marketing"] });
    await userEvent.click(screen.getByRole("button", { name: "close rename" }));
    expect(screen.queryByRole("button", { name: "close rename" })).not.toBeInTheDocument();
  });

  it("deletes the project once confirmed", async () => {
    const { deleteProject, enqueueSnackbar, confirm } = setup({});

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Delete storefront?" }));
    expect(deleteProject).toHaveBeenCalledWith({ id: "p1" });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
  });

  it("keeps the project when the delete is not confirmed", async () => {
    const { deleteProject } = setup({ isConfirmed: false });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(deleteProject).not.toHaveBeenCalled();
  });

  it.each([
    ["project_not_empty", "It still holds open deployments. Close them or move them to another project first."],
    ["project_is_default", "The default project can't be deleted."],
    ["something_else", "Try again in a moment."]
  ])("explains a %s refusal", async (code, reason) => {
    const { enqueueSnackbar } = setup({ deleteError: new ApiError(409, { message: "refused", code }, "conflict") });

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    const [snackbar, options] = enqueueSnackbar.mock.lastCall ?? [];
    expect(options).toEqual({ variant: "error" });
    expect(snackbar).toMatchObject({ props: { title: "Couldn't delete the project", subTitle: reason } });
  });

  it("offers no delete for the default project", async () => {
    setup({ isDefault: true });

    await openMenu();

    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  async function openMenu() {
    await userEvent.click(screen.getByRole("button", { name: "Actions for project storefront" }));
  }

  function setup(input: { isDefault?: boolean; isConfirmed?: boolean; deleteError?: unknown }) {
    const confirm = vi.fn(async () => input.isConfirmed ?? true);
    const enqueueSnackbar = vi.fn();
    const deleteProject = vi.fn(async () => {
      if (input.deleteError) throw input.deleteError;
    });
    const RenameProjectDialog = vi.fn<typeof DEPENDENCIES.RenameProjectDialog>(({ onClose }) => (
      <button type="button" onClick={onClose}>
        close rename
      </button>
    ));
    const dependencies: typeof DEPENDENCIES = {
      usePopup: () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useDeleteProjectMutation: () => mock<ReturnType<typeof DEPENDENCIES.useDeleteProjectMutation>>({ mutateAsync: deleteProject as never }),
      RenameProjectDialog
    };

    render(
      <ProjectFolderMenu
        project={{ id: "p1", name: "storefront", isDefault: input.isDefault ?? false }}
        takenNames={["storefront", "marketing"]}
        dependencies={dependencies}
      />
    );

    return { confirm, enqueueSnackbar, deleteProject, RenameProjectDialog };
  }
});
