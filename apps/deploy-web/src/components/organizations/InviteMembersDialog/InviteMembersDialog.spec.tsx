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
    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();
  });

  it("offers every role below owner, each with what it may do", () => {
    setup({});

    expect(screen.getAllByRole("radio").map(radio => radio.getAttribute("value"))).toEqual(["member", "viewer", "billing", "admin"]);
    expect(screen.getByRole("radio", { name: /^Member/ })).toHaveAccessibleName(/Deploys in the projects they can access, but can't create projects\.$/);
    expect(screen.getByRole("radio", { name: /^Viewer/ })).toHaveAccessibleName(
      /Sees deployments and logs in the projects they can access, but can't change them\.$/
    );
    expect(screen.getByRole("radio", { name: /^Billing/ })).toHaveAccessibleName(
      /Adds credits, manages payment methods and sees usage, but not deployments\.$/
    );
    expect(screen.getByRole("radio", { name: /^Admin/ })).toHaveAccessibleName(/Creates projects, manages members and sees billing and usage\.$/);
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

    expect(createInvitations.mock.lastCall?.[0]).toEqual({ data: { emails: ["carol@acme.io"], role: "member", projectAccess: "all" } });
    expect(lastSnackbar(enqueueSnackbar)).toEqual({ title: "Invite sent to carol@acme.io", variant: "success" });
  });

  it("offers a member every project of the organization by default", () => {
    const { ProjectAccessField } = setup({});

    expect(ProjectAccessField.mock.lastCall?.[0]).toMatchObject({ organizationName: "Acme Corp", value: { access: "all", grants: [] } });
    expect(ProjectAccessField.mock.lastCall?.[0].projects.map(project => project.id)).toEqual(["storefront"]);
  });

  it("lets a member be granted any project role and a viewer the viewer role only", async () => {
    const { user, ProjectAccessField } = setup({});

    expect(ProjectAccessField.mock.lastCall?.[0].grantRoles).toEqual(["viewer", "member", "admin"]);

    await user.click(screen.getByRole("radio", { name: /^Viewer/ }));

    expect(ProjectAccessField.mock.lastCall?.[0].grantRoles).toEqual(["viewer"]);
  });

  it.each([
    ["Member", "admin"],
    ["Viewer", "viewer"]
  ])("sends a project picked as admin with the role a %s may hold", async (label, grantRole) => {
    const { user, createInvitations } = setup({});

    await user.type(screen.getByLabelText("Email addresses"), "carol@acme.io{Enter}");
    await user.click(screen.getByRole("button", { name: "grant storefront as admin" }));
    await user.click(screen.getByRole("radio", { name: new RegExp(`^${label}`) }));
    await user.click(screen.getByRole("button", { name: "Send invite" }));

    expect(createInvitations.mock.lastCall?.[0]).toEqual({
      data: { emails: ["carol@acme.io"], role: label.toLowerCase(), projectAccess: "selected", projectGrants: [{ projectId: "storefront", role: grantRole }] }
    });
  });

  it.each([
    ["Member", "member"],
    ["Viewer", "viewer"]
  ])("sends the specific projects chosen for a %s", async (label, role) => {
    const { user, createInvitations } = setup({});

    await user.type(screen.getByLabelText("Email addresses"), "carol@acme.io{Enter}");
    await user.click(screen.getByRole("radio", { name: new RegExp(`^${label}`) }));
    await user.click(screen.getByRole("button", { name: "grant storefront" }));
    await user.click(screen.getByRole("button", { name: "Send invite" }));

    expect(createInvitations.mock.lastCall?.[0]).toEqual({
      data: { emails: ["carol@acme.io"], role, projectAccess: "selected", projectGrants: [{ projectId: "storefront", role: "viewer" }] }
    });
  });

  it("asks for the project access of a viewer and sends every project by default", async () => {
    const { user, createInvitations, ProjectAccessField } = setup({});

    await user.type(screen.getByLabelText("Email addresses"), "carol@acme.io{Enter}");
    await user.click(screen.getByRole("radio", { name: /^Viewer/ }));

    expect(ProjectAccessField.mock.lastCall?.[0]).toMatchObject({ organizationName: "Acme Corp", value: { access: "all", grants: [] } });

    await user.click(screen.getByRole("button", { name: "Send invite" }));

    expect(createInvitations.mock.lastCall?.[0]).toEqual({ data: { emails: ["carol@acme.io"], role: "viewer", projectAccess: "all" } });
  });

  it("holds the invite back while a member has specific projects and none is picked", async () => {
    const { user, createInvitations } = setup({});

    await user.type(screen.getByLabelText("Email addresses"), "carol@acme.io{Enter}");
    await user.click(screen.getByRole("button", { name: "pick no project" }));

    await user.click(screen.getByRole("button", { name: "Send invite" }));

    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();
    expect(createInvitations).not.toHaveBeenCalled();
  });

  it.each([
    ["Admin", "admin"],
    ["Billing", "billing"]
  ])("offers no project access to a %s and sends none picked before", async (label, role) => {
    const { user, createInvitations } = setup({});

    await user.type(screen.getByLabelText("Email addresses"), "carol@acme.io{Enter}");
    await user.click(screen.getByRole("button", { name: "pick no project" }));
    await user.click(screen.getByRole("radio", { name: new RegExp(`^${label}`) }));

    expect(screen.queryByRole("button", { name: "grant storefront" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Send invite" }));

    expect(createInvitations.mock.lastCall?.[0]).toEqual({ data: { emails: ["carol@acme.io"], role } });
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
    const ProjectAccessField = vi.fn<typeof DEPENDENCIES.ProjectAccessField>(({ onChange }) => (
      <>
        <button type="button" onClick={() => onChange({ access: "selected", grants: [{ projectId: "storefront", role: "viewer" }] })}>
          grant storefront
        </button>
        <button type="button" onClick={() => onChange({ access: "selected", grants: [{ projectId: "storefront", role: "admin" }] })}>
          grant storefront as admin
        </button>
        <button type="button" onClick={() => onChange({ access: "selected", grants: [] })}>
          pick no project
        </button>
      </>
    ));

    const dependencies: typeof DEPENDENCIES = {
      useCreateOrganizationInvitationsMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCreateOrganizationInvitationsMutation>>({ mutate: createInvitations, isPending: input.isPending ?? false }),
      useProjectsQuery: () => mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>({ data: projects }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      ProjectAccessField
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

    return { user: userEvent.setup(), createInvitations, enqueueSnackbar, onClose, ProjectAccessField };
  }
});
