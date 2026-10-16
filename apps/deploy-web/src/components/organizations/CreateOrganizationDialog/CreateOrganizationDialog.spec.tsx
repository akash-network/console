import { forwardRef, useImperativeHandle } from "react";
import type { StripeService } from "@akashnetwork/http-sdk";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { INVALID_EMAIL_MESSAGE } from "@src/components/organizations/emailAddress";
import type { NewCardHandle } from "@src/components/organizations/NewCardFields/NewCardFields";
import { CARD_SAVE_FAILED_REASON } from "@src/components/organizations/NewCardFields/NewCardFields";
import { OrganizationBillingField } from "@src/components/organizations/OrganizationBillingField/OrganizationBillingField";
import type { ErrorHandlerService } from "@src/services/error-handler/error-handler.service";
import type { OrganizationOutput } from "@src/types/organization";
import type { DEPENDENCIES } from "./CreateOrganizationDialog";
import { CreateOrganizationDialog, INVALID_ORGANIZATION_NAME_MESSAGE, ORGANIZATION_NAME_TAKEN_MESSAGE, OWN_EMAIL_MESSAGE } from "./CreateOrganizationDialog";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("CreateOrganizationDialog", () => {
  it("explains what an organization is for", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "Create an organization" })).toBeInTheDocument();
    expect(screen.getByText("Share projects, deployments and billing with your team.")).toBeInTheDocument();
    expect(screen.getByText("You'll be the organization's owner.")).toBeInTheDocument();
    expect(screen.getByText("They join as Members. You can change roles later.")).toBeInTheDocument();
    expect(screen.getByLabelText("Organization name")).toHaveAttribute("placeholder", "Acme Corp");
    expect(screen.getByLabelText("Invite teammates")).toHaveAttribute("placeholder", "name@company.com");
  });

  it("explains that the organization is billed apart from the personal account, before it has a name", () => {
    setup({});

    expect(screen.getByRole("radiogroup", { name: "Billing" })).toHaveAccessibleDescription(
      "The organization gets its own balance and payment method, separate from your personal account."
    );
    expect(screen.getByRole("radio", { name: "Add a new card Saved to the organization only" })).not.toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Set up later No one in the organization can deploy until it has a payment method. You can add one in Billing." })
    ).not.toBeChecked();
  });

  it("names the organization in its billing choices", async () => {
    const { user } = setup({});

    await user.type(screen.getByLabelText("Organization name"), " Harborline ");

    expect(screen.getByRole("radiogroup", { name: "Billing" })).toHaveAccessibleDescription(
      "Harborline gets its own balance and payment method, separate from your personal account."
    );
    expect(screen.getByRole("radio", { name: "Add a new card Saved to Harborline only" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Set up later No one in Harborline can deploy until it has a payment method. You can add one in Billing." })
    ).toBeInTheDocument();
  });

  it("waits for a name with a visible character before it can create", async () => {
    const { user } = setup({});
    const createButton = screen.getByRole("button", { name: "Create organization" });

    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    expect(createButton).toBeDisabled();
    await user.type(screen.getByLabelText("Organization name"), "  ");
    expect(createButton).toBeDisabled();
    await user.type(screen.getByLabelText("Organization name"), "A");
    expect(createButton).toBeEnabled();
  });

  it("waits for a billing choice before it can create", async () => {
    const { user } = setup({});
    const createButton = screen.getByRole("button", { name: "Create organization" });

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    expect(createButton).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));

    expect(screen.getByRole("radio", { name: /^Set up later/ })).toBeChecked();
    expect(createButton).toBeEnabled();
  });

  it("asks for the card only when adding a new one, and waits for it to be filled in", async () => {
    const { user } = setup({});
    const createButton = screen.getByRole("button", { name: "Create organization" });
    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    expect(screen.queryByRole("button", { name: "Fill in the card" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /^Add a new card/ }));
    expect(screen.getByRole("radio", { name: /^Add a new card/ })).toBeChecked();
    expect(createButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Fill in the card" }));
    expect(createButton).toBeEnabled();
  });

  it("asks for the card again after switching away from it and back", async () => {
    const { user } = setup({});
    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Add a new card/ }));
    await user.click(screen.getByRole("button", { name: "Fill in the card" }));

    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    expect(screen.queryByRole("button", { name: "Fill in the card" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^Add a new card/ }));

    expect(screen.getByRole("button", { name: "Create organization" })).toBeDisabled();
  });

  it("refuses the name of an organization the user already belongs to, whatever the case", async () => {
    const { user, createOrganization } = setup({});

    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.type(screen.getByLabelText("Organization name"), "  acme CORP ");
    await user.keyboard("{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent(ORGANIZATION_NAME_TAKEN_MESSAGE);
    expect(screen.getByRole("button", { name: "Create organization" })).toBeDisabled();
    expect(createOrganization).not.toHaveBeenCalled();
  });

  it("creates the organization with the trimmed name only", async () => {
    const { user, createOrganization } = setup({});

    await user.type(screen.getByLabelText("Organization name"), "  Harborline  ");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.type(screen.getByLabelText("Invite teammates"), "bob@harborline.io ");
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    expect(createOrganization).toHaveBeenCalledExactlyOnceWith({ data: { name: "Harborline" } });
  });

  it("creates the organization without a payment method when billing is set up later", async () => {
    const { user, stripe, card, switchOrganization } = setup({});

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(switchOrganization).toHaveBeenCalledOnce());
    expect(stripe.createSetupIntent).not.toHaveBeenCalled();
    expect(card.validate).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("console_org=");
  });

  it("saves the card on the new organization, makes it the default and only then switches into it", async () => {
    const { user, createOrganization, stripe, card, switchOrganization, enqueueSnackbar } = setup({});
    let cookieWhileSettingUp = "";
    stripe.createSetupIntent.mockImplementation(async () => {
      cookieWhileSettingUp = document.cookie;
      return { clientSecret: "seti_secret" };
    });

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Add a new card/ }));
    await user.click(screen.getByRole("button", { name: "Fill in the card" }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(switchOrganization).toHaveBeenCalledExactlyOnceWith("org-9", { destination: "/members" }));
    expect(cookieWhileSettingUp).toContain("console_org=org-9");
    expect(card.save).toHaveBeenCalledExactlyOnceWith("seti_secret");
    expect(stripe.getPaymentMethods).toHaveBeenCalledOnce();
    const callOrder = [
      card.validate.mock.invocationCallOrder[0],
      createOrganization.mock.invocationCallOrder[0],
      stripe.createSetupIntent.mock.invocationCallOrder[0],
      card.save.mock.invocationCallOrder[0],
      stripe.getPaymentMethods.mock.invocationCallOrder[0],
      switchOrganization.mock.invocationCallOrder[0]
    ];
    expect(callOrder).toEqual([...callOrder].sort((first, second) => first - second));
    expect(enqueueSnackbar).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ props: expect.objectContaining({ title: "Created Harborline" }) }), {
      variant: "success"
    });
  });

  it("creates nothing while Stripe refuses the card fields", async () => {
    const { user, createOrganization, card, onClose } = setup({});
    card.validate.mockResolvedValue(false);

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Add a new card/ }));
    await user.click(screen.getByRole("button", { name: "Fill in the card" }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Create organization" })).toBeEnabled());
    expect(createOrganization).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("still takes the user into the new organization when the card is declined, and tells them where to add one", async () => {
    const { user, card, stripe, switchOrganization, onClose, enqueueSnackbar } = setup({});
    card.save.mockResolvedValue("Your card was declined.");

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Add a new card/ }));
    await user.click(screen.getByRole("button", { name: "Fill in the card" }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(switchOrganization).toHaveBeenCalledExactlyOnceWith("org-9", { destination: "/members" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(stripe.getPaymentMethods).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        props: expect.objectContaining({
          title: "Created Harborline, but your card wasn't saved",
          subTitle: "Your card was declined. You can add a card in Billing.",
          iconVariant: "warning"
        })
      }),
      { variant: "warning" }
    );
  });

  it("still takes the user into the new organization when the card step can't start, and reports why", async () => {
    const { user, card, stripe, errorHandler, switchOrganization, enqueueSnackbar } = setup({});
    const error = new Error("Service unavailable");
    stripe.createSetupIntent.mockRejectedValue(error);

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Add a new card/ }));
    await user.click(screen.getByRole("button", { name: "Fill in the card" }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(switchOrganization).toHaveBeenCalledOnce());
    expect(card.save).not.toHaveBeenCalled();
    expect(errorHandler.reportError).toHaveBeenCalledExactlyOnceWith({ error, tags: { category: "billing" } });
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ subTitle: `${CARD_SAVE_FAILED_REASON} You can add a card in Billing.` }) }),
      { variant: "warning" }
    );
  });

  it("enters the new organization with its card when the card couldn't be made the default yet, and reports why", async () => {
    const { user, stripe, errorHandler, switchOrganization, enqueueSnackbar } = setup({});
    const error = new Error("Service unavailable");
    stripe.getPaymentMethods.mockRejectedValue(error);

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Add a new card/ }));
    await user.click(screen.getByRole("button", { name: "Fill in the card" }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(switchOrganization).toHaveBeenCalledOnce());
    expect(errorHandler.reportError).toHaveBeenCalledExactlyOnceWith({ error, tags: { category: "billing" } });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Created Harborline" }) }), {
      variant: "success"
    });
  });

  it("invites the teammates as members once the new organization is the active one", async () => {
    const { user, switchOrganization, inviteToActiveOrganization } = setup({});

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.type(screen.getByLabelText("Invite teammates"), "Bob@harborline.io, carol@harborline.io ");
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(inviteToActiveOrganization).toHaveBeenCalledOnce());
    expect(inviteToActiveOrganization).toHaveBeenCalledWith({ data: { emails: ["bob@harborline.io", "carol@harborline.io"], role: "member" } });
    expect(switchOrganization.mock.invocationCallOrder[0]).toBeLessThan(inviteToActiveOrganization.mock.invocationCallOrder[0]);
  });

  it("sends no invitations when none were added", async () => {
    const { user, switchOrganization, inviteToActiveOrganization } = setup({});

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(switchOrganization).toHaveBeenCalledOnce());
    expect(inviteToActiveOrganization).not.toHaveBeenCalled();
  });

  it("sends no invitations when it could not switch into the new organization, and says so", async () => {
    const { user, switchOrganization, inviteToActiveOrganization, enqueueSnackbar } = setup({});
    switchOrganization.mockReturnValue(false);

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.type(screen.getByLabelText("Invite teammates"), "bob@harborline.io ");
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Your invitations weren't sent" }) }), {
        variant: "warning"
      })
    );
    expect(inviteToActiveOrganization).not.toHaveBeenCalled();
  });

  it("tells the user when the invitations could not be sent, after the organization was created", async () => {
    const { user, inviteToActiveOrganization, switchOrganization, enqueueSnackbar } = setup({});
    inviteToActiveOrganization.mockRejectedValue(new ApiError(429, { code: "invitation_email_limit_reached" }, "POST → 429"));

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.type(screen.getByLabelText("Invite teammates"), "bob@harborline.io ");
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          props: expect.objectContaining({
            title: "Your invitations weren't sent",
            subTitle: "Invite your teammates from the Members page.",
            iconVariant: "warning"
          })
        }),
        { variant: "warning" }
      )
    );
    expect(switchOrganization).toHaveBeenCalledOnce();
  });

  it("points out an address that is not an email", async () => {
    const { user, createOrganization } = setup({});

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.type(screen.getByLabelText("Invite teammates"), "not-an-email,");
    await user.keyboard("{Enter}");

    expect(screen.getByText(`not-an-email: ${INVALID_EMAIL_MESSAGE}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create organization" })).toBeDisabled();
    expect(createOrganization).not.toHaveBeenCalled();
  });

  it("points out the user's own address", async () => {
    const { user } = setup({ email: "Alice@Example.com" });

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.type(screen.getByLabelText("Invite teammates"), "alice@example.com ");

    expect(screen.getByText(`alice@example.com: ${OWN_EMAIL_MESSAGE}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create organization" })).toBeDisabled();
  });

  it("switches into the new organization and lands on its members page", async () => {
    const { user, switchOrganization, onClose, enqueueSnackbar } = setup({});

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() => expect(switchOrganization).toHaveBeenCalledExactlyOnceWith("org-9", { destination: "/members" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Created Harborline" }) }), {
      variant: "success"
    });
  });

  it("shows the API's refusal of a name the user already uses, until the name changes", async () => {
    const { user, createOrganization } = setup({});
    createOrganization.mockRejectedValue(new ApiError(409, { code: "organization_name_taken" }, "POST → 409"));

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(ORGANIZATION_NAME_TAKEN_MESSAGE);

    await user.type(screen.getByLabelText("Organization name"), "2");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tells the user their organization limit and where to ask for more once they reach it", async () => {
    const { user, createOrganization } = setup({});
    createOrganization.mockRejectedValue(new ApiError(403, { code: "organization_limit_reached", data: { limit: 3 } }, "POST → 403"));

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You've reached your limit of 3 organizations. Contact support@akash.network if you need more.");
  });

  it("tells the user they reached their organization limit when the API does not say what it is", async () => {
    const { user, createOrganization } = setup({});
    createOrganization.mockRejectedValue(new ApiError(403, { code: "organization_limit_reached" }, "POST → 403"));

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You've reached the number of organizations you can create. Contact support@akash.network if you need more."
    );
  });

  it("points out a name the API cannot accept on the name field", async () => {
    const { user, createOrganization, switchOrganization } = setup({});
    createOrganization.mockRejectedValue(new ApiError(400, { code: "validation_error" }, "POST → 400"));

    await user.type(screen.getByLabelText("Organization name"), "Harbor‮line");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(INVALID_ORGANIZATION_NAME_MESSAGE);
    expect(screen.getByLabelText("Organization name")).toHaveAttribute("aria-invalid", "true");
    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it("tells the user when the organization could not be created for another reason", async () => {
    const { user, createOrganization, enqueueSnackbar, onClose, stripe } = setup({});
    createOrganization.mockRejectedValue(new ApiError(503, {}, "POST → 503"));

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Add a new card/ }));
    await user.click(screen.getByRole("button", { name: "Fill in the card" }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't create the organization" }) }), {
        variant: "error"
      })
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(stripe.createSetupIntent).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Create organization" })).toBeEnabled();
  });

  it("closes when cancelled, from its close button and with Escape", async () => {
    const { user, onClose } = setup({});

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("stays open while the organization is being created", async () => {
    const { user, onClose, createOrganization } = setup({});
    createOrganization.mockReturnValue(new Promise(() => {}));

    await user.type(screen.getByLabelText("Organization name"), "Harborline");
    await user.click(screen.getByRole("radio", { name: /^Set up later/ }));
    await user.click(screen.getByRole("button", { name: "Create organization" }));
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Create organization/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /^Add a new card/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  function setup(input: { email?: string }) {
    document.cookie = "console_org=; Path=/; Max-Age=0";
    const organizations: OrganizationOutput[] = [
      { id: "org-1", name: "alice", slug: "personal-0123456789ab", type: "personal", role: "owner", isActive: true, createdAt: "2026-01-01T00:00:00Z" },
      { id: "org-2", name: "Acme Corp", slug: "acme-corp", type: "team", role: "admin", isActive: false, createdAt: "2026-02-01T00:00:00Z" }
    ];
    const created: OrganizationOutput = {
      id: "org-9",
      name: "Harborline",
      slug: "harborline",
      type: "team",
      role: "owner",
      isActive: false,
      createdAt: "2026-10-08T00:00:00Z"
    };
    const createOrganization = vi.fn<ReturnType<typeof DEPENDENCIES.useCreateOrganizationMutation>["mutateAsync"]>().mockResolvedValue({ data: created });
    const inviteToActiveOrganization = vi
      .fn<ReturnType<typeof DEPENDENCIES.useCreateOrganizationInvitationsMutation>["mutateAsync"]>()
      .mockResolvedValue({ data: [] });
    const switchOrganization = vi.fn<ReturnType<typeof DEPENDENCIES.useActiveOrganization>["switchOrganization"]>().mockReturnValue(true);
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();
    const stripe = mock<StripeService>();
    stripe.createSetupIntent.mockResolvedValue({ clientSecret: "seti_secret" });
    stripe.getPaymentMethods.mockResolvedValue([]);
    const errorHandler = mock<ErrorHandlerService>();
    const card = mock<NewCardHandle>();
    card.validate.mockResolvedValue(true);
    card.save.mockResolvedValue(undefined);

    const NewCardFields = forwardRef<NewCardHandle, { onCompleteChange: (isComplete: boolean) => void }>(function NewCardFields({ onCompleteChange }, ref) {
      useImperativeHandle(ref, () => card);
      return (
        <button type="button" onClick={() => onCompleteChange(true)}>
          Fill in the card
        </button>
      );
    });

    const dependencies: typeof DEPENDENCIES = {
      useActiveOrganization: () => mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ organizations, switchOrganization }),
      useUser: () =>
        mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: { id: "user-1", userId: "auth0|user-1", email: input.email ?? "alice@example.com" } }),
      useCreateOrganizationMutation: () => mock<ReturnType<typeof DEPENDENCIES.useCreateOrganizationMutation>>({ mutateAsync: createOrganization }),
      useCreateOrganizationInvitationsMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useCreateOrganizationInvitationsMutation>>({ mutateAsync: inviteToActiveOrganization }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      OrganizationBillingField: props => <OrganizationBillingField {...props} dependencies={{ NewCardFields }} />
    };

    render(
      <TestContainerProvider services={{ stripe: () => stripe, errorHandler: () => errorHandler }}>
        <CreateOrganizationDialog onClose={onClose} dependencies={dependencies} />
      </TestContainerProvider>
    );

    return {
      user: userEvent.setup({ delay: null }),
      createOrganization,
      inviteToActiveOrganization,
      switchOrganization,
      enqueueSnackbar,
      onClose,
      stripe,
      errorHandler,
      card
    };
  }
});
