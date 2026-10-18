import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationMemberOutput } from "@src/types/organizationMembership";
import type { DEPENDENCIES } from "./OwnershipTransferSetting";
import { OwnershipTransferSetting } from "./OwnershipTransferSetting";

import { render, screen, waitFor } from "@testing-library/react";
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
    transferOwnership.mockResolvedValue({ data: { ...DAVE, role: "owner" } });

    await chooseNewOwner(user, "dave");
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    expect(confirm).toHaveBeenCalledWith({
      title: "Transfer ownership to dave?",
      message: "dave becomes the owner of Acme Corp. You stay on as an Admin."
    });
    expect(transferOwnership).toHaveBeenCalledWith({ id: "member-dave" });
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ title: "dave is now the owner of Acme Corp" }) }),
        { variant: "success" }
      )
    );
  });

  it("confirms the transfer after the demoted owner loses the setting", async () => {
    const { user, transferOwnership, enqueueSnackbar, unmount } = setup({});
    const transfer = Promise.withResolvers<Awaited<ReturnType<TransferMutation["mutateAsync"]>>>();
    transferOwnership.mockReturnValue(transfer.promise);

    await chooseNewOwner(user, "dave");
    await user.click(screen.getByRole("button", { name: "Transfer" }));
    await waitFor(() => expect(transferOwnership).toHaveBeenCalled());
    unmount();
    transfer.resolve({ data: { ...DAVE, role: "owner" } });

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ title: "dave is now the owner of Acme Corp" }) }),
        { variant: "success" }
      )
    );
    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the owner cancels", async () => {
    const { user, transferOwnership } = setup({ isConfirmed: false });

    await chooseNewOwner(user, "bob");
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    expect(transferOwnership).not.toHaveBeenCalled();
  });

  it("explains a refused transfer", async () => {
    const { user, transferOwnership, enqueueSnackbar } = setup({});
    transferOwnership.mockRejectedValue(new ApiError(403, { code: "owner_role_restricted" }, "POST"));

    await chooseNewOwner(user, "bob");
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ title: "Only the owner can change the owner's role or hand over ownership." }) }),
        { variant: "error" }
      )
    );
    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
  });

  it("falls back to a generic message for an unexplained failure", async () => {
    const { user, transferOwnership, enqueueSnackbar } = setup({});
    transferOwnership.mockRejectedValue(new Error("boom"));

    await chooseNewOwner(user, "bob");
    await user.click(screen.getByRole("button", { name: "Transfer" }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't transfer ownership to bob" }) }),
        { variant: "error" }
      )
    );
    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
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

  it("tells the owner to refresh when the members fail to load", () => {
    setup({ members: undefined, isError: true });

    expect(screen.getByText("Couldn't load the members. Refresh the page to try again.")).toBeInTheDocument();
    expect(screen.queryByText("Make another member the owner of Acme Corp. You stay on as an Admin.")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "New owner" })).toBeDisabled();
  });

  async function chooseNewOwner(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(screen.getByRole("combobox", { name: "New owner" }));
    await user.click(screen.getByRole("option", { name }));
  }

  function setup(input: { members?: OrganizationMemberOutput[]; isError?: boolean; isConfirmed?: boolean }) {
    const transferOwnership = vi.fn<TransferMutation["mutateAsync"]>();
    const confirm = vi.fn(async () => input.isConfirmed ?? true);
    const enqueueSnackbar = vi.fn();
    const useOrganizationMembersQuery = vi.fn(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useOrganizationMembersQuery>>(), {
        data: "members" in input ? input.members : [DAVE, ALICE, CAROL, BOB],
        isError: input.isError ?? false
      })
    );
    const dependencies: typeof DEPENDENCIES = {
      usePopup: () => mock<ReturnType<typeof DEPENDENCIES.usePopup>>({ confirm }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useOrganizationMembersQuery,
      useTransferOrganizationOwnershipMutation: () => mock<TransferMutation>({ mutateAsync: transferOwnership, isPending: false })
    };

    const { unmount } = render(<OwnershipTransferSetting organization={{ name: "Acme Corp" }} dependencies={dependencies} />);

    return { user: userEvent.setup(), confirm, transferOwnership, enqueueSnackbar, useOrganizationMembersQuery, unmount };
  }
});

type TransferMutation = ReturnType<typeof DEPENDENCIES.useTransferOrganizationOwnershipMutation>;

const ALICE: OrganizationMemberOutput = {
  id: "member-alice",
  userId: "user-alice",
  username: "alice",
  email: "alice@acme.io",
  role: "owner",
  projectAccess: "all",
  projectCount: null,
  createdAt: "2026-01-01T00:00:00Z"
};

const BOB: OrganizationMemberOutput = { ...ALICE, id: "member-bob", userId: "user-bob", username: "bob", email: "bob@acme.io", role: "member" };

const CAROL: OrganizationMemberOutput = { ...ALICE, id: "member-carol", userId: "user-carol", username: null, email: "carol@acme.io", role: "viewer" };

const DAVE: OrganizationMemberOutput = { ...ALICE, id: "member-dave", userId: "user-dave", username: "dave", email: "dave@acme.io", role: "admin" };
