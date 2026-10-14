import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Project } from "@src/types/project";
import type { DEPENDENCIES } from "./MoveDeploymentDialog";
import { MoveDeploymentDialog } from "./MoveDeploymentDialog";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(MoveDeploymentDialog.name, () => {
  it("offers every other project, most recently active first", () => {
    setup({});

    expect(screen.getByRole("dialog", { name: "Move to project" })).toBeInTheDocument();
    expect(screen.getByText("Choose the project acme-web belongs to. It keeps running while it moves.")).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map(radio => radio.getAttribute("aria-label"))).toEqual(["marketing", "storefront"]);
    expect(screen.getByRole("radio", { name: "storefront" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move" })).toBeDisabled();
  });

  it("names an unnamed deployment by its dseq", () => {
    setup({ name: null });

    expect(screen.getByText("Choose the project Deployment #100 belongs to. It keeps running while it moves.")).toBeInTheDocument();
  });

  it("files the deployment under the project picked and closes", async () => {
    const { updateDeploymentProject, enqueueSnackbar, onClose } = setup({});

    await userEvent.click(screen.getByText("marketing"));
    await userEvent.click(screen.getByRole("button", { name: "Move" }));

    expect(updateDeploymentProject).toHaveBeenCalledWith({ dseq: "100", data: { projectId: "marketing" } });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    [404, "That project or deployment no longer exists here. The list of projects was refreshed.", 1],
    [403, "Only owners and admins can move deployments between projects.", 0],
    [500, "Try again in a moment.", 0]
  ])("explains a %s refusal", async (status, reason, refetches) => {
    const { enqueueSnackbar, refetchProjects } = setup({ moveError: new ApiError(status, { message: "refused" }, "refused") });

    await userEvent.click(screen.getByText("marketing"));
    await userEvent.click(screen.getByRole("button", { name: "Move" }));

    const [snackbar, options] = enqueueSnackbar.mock.lastCall ?? [];
    expect(options).toEqual({ variant: "error" });
    expect(snackbar).toMatchObject({ props: { title: "Couldn't move the deployment", subTitle: reason } });
    expect(refetchProjects).toHaveBeenCalledTimes(refetches);
  });

  it("reports a failed move and stays open", async () => {
    const { enqueueSnackbar, onClose } = setup({ moveError: new Error("boom") });

    await userEvent.click(screen.getByText("marketing"));
    await userEvent.click(screen.getByRole("button", { name: "Move" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("moves nothing until another project is picked", () => {
    const { updateDeploymentProject } = setup({});

    fireEvent.submit(screen.getByRole("dialog").querySelector("form") as HTMLFormElement);

    expect(updateDeploymentProject).not.toHaveBeenCalled();
  });

  it("does not move twice while a move is under way", async () => {
    const { updateDeploymentProject } = setup({ isPending: true });

    await userEvent.click(screen.getByText("marketing"));
    fireEvent.submit(screen.getByRole("dialog").querySelector("form") as HTMLFormElement);

    expect(updateDeploymentProject).not.toHaveBeenCalled();
  });

  it("closes on cancel", async () => {
    const { onClose } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("closes when dismissed", async () => {
    const { onClose } = setup({});

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("stays open when dismissed during a move", async () => {
    const { onClose } = setup({ isPending: true });

    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });

  function setup(input: { name?: string | null; moveError?: unknown; isPending?: boolean }) {
    const onClose = vi.fn();
    const refetchProjects = vi.fn();
    const enqueueSnackbar = vi.fn();
    const updateDeploymentProject = vi.fn(async () => {
      if (input.moveError) throw input.moveError;
      return {};
    });
    const projects = [project("storefront", "2026-01-01T12:00:00.000Z"), project("marketing", "2026-03-01T12:00:00.000Z")];
    const dependencies: typeof DEPENDENCIES = {
      useProjectsQuery: () => mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: projects, refetch: refetchProjects }),
      useUpdateDeploymentProjectMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useUpdateDeploymentProjectMutation>>({
          mutateAsync: updateDeploymentProject as never,
          isPending: input.isPending ?? false
        }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    render(
      <MoveDeploymentDialog
        deployment={{ dseq: "100", name: input.name === undefined ? "acme-web" : input.name, projectId: "storefront" }}
        onClose={onClose}
        dependencies={dependencies}
      />
    );

    return { onClose, enqueueSnackbar, updateDeploymentProject, refetchProjects };
  }

  function project(name: string, createdAt: string): Project {
    return { id: name, name, slug: name, description: null, isDefault: false, createdAt, createdBy: null };
  }
});
