import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationOutput } from "@src/types/organization";
import type { DEPENDENCIES } from "./LeaveOrganizationDialog";
import { LeaveOrganizationDialog } from "./LeaveOrganizationDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("LeaveOrganizationDialog", () => {
  it("explains what leaving does", () => {
    setup({});

    expect(screen.getByRole("dialog", { name: "Leave Acme Corp?" })).toHaveTextContent(
      "You lose access to Acme Corp and its projects right away. Deployments keep running, and an admin can invite you back."
    );
  });

  it("leaves the organization and lands the user in their personal account", async () => {
    const { user, leaveOrganization, switchOrganization, enqueueSnackbar, replace } = setup({});
    leaveOrganization.mockImplementation((input, options) => options?.onSuccess?.(undefined, input, undefined));

    await user.click(screen.getByRole("button", { name: "Leave organization" }));

    expect(leaveOrganization).toHaveBeenCalledWith({ id: "org-2" }, expect.anything());
    expect(switchOrganization).toHaveBeenCalledWith("org-1");
    expect(replace).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "You left Acme Corp", subTitle: "You're in your personal account now." }) }),
      { variant: "success" }
    );
  });

  it("sends the user home when the personal account cannot be switched to", async () => {
    const { user, leaveOrganization, switchOrganization, replace } = setup({ organizations: [ACME] });
    leaveOrganization.mockImplementation((input, options) => options?.onSuccess?.(undefined, input, undefined));

    await user.click(screen.getByRole("button", { name: "Leave organization" }));

    expect(switchOrganization).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/deployments");
  });

  it("sends the user home when the switch is refused", async () => {
    const { user, leaveOrganization, replace } = setup({ hasSwitched: false });
    leaveOrganization.mockImplementation((input, options) => options?.onSuccess?.(undefined, input, undefined));

    await user.click(screen.getByRole("button", { name: "Leave organization" }));

    expect(replace).toHaveBeenCalledWith("/deployments");
  });

  it("tells an owner to transfer ownership first when the api refuses them", async () => {
    const { user, leaveOrganization, enqueueSnackbar, switchOrganization } = setup({});
    leaveOrganization.mockImplementation((input, options) => options?.onError?.(new ApiError(409, { code: "owner_cannot_leave" }, "DELETE"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Leave organization" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "You own Acme Corp. Transfer ownership before you leave." }) }),
      { variant: "error" }
    );
    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it("reports any other failure", async () => {
    const { user, leaveOrganization, enqueueSnackbar } = setup({});
    leaveOrganization.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Leave organization" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't leave Acme Corp" }) }), {
      variant: "error"
    });
  });

  it("closes on Cancel", async () => {
    const { user, onClose, leaveOrganization } = setup({});

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(leaveOrganization).not.toHaveBeenCalled();
  });

  it("stays open on Escape while leaving", async () => {
    const { user, onClose } = setup({ isPending: true });

    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("closes on Escape otherwise", async () => {
    const { user, onClose } = setup({});

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  function setup(input: { organizations?: OrganizationOutput[]; hasSwitched?: boolean; isPending?: boolean }) {
    const leaveOrganization = vi.fn<ReturnType<typeof DEPENDENCIES.useLeaveOrganizationMutation>["mutate"]>();
    const switchOrganization = vi.fn(() => input.hasSwitched ?? true);
    const enqueueSnackbar = vi.fn();
    const replace = vi.fn();
    const onClose = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ organizations: input.organizations ?? [PERSONAL, ACME], switchOrganization }),
      useLeaveOrganizationMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useLeaveOrganizationMutation>>({ mutate: leaveOrganization, isPending: input.isPending ?? false }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace })
    };

    render(<LeaveOrganizationDialog organization={ACME} onClose={onClose} dependencies={dependencies} />);

    return { user: userEvent.setup(), leaveOrganization, switchOrganization, enqueueSnackbar, replace, onClose };
  }
});

const ACME: OrganizationOutput = {
  id: "org-2",
  name: "Acme Corp",
  slug: "acme-corp",
  type: "team",
  role: "member",
  isActive: true,
  createdAt: "2026-02-01T00:00:00Z"
};

const PERSONAL: OrganizationOutput = { ...ACME, id: "org-1", name: "alice", slug: "personal-0123456789ab", type: "personal", role: "owner", isActive: false };
