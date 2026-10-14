import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./RenameProjectDialog";
import { RenameProjectDialog } from "./RenameProjectDialog";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(RenameProjectDialog.name, () => {
  it("renames the project under its slug and closes", async () => {
    const { updateProject, enqueueSnackbar, onClose } = setup({});

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), "Shop Front");
    expect(screen.getByText("shop-front")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect(updateProject).toHaveBeenCalledWith({ id: "p1", data: { name: "shop-front" } });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not rename to the name it already has", () => {
    setup({});

    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();
  });

  it("refuses a name another project uses before asking the api", async () => {
    const { updateProject } = setup({});

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), "marketing");

    expect(screen.getByText("A project named marketing already exists.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename" })).toBeDisabled();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it("refuses a name the api reports as taken and stays open", async () => {
    const { onClose } = setup({ updateError: new ApiError(409, { message: "taken", code: "project_name_taken" }, "conflict") });

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), "billing{Enter}");

    expect(await screen.findByText("A project named billing already exists.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("reports any other failure", async () => {
    const { enqueueSnackbar, onClose } = setup({ updateError: new Error("boom") });

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), "billing{Enter}");

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not rename twice while a rename is under way", async () => {
    const { updateProject } = setup({ isPending: true });

    await userEvent.clear(nameInput());
    await userEvent.type(nameInput(), "billing");
    fireEvent.submit(screen.getByRole("dialog").querySelector("form") as HTMLFormElement);

    expect(updateProject).not.toHaveBeenCalled();
  });

  it("closes on cancel and when dismissed, but not during a rename", async () => {
    const { onClose } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("stays open when dismissed during a rename", async () => {
    const { onClose } = setup({ isPending: true });

    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });

  function nameInput() {
    return screen.getByLabelText("Project name");
  }

  function setup(input: { updateError?: unknown; isPending?: boolean }) {
    const onClose = vi.fn();
    const enqueueSnackbar = vi.fn();
    const updateProject = vi.fn(async () => {
      if (input.updateError) throw input.updateError;
    });
    const dependencies: typeof DEPENDENCIES = {
      useUpdateProjectMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useUpdateProjectMutation>>({ mutateAsync: updateProject as never, isPending: input.isPending ?? false }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    render(
      <RenameProjectDialog project={{ id: "p1", name: "storefront" }} takenNames={["storefront", "marketing"]} onClose={onClose} dependencies={dependencies} />
    );

    return { onClose, enqueueSnackbar, updateProject };
  }
});
