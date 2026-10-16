import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationMemberOutput } from "@src/types/organizationMembership";
import type { DEPENDENCIES } from "./OwnershipTransferSetting";
import { OwnershipTransferSetting } from "./OwnershipTransferSetting";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("OwnershipTransferSetting", () => {
  it("offers every member but the owner, by name", async () => {
    const { user, useOrganizationMembersQuery } = setup({});

    await user.click(screen.getByRole("combobox", { name: "New owner" }));

    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["bob", "carol@acme.io", "dave"]);
    expect(useOrganizationMembersQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("keeps Transfer disabled until a member is chosen", () => {
    setup({});

    expect(screen.getByRole("button", { name: "Transfer" })).toBeDisabled();
    expect(screen.getByText("Make another member the owner of Acme Corp. You stay on as an Admin.")).toBeInTheDocument();
  });

  it("transfers ownership to the chosen member once the owner confirms", async () => {
    const { user, confirm, transferOwnership, enqueueSnackbar } = setup({});
    transferOwnership.mockImplementation((input, options) => options?.onSuccess?.({ data: { ...DAVE, role: "owner" } }, input, undefined));

    await chooseNewOwner(user, "dave");
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    expect(confirm).toHaveBeenCalledWith({
      title: "Transfer ownership to dave?",
      message: "dave becomes the owner of Acme Corp. You stay on as an Admin."
    });
    expect(transferOwnership).toHaveBeenCalledWith({ id: "member-dave" }, expect.anything());
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "dave is now the owner of Acme Corp" }) }), {
      variant: "success"
    });
  });

  it("does nothing when the owner cancels", async () => {
    const { user, transferOwnership } = setup({ isConfirmed: false });

    await chooseNewOwner(user, "bob");
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    expect(transferOwnership).not.toHaveBeenCalled();
  });

  it("explains a refused transfer", async () => {
    const { user, transferOwnership, enqueueSnackbar } = setup({});
    transferOwnership.mockImplementation((input, options) =>
      options?.onError?.(new ApiError(403, { code: "owner_role_restricted" }, "POST"), input, undefined)
    );

    await chooseNewOwner(user, "bob");
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Only the owner can change the owner's role or hand over ownership." }) }),
      { variant: "error" }
    );
  });

  it("falls back to a generic message for an unexplained failure", async () => {
    const { user, transferOwnership, enqueueSnackbar } = setup({});
    transferOwnership.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await chooseNewOwner(user, "bob");
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't transfer ownership to bob" }) }), {
      variant: "error"
    });
  });

  it("asks the owner to invite someone first when they are the only member", () => {
    setup({ members: [ALICE] });

    expect(screen.getByText("You're the only member of Acme Corp. Invite someone before you hand it over.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "New owner" })).toBeDisabled();
  });

  it("keeps the usual description while the members load", () => {
    setup({ members: undefined });

    expect(screen.getByText("Make another member the owner of Acme Corp. You stay on as an Admin.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "New owner" })).toBeDisabled();
  });

  async function chooseNewOwner(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(screen.getByRole("combobox", { name: "New owner" }));
    await user.click(screen.getByRole("option", { name }));
  }

  function setup(input: { members?: OrganizationMemberOutput[]; isConfirmed?: boolean }) {
    const transferOwnership = vi.fn<ReturnType<typeof DEPENDENCIES.useTransferOrganizationOwnershipMutation>["mutate"]>();
    const confirm = vi.fn(async () => input.isConfirmed ?? true);
    const enqueueSnackbar = vi.fn();
    const useOrganizationMembersQuery = vi.fn(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useOrganizationMembersQuery>>(), {
        data: "members" in input ? input.members : [DAVE, ALICE, CAROL, BOB]
      })
    );
    const dependencies: typeof DEPENDENCIES = {
      usePopup: () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useOrganizationMembersQuery,
      useTransferOrganizationOwnershipMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useTransferOrganizationOwnershipMutation>>({ mutate: transferOwnership, isPending: false })
    };

    render(<OwnershipTransferSetting organization={{ name: "Acme Corp" }} dependencies={dependencies} />);

    return { user: userEvent.setup(), confirm, transferOwnership, enqueueSnackbar, useOrganizationMembersQuery };
  }
});

const ALICE: OrganizationMemberOutput = {
  id: "member-alice",
  userId: "user-alice",
  username: "alice",
  email: "alice@acme.io",
  role: "owner",
  createdAt: "2026-01-01T00:00:00Z"
};

const BOB: OrganizationMemberOutput = { ...ALICE, id: "member-bob", userId: "user-bob", username: "bob", email: "bob@acme.io", role: "member" };

const CAROL: OrganizationMemberOutput = { ...ALICE, id: "member-carol", userId: "user-carol", username: null, email: "carol@acme.io", role: "viewer" };

const DAVE: OrganizationMemberOutput = { ...ALICE, id: "member-dave", userId: "user-dave", username: "dave", email: "dave@acme.io", role: "admin" };
