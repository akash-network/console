import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import type { DEPENDENCIES } from "./OrganizationNameSetting";
import { OrganizationNameSetting } from "./OrganizationNameSetting";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("OrganizationNameSetting", () => {
  it("shows the current name with Save disabled", () => {
    setup({});

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Acme Corp");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAccessibleDescription("Shown to members across Console and in invitations.");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves the trimmed name with inner spaces collapsed and announces the rename", async () => {
    const { user, renameOrganization, enqueueSnackbar } = setup({});
    renameOrganization.mockImplementation((input, options) => options?.onSuccess?.({ data: { ...ACME, name: "Acme Labs" } }, input, undefined));

    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "  Acme   Labs ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(renameOrganization).toHaveBeenCalledWith({ id: "org-2", data: { name: "Acme Labs" } }, expect.anything());
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Acme Labs");
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Organization renamed", subTitle: "Acme Corp is now Acme Labs." }) }),
      { variant: "success" }
    );
  });

  it("saves on Enter", async () => {
    const { user, renameOrganization } = setup({});

    await user.type(screen.getByRole("textbox", { name: "Name" }), " Labs{Enter}");

    expect(renameOrganization).toHaveBeenCalledWith({ id: "org-2", data: { name: "Acme Corp Labs" } }, expect.anything());
  });

  it("reverts to the current name on Escape", async () => {
    const { user } = setup({});

    await user.type(screen.getByRole("textbox", { name: "Name" }), " Labs{Escape}");

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Acme Corp");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it.each([
    { typed: "  Acme   Corp ", reason: "only differs in spacing" },
    { typed: "A", reason: "is shorter than 2 characters" },
    { typed: "   ", reason: "is blank" }
  ])("keeps Save disabled while the name $reason", async ({ typed }) => {
    const { user } = setup({});

    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), typed);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("enables Save for a two-character name", async () => {
    const { user } = setup({});

    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Ac");

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("refuses a name another of the user's organizations already has, ignoring case", async () => {
    const { user, renameOrganization } = setup({});

    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "globex{Enter}");

    expect(screen.getByText("You already belong to an organization with this name.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(renameOrganization).not.toHaveBeenCalled();
  });

  it("lets the name differ from the current one only in case", async () => {
    const { user } = setup({});

    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "ACME CORP");

    expect(screen.queryByText("You already belong to an organization with this name.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows the api's refusal of a taken name until the name changes", async () => {
    const { user, renameOrganization } = setup({});
    renameOrganization.mockImplementation((input, options) =>
      options?.onError?.(new ApiError(409, { code: "organization_name_taken" }, "PATCH"), input, undefined)
    );

    await user.type(screen.getByRole("textbox", { name: "Name" }), " Labs{Enter}");

    expect(screen.getByText("You already belong to an organization with this name.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Name" }), "!");

    expect(screen.getByText("Shown to members across Console and in invitations.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("explains a name the api refuses as invalid", async () => {
    const { user, renameOrganization } = setup({});
    renameOrganization.mockImplementation((input, options) => options?.onError?.(new ApiError(400, { code: "validation_error" }, "PATCH"), input, undefined));

    await user.type(screen.getByRole("textbox", { name: "Name" }), " Labs{Enter}");

    expect(screen.getByText("This name can't be used. Try another one.")).toBeInTheDocument();
  });

  it("reports any other failure in a snackbar", async () => {
    const { user, renameOrganization, enqueueSnackbar } = setup({});
    renameOrganization.mockImplementation((input, options) => options?.onError?.(new ApiError(403, {}, "PATCH"), input, undefined));

    await user.type(screen.getByRole("textbox", { name: "Name" }), " Labs{Enter}");

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't rename the organization" }) }), {
      variant: "error"
    });
    expect(screen.getByText("Shown to members across Console and in invitations.")).toBeInTheDocument();
  });

  it("keeps Save disabled while a rename is in flight", async () => {
    const { user } = setup({ isPending: true });

    await user.type(screen.getByRole("textbox", { name: "Name" }), " Labs");

    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
  });

  function setup(input: { isPending?: boolean }) {
    const renameOrganization = vi.fn<ReturnType<typeof DEPENDENCIES.useRenameOrganizationMutation>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useActiveOrganization: () => mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ organizations: [PERSONAL, ACME, GLOBEX] }),
      useRenameOrganizationMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useRenameOrganizationMutation>>({ mutate: renameOrganization, isPending: input.isPending ?? false }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    render(<OrganizationNameSetting organization={ACME} dependencies={dependencies} />);

    return { user: userEvent.setup(), renameOrganization, enqueueSnackbar };
  }
});

const ACME: OrganizationOutput = {
  id: "org-2",
  name: "Acme Corp",
  slug: "acme-corp",
  type: "team",
  role: "admin",
  isActive: true,
  createdAt: "2026-02-01T00:00:00Z"
};

const GLOBEX: OrganizationOutput = { ...ACME, id: "org-3", name: "Globex", slug: "globex", isActive: false };

const PERSONAL: OrganizationOutput = { ...ACME, id: "org-1", name: "alice", slug: "personal-0123456789ab", type: "personal", role: "owner", isActive: false };
