import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Project } from "@src/types/project";
import type { DEPENDENCIES } from "./NewProjectModal";
import { NewProjectModal } from "./NewProjectModal";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(NewProjectModal.name, () => {
  it("explains what a project is in the organization", () => {
    setup({ organizationName: "Acme Corp" });

    expect(screen.getByRole("dialog", { name: "New project" })).toHaveTextContent("A project groups the deployments behind one app or service in Acme Corp.");
  });

  it("starts with the naming rule and a disabled create button", () => {
    setup({});

    expect(screen.getByText("Lowercase letters, numbers and hyphens.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create project" })).toBeDisabled();
  });

  it("tells how a name that is not a slug will be created", async () => {
    const { user } = setup({});

    await user.type(screen.getByLabelText("Project name"), "Checkout API");

    expect(screen.getByText("Will be created as")).toHaveTextContent("Will be created as checkout-api");
    expect(screen.getByRole("button", { name: "Create project" })).toBeEnabled();
  });

  it("keeps the naming rule for a name that already is a slug", async () => {
    const { user } = setup({});

    await user.type(screen.getByLabelText("Project name"), "checkout-api");

    expect(screen.getByText("Lowercase letters, numbers and hyphens.")).toBeInTheDocument();
  });

  it("refuses a name the organization already uses", async () => {
    const { user, createProject } = setup({ existingSlugs: ["storefront"] });

    await user.type(screen.getByLabelText("Project name"), "Storefront");

    expect(screen.getByText("A project named storefront already exists.")).toBeInTheDocument();
    expect(screen.getByLabelText("Project name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Create project" })).toBeDisabled();
    await user.keyboard("{Enter}");
    expect(createProject).not.toHaveBeenCalled();
  });

  it("creates the project as its slug with the trimmed description on Enter and reports it", async () => {
    const { user, createProject, enqueueSnackbar, onCreated } = setup({});

    await user.type(screen.getByLabelText("Project name"), "Checkout API");
    await user.type(screen.getByLabelText(/Description/), "  Payments and carts.  ");
    await user.type(screen.getByLabelText("Project name"), "{Enter}");

    expect(createProject).toHaveBeenCalledWith({ data: { name: "checkout-api", description: "Payments and carts." } });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Created project checkout-api" }) }), {
      variant: "success"
    });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ slug: "checkout-api" }));
  });

  it("leaves the description out when empty", async () => {
    const { user, createProject } = setup({});

    await user.type(screen.getByLabelText("Project name"), "api");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(createProject).toHaveBeenCalledWith({ data: { name: "api" } });
  });

  it("caps the description at 140 characters", () => {
    setup({});

    expect(screen.getByLabelText(/Description/)).toHaveAttribute("maxlength", "140");
  });

  it("shows the name as taken when the api refuses it", async () => {
    const { user, onCreated } = setup({ createError: new ApiError(409, { code: "project_name_taken" }, "POST /v1/projects -> 409") });

    await user.type(screen.getByLabelText("Project name"), "storefront{Enter}");

    expect(await screen.findByText("A project named storefront already exists.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create project" })).toBeDisabled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("reports any other failure as a toast", async () => {
    const { user, enqueueSnackbar, onCreated } = setup({ createError: new Error("boom") });

    await user.type(screen.getByLabelText("Project name"), "storefront{Enter}");

    await vi.waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't create the project" }) }), {
        variant: "error"
      })
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("tells the organization's project limit when it is reached", async () => {
    const { user, enqueueSnackbar, onCreated } = setup({
      createError: new ApiError(403, { code: "project_limit_reached", data: { limit: 10 } }, "POST /v1/projects -> 403")
    });

    await user.type(screen.getByLabelText("Project name"), "storefront{Enter}");

    await vi.waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({ title: "Couldn't create the project", subTitle: expect.stringContaining("its limit of 10 projects") })
        }),
        { variant: "error" }
      )
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("closes on cancel", async () => {
    const { user, onClose } = setup({});

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  function setup(input: { organizationName?: string; existingSlugs?: string[]; createError?: Error }) {
    const createProject = vi.fn(async ({ data }: { data: { name: string; description?: string } }) => {
      if (input.createError) throw input.createError;
      return { data: mock<Project>({ id: "p-new", name: data.name, slug: data.name, description: data.description ?? null }) };
    });
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();
    const onCreated = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useCreateProjectMutation: () => mock<ReturnType<typeof DEPENDENCIES.useCreateProjectMutation>>({ mutateAsync: createProject, isPending: false }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    render(
      <NewProjectModal
        organizationName={input.organizationName ?? "Acme Corp"}
        existingSlugs={input.existingSlugs ?? []}
        onClose={onClose}
        onCreated={onCreated}
        dependencies={dependencies}
      />
    );

    return { user: userEvent.setup(), createProject, enqueueSnackbar, onClose, onCreated };
  }
});
