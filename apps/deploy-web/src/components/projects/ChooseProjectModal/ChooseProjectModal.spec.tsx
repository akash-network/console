import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Project } from "@src/types/project";
import type { DEPENDENCIES } from "./ChooseProjectModal";
import { ChooseProjectModal } from "./ChooseProjectModal";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ChooseProjectModal.name, () => {
  it("asks which project of the organization the deployment belongs to", () => {
    setup({});

    expect(screen.getByRole("dialog", { name: "Choose a project" })).toBeInTheDocument();
    expect(screen.getByText("Every deployment in Acme Corp belongs to a project.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("continues with the project picked", async () => {
    const { onChosen } = setup({});

    await userEvent.click(screen.getByText("marketing"));
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onChosen).toHaveBeenCalledWith(expect.objectContaining({ id: "marketing" }));
  });

  it("preselects the project already chosen", () => {
    setup({ initialProjectId: "storefront" });

    expect(screen.getByRole("radio", { name: "storefront" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("offers the default project like any other, so a member granted only it can deploy", () => {
    setup({ projects: [project("default", { isDefault: true })] });

    expect(screen.getByRole("radio", { name: "default" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Create a new project" })).not.toBeChecked();
  });

  it("offers no new project to a member who cannot create one", () => {
    setup({ canCreateProject: false, projects: [] });

    expect(screen.queryByRole("radio", { name: "Create a new project" })).not.toBeInTheDocument();
    expect(screen.getByText("You don't have access to any project yet. Ask an owner or admin.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("lists the projects of a member who cannot create one", () => {
    setup({ canCreateProject: false });

    expect(screen.getByRole("radio", { name: "storefront" })).toBeInTheDocument();
    expect(screen.queryByText("You don't have access to any project yet. Ask an owner or admin.")).not.toBeInTheDocument();
  });

  it("says why it asks again", () => {
    setup({ notice: "Choose another one." });

    expect(screen.getByRole("status")).toHaveTextContent("Choose another one.");
  });

  it("explains nothing when it asks for the first time", () => {
    setup({});

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("starts on a new project when the organization has none", () => {
    setup({ projects: [] });

    expect(screen.getByRole("radio", { name: "Create a new project" })).toBeChecked();
    expect(screen.getByLabelText("Project name")).toBeInTheDocument();
  });

  it("creates the new project under its slug and continues with it", async () => {
    const { createProject, onChosen, enqueueSnackbar } = setup({ projects: [] });

    await userEvent.type(screen.getByLabelText("Project name"), "Checkout API");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(createProject).toHaveBeenCalledWith({ data: { name: "checkout-api" } });
    expect(onChosen).toHaveBeenCalledWith(expect.objectContaining({ id: "checkout-api" }));
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
  });

  it("refuses a new project named like an existing one before asking the api", async () => {
    const { createProject } = setup({});

    await userEvent.click(screen.getByRole("radio", { name: "Create a new project" }));
    await userEvent.type(screen.getByLabelText("Project name"), "storefront");

    expect(screen.getByText("A project named storefront already exists.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(createProject).not.toHaveBeenCalled();
  });

  it("refuses a name the api reports as taken and stays open", async () => {
    const { onChosen, enqueueSnackbar } = setup({
      projects: [],
      createError: new ApiError(409, { message: "taken", code: "project_name_taken" }, "conflict")
    });

    await userEvent.type(screen.getByLabelText("Project name"), "billing");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("A project named billing already exists.")).toBeInTheDocument();
    expect(onChosen).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("reports any other failure to create the project", async () => {
    const { onChosen, enqueueSnackbar } = setup({ projects: [], createError: new Error("boom") });

    await userEvent.type(screen.getByLabelText("Project name"), "billing");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" });
    expect(onChosen).not.toHaveBeenCalled();
  });

  it("does not submit while a project is being created", () => {
    const { onChosen } = setup({ initialProjectId: "storefront", isPending: true });

    fireEvent.submit(screen.getByRole("dialog").querySelector("form") as HTMLFormElement);

    expect(onChosen).not.toHaveBeenCalled();
  });

  it("cancels on request", async () => {
    const { onCancel } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });

  it("cancels when dismissed", async () => {
    const { onCancel } = setup({});

    await userEvent.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalled();
  });

  it("stays open when dismissed while a project is being created", async () => {
    const { onCancel } = setup({ isPending: true });

    await userEvent.keyboard("{Escape}");

    expect(onCancel).not.toHaveBeenCalled();
  });

  function setup(input: {
    projects?: Project[];
    initialProjectId?: string;
    createError?: unknown;
    isPending?: boolean;
    canCreateProject?: boolean;
    notice?: string;
  }) {
    const onChosen = vi.fn();
    const onCancel = vi.fn();
    const enqueueSnackbar = vi.fn();
    const createProject = vi.fn(async ({ data }: { data: { name: string } }) => {
      if (input.createError) throw input.createError;
      return { data: project(data.name) };
    });
    const dependencies: typeof DEPENDENCIES = {
      useCreateProjectMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCreateProjectMutation>>({ mutateAsync: createProject as never, isPending: input.isPending ?? false }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    render(
      <ChooseProjectModal
        organizationName="Acme Corp"
        projects={input.projects ?? [project("storefront"), project("marketing")]}
        initialProjectId={input.initialProjectId}
        canCreateProject={input.canCreateProject ?? true}
        notice={input.notice}
        onChosen={onChosen}
        onCancel={onCancel}
        dependencies={dependencies}
      />
    );

    return { onChosen, onCancel, enqueueSnackbar, createProject };
  }

  function project(name: string, overrides: Partial<Project> = {}): Project {
    return {
      id: name,
      name,
      slug: name,
      description: null,
      isDefault: false,
      createdAt: "2026-01-01T12:00:00.000Z",
      createdBy: null,
      deploymentSummary: { activeCount: 0, preview: [] },
      ...overrides
    };
  }
});
