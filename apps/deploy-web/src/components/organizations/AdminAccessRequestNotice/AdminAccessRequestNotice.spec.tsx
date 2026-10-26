import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { OrganizationRole } from "@src/types/organization";
import type { DEPENDENCIES } from "./AdminAccessRequestNotice";
import { AdminAccessRequestNotice } from "./AdminAccessRequestNotice";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(AdminAccessRequestNotice.name, () => {
  it.each<[OrganizationRole, string]>([
    ["member", "Member"],
    ["viewer", "Viewer"],
    ["billing", "Billing"]
  ])("tells a %s what only admins can do", (role, label) => {
    setup({ role, adminOnlyAction: "invite people or change roles" });

    expect(screen.getByText(/Only admins can/)).toHaveTextContent(`You're a ${label} of Acme Corp. Only admins can invite people or change roles.`);
    expect(screen.getByRole("button", { name: "Request admin access" })).toBeEnabled();
  });

  it("asks the owners for admin access and says the request went out", async () => {
    const { user, requestAdminAccess, enqueueSnackbar } = setup({});
    requestAdminAccess.mockImplementation((input, options) => options?.onSuccess?.(undefined, input, undefined));

    await user.click(screen.getByRole("button", { name: "Request admin access" }));

    expect(requestAdminAccess).toHaveBeenCalledWith({ id: "org-2" }, expect.anything());
    expect(screen.getByText("Request sent. The owner of Acme Corp will get an email.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Requested" })).toBeDisabled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("says the owner already has the request when the member asked earlier today", async () => {
    const { user, requestAdminAccess, enqueueSnackbar } = setup({});
    requestAdminAccess.mockImplementation((input, options) =>
      options?.onError?.(new ApiError(429, { code: "admin_access_request_limit_reached" }, "POST"), input, undefined)
    );

    await user.click(screen.getByRole("button", { name: "Request admin access" }));

    expect(screen.getByText("You already asked today. The owner of Acme Corp has your request.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Requested" })).toBeDisabled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("reports any other failure and lets the member try again", async () => {
    const { user, requestAdminAccess, enqueueSnackbar } = setup({});
    requestAdminAccess.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await user.click(screen.getByRole("button", { name: "Request admin access" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't send your request", subTitle: "Try again in a moment." }) }),
      { variant: "error" }
    );
    expect(screen.getByText(/Only admins can rename it\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request admin access" })).toBeEnabled();
  });

  it("blocks a second click while the request is in flight", () => {
    setup({ isPending: true });

    expect(screen.getByRole("button", { name: /Request admin access/ })).toBeDisabled();
  });

  function setup(input: { role?: OrganizationRole; adminOnlyAction?: string; isPending?: boolean }) {
    const requestAdminAccess = vi.fn<ReturnType<typeof DEPENDENCIES.useRequestAdminAccessMutation>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useRequestAdminAccessMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useRequestAdminAccessMutation>>({ mutate: requestAdminAccess, isPending: input.isPending ?? false }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    render(
      <AdminAccessRequestNotice
        organization={{ id: "org-2", name: "Acme Corp", role: input.role ?? "member" }}
        adminOnlyAction={input.adminOnlyAction ?? "rename it"}
        dependencies={dependencies}
      />
    );

    return { user: userEvent.setup(), requestAdminAccess, enqueueSnackbar };
  }
});
