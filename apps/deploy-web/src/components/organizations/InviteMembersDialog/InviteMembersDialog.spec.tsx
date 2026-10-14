import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { INVALID_EMAIL_MESSAGE } from "@src/components/organizations/emailAddress";
import type { Project } from "@src/types/project";
import type { DEPENDENCIES } from "./InviteMembersDialog";
import { ALREADY_INVITED_MESSAGE, ALREADY_MEMBER_MESSAGE, InviteMembersDialog } from "./InviteMembersDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("InviteMembersDialog", () => {
  it("introduces the invitation and defaults to the Member role", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "Invite to Acme Corp" })).toBeInTheDocument();
    expect(screen.getByText("Invitations expire after 7 days.")).toBeInTheDocument();
    expect(screen.getByText("Separate multiple addresses with commas or spaces.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Member/ })).toBeChecked();
    expect(screen.getByText("Creates projects and manages deployments.")).toBeInTheDocument();
    expect(screen.getByText("Also manages billing, usage and members.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();
  });

  it("sends the invitations with the chosen role and confirms them", async () => {
    const { user, createInvitations, enqueueSnackbar, onClose } = setup({});
    createInvitations.mockImplementation((input, options) => options?.onSuccess?.({ data: [] }, input, undefined));

    await user.type(screen.getByLabelText("Email addresses"), "carol@acme.io, Dan@acme.io ");
    await user.click(screen.getByRole("radio", { name: /Admin/ }));
    await user.click(screen.getByRole("button", { name: "Send 2 invites" }));

    expect(createInvitations.mock.lastCall?.[0]).toEqual({ data: { emails: ["carol@acme.io", "dan@acme.io"], role: "admin" } });
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "2 invites sent", variant: "success" });
    expect(onClose).toHaveBeenCalled();
  });

  it("names the invitee when only one invitation was sent", async () => {
    const { user, createInvitations, enqueueSnackbar } = setup({});
    createInvitations.mockImplementation((input, options) => options?.onSuccess?.({ data: [] }, input, undefined));

    await user.type(screen.getByLabelText("Email addresses"), "carol@acme.io{Enter}");
    await user.click(screen.getByRole("button", { name: "Send invite" }));

    expect(createInvitations.mock.lastCall?.[0]).toEqual({ data: { emails: ["carol@acme.io"], role: "member" } });
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Invite sent to carol@acme.io", variant: "success" });
  });

  it("offers project access to a member and sends the projects chosen", async () => {
    const { user, createInvitations, ProjectGrantsField } = setup({});

    expect(ProjectGrantsField.mock.lastCall?.[0].projects.map(project => project.id)).toEqual(["storefront"]);
    expect(ProjectGrantsField.mock.lastCall?.[0].grants).toEqual([]);

    await user.type(screen.getByLabelText("Email addresses"), "carol@acme.io{Enter}");
    await user.click(screen.getByRole("button", { name: "grant storefront" }));
    await user.click(screen.getByRole("button", { name: "Send invite" }));

    expect(ProjectGrantsField.mock.lastCall?.[0]).toMatchObject({ grants: [{ projectId: "storefront", role: "viewer" }] });
    expect(createInvitations.mock.lastCall?.[0]).toEqual({
      data: { emails: ["carol@acme.io"], role: "member", projectGrants: [{ projectId: "storefront", role: "viewer" }] }
    });
  });

  it("offers no project access to an admin, who opens every project, and sends none picked before", async () => {
    const { user, createInvitations } = setup({});

    await user.type(screen.getByLabelText("Email addresses"), "carol@acme.io{Enter}");
    await user.click(screen.getByRole("button", { name: "grant storefront" }));
    await user.click(screen.getByRole("radio", { name: /Admin/ }));

    expect(screen.queryByRole("button", { name: "grant storefront" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send invite" }));

    expect(createInvitations.mock.lastCall?.[0]).toEqual({ data: { emails: ["carol@acme.io"], role: "admin" } });
  });

  it("offers no project access while the organization has no projects to give", () => {
    const { ProjectGrantsField } = setup({ projects: [] });

    expect(ProjectGrantsField).not.toHaveBeenCalled();
  });

  it.each([
    ["not-an-email", INVALID_EMAIL_MESSAGE],
    ["bob@acme.io", ALREADY_MEMBER_MESSAGE],
    ["Erin@Acme.io", ALREADY_INVITED_MESSAGE]
  ])("refuses %s with %s", async (email, message) => {
    const { user, createInvitations } = setup({});

    await user.type(screen.getByLabelText("Email addresses"), `${email} `);
    await user.keyboard("{Enter}");

    expect(screen.getByText(`${email.toLowerCase()}: ${message}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();
    expect(createInvitations).not.toHaveBeenCalled();
  });

  it("explains a refusal with the API's reason and stays open", async () => {
    const { user, createInvitations, enqueueSnackbar, onClose } = setup({});
    createInvitations.mockImplementation((input, options) => options?.onError?.(new ApiError(409, { code: "already_member" }, "POST"), input, undefined));

    await user.type(screen.getByLabelText("Email addresses"), "carol@acme.io ");
    await user.click(screen.getByRole("button", { name: "Send invite" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Someone you invited is already a member.", variant: "error" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the invitations fail for another reason", async () => {
    const { user, createInvitations, enqueueSnackbar } = setup({});
    createInvitations.mockImplementation((input, options) => options?.onError?.(new Error("boom"), input, undefined));

    await user.type(screen.getByLabelText("Email addresses"), "carol@acme.io ");
    await user.click(screen.getByRole("button", { name: "Send invite" }));

    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Couldn't send the invites", variant: "error" });
  });

  it("closes when cancelled, from its close button and with Escape", async () => {
    const { user, onClose } = setup({});

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("stays open while the invitations are being sent", async () => {
    const { user, onClose } = setup({ isPending: true });

    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  function lastSnackbar(enqueueSnackbar: ReturnType<typeof vi.fn>) {
    const [element, options] = enqueueSnackbar.mock.lastCall as [{ props: { title: string } }, { variant: string }];
    return { title: element.props.title, variant: options.variant };
  }

  function setup(input: { isPending?: boolean; projects?: Project[] }) {
    const createInvitations = vi.fn<ReturnType<typeof DEPENDENCIES.useCreateOrganizationInvitationsMutation>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();
    const projects = input.projects ?? [mock<Project>({ id: "storefront", name: "storefront" })];
    const ProjectGrantsField = vi.fn<typeof DEPENDENCIES.ProjectGrantsField>(({ onChange }) => (
      <button type="button" onClick={() => onChange([{ projectId: "storefront", role: "viewer" }])}>
        grant storefront
      </button>
    ));

    const dependencies: typeof DEPENDENCIES = {
      useCreateOrganizationInvitationsMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCreateOrganizationInvitationsMutation>>({ mutate: createInvitations, isPending: input.isPending ?? false }),
      useProjectsQuery: () => mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: projects }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      ProjectGrantsField
    };

    render(
      <InviteMembersDialog
        organizationName="Acme Corp"
        memberEmails={["Bob@acme.io"]}
        invitedEmails={["erin@acme.io"]}
        onClose={onClose}
        dependencies={dependencies}
      />
    );

    return { user: userEvent.setup(), createInvitations, enqueueSnackbar, onClose, ProjectGrantsField };
  }
});
