import { IntlProvider } from "react-intl";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DEPENDENCIES } from "./DeleteAccountDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import type { AccountDeletionEligibility } from "./useAccountDeletionEligibility";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

const EMAIL = "jane@example.com";
const SUPPORT_URL = "https://discord.akash.network/";

describe(DeleteAccountDialog.name, () => {
  it("checks the account before offering anything", () => {
    setup({ eligibility: { status: "loading" } });

    expect(screen.getByText("Checking your deployments and credits…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send confirmation email" })).not.toBeInTheDocument();
  });

  it("sends a user with active deployments to close them first", () => {
    setup({ eligibility: { status: "blocked", activeDeploymentCount: 2 } });

    expect(screen.getByText("Close your deployments first")).toBeInTheDocument();
    expect(screen.getByText(/You have 2 active deployments\. Close them before/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to deployments" })).toHaveAttribute("href", "/deployments");
    expect(screen.queryByRole("button", { name: "Send confirmation email" })).not.toBeInTheDocument();
  });

  it("speaks of a single active deployment in the singular", () => {
    setup({ eligibility: { status: "blocked", activeDeploymentCount: 1 } });

    expect(screen.getByText(/You have 1 active deployment\. Close it before/)).toBeInTheDocument();
  });

  it("offers a user with credits to contact support or forfeit them", () => {
    setup({ eligibility: { status: "forfeit", balanceUsd: 12.5 } });

    expect(screen.getByText(/You still have \$12\.50 in credits/)).toBeInTheDocument();
    const supportLink = screen.getByRole("link", { name: "Contact support" });
    expect(supportLink).toHaveAttribute("href", SUPPORT_URL);
    expect(supportLink).toHaveAttribute("target", "_blank");
    expect(supportLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("reports a user picking support over forfeiting", async () => {
    const { user, analyticsService } = setup({ eligibility: { status: "forfeit", balanceUsd: 12.5 } });

    await user.click(screen.getByRole("link", { name: "Contact support" }));

    expect(analyticsService.track).toHaveBeenCalledWith("account_deletion_support_clicked", { category: "user", label: "Contact support about credits" });
  });

  it("asks a user forfeiting credits to acknowledge it before the email can be sent", async () => {
    const { user, analyticsService, createAccountDeletionRequest } = setup({ eligibility: { status: "forfeit", balanceUsd: 12.5 } });

    await user.click(screen.getByRole("button", { name: "Delete and forfeit" }));
    await user.type(screen.getByRole("textbox", { name: `Type ${EMAIL} to confirm` }), EMAIL);

    expect(analyticsService.track).toHaveBeenCalledWith("account_deletion_forfeit_chosen", { category: "user", label: "Delete account and forfeit credits" });
    expect(screen.getByRole("button", { name: "Send confirmation email" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /I understand my remaining \$12\.50 in credits won't be refunded/ }));
    await user.click(screen.getByRole("button", { name: "Send confirmation email" }));

    expect(createAccountDeletionRequest).toHaveBeenCalledWith({ data: { forfeitAcknowledged: true } });
  });

  it("withdraws the forfeit acknowledgement when the box is unchecked", async () => {
    const { user } = setup({ eligibility: { status: "forfeit", balanceUsd: 12.5 } });
    await user.click(screen.getByRole("button", { name: "Delete and forfeit" }));
    await user.type(screen.getByRole("textbox", { name: `Type ${EMAIL} to confirm` }), EMAIL);
    const acknowledgement = screen.getByRole("checkbox", { name: /I understand my remaining/ });

    await user.click(acknowledgement);
    await user.click(acknowledgement);

    expect(screen.getByRole("button", { name: "Send confirmation email" })).toBeDisabled();
  });

  it("keeps the email unsent until the user types their own email", async () => {
    const { user } = setup({ eligibility: { status: "clean" } });
    const sendButton = screen.getByRole("button", { name: "Send confirmation email" });

    await user.type(screen.getByRole("textbox", { name: `Type ${EMAIL} to confirm` }), "someone@example.com");

    expect(sendButton).toBeDisabled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Check your email")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("accepts the email in any letter case and with stray spaces", async () => {
    const { user, createAccountDeletionRequest } = setup({ eligibility: { status: "clean" } });

    await user.type(screen.getByRole("textbox", { name: `Type ${EMAIL} to confirm` }), " Jane@Example.com ");
    await user.click(screen.getByRole("button", { name: "Send confirmation email" }));

    expect(createAccountDeletionRequest).toHaveBeenCalledWith({ data: { forfeitAcknowledged: false } });
  });

  it("does not send when the form is submitted before the email matches", async () => {
    const { user, createAccountDeletionRequest } = setup({ eligibility: { status: "clean" } });

    await user.type(screen.getByRole("textbox", { name: `Type ${EMAIL} to confirm` }), "jane@{Enter}");

    expect(createAccountDeletionRequest).not.toHaveBeenCalled();
  });

  it("tells the user to check their email once the link is sent", async () => {
    const { user, onClose } = setup({ eligibility: { status: "clean" } });

    await confirmWithEmail(user);

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText(EMAIL)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("switches to the deployments notice when the API finds active deployments", async () => {
    const refusal = new ApiError(409, { code: "active_deployments", data: { activeDeploymentCount: 3, dseqs: ["1", "2", "3"] } }, "409");
    const { user } = setup({ eligibility: { status: "clean" }, response: Promise.reject(refusal) });

    await confirmWithEmail(user);

    expect(await screen.findByText(/You have 3 active deployments/)).toBeInTheDocument();
  });

  it("switches to the forfeit choice when the API finds credits the dialog did not see", async () => {
    const refusal = new ApiError(400, { code: "forfeit_acknowledgement_required", data: { balanceUsd: 7 } }, "400");
    const { user } = setup({ eligibility: { status: "clean" }, response: Promise.reject(refusal) });

    await confirmWithEmail(user);

    expect(await screen.findByText(/You still have \$7\.00 in credits/)).toBeInTheDocument();
  });

  it("assumes a single active deployment when the API does not say how many", async () => {
    const { user } = setup({ eligibility: { status: "clean" }, response: Promise.reject(new ApiError(409, { code: "active_deployments" }, "409")) });

    await confirmWithEmail(user);

    expect(await screen.findByText(/You have 1 active deployment\./)).toBeInTheDocument();
  });

  it("asks for the forfeit acknowledgement after the API refused without it, without repeating the refusal as an error", async () => {
    const refusal = new ApiError(400, { code: "forfeit_acknowledgement_required", data: { balanceUsd: 7 } }, "400");
    const { user } = setup({ eligibility: { status: "clean" }, response: Promise.reject(refusal) });

    await confirmWithEmail(user);
    await user.click(await screen.findByRole("button", { name: "Delete and forfeit" }));

    expect(screen.getByRole("checkbox", { name: /I understand my remaining \$7\.00 in credits/ })).toBeInTheDocument();
    expect(screen.queryByText("We couldn't send the email. Please try again.")).not.toBeInTheDocument();
  });

  it("asks the user to retry when the API answered without a body", async () => {
    const { user } = setup({ eligibility: { status: "clean" }, response: Promise.reject(new ApiError(502, undefined, "502")) });

    await confirmWithEmail(user);

    expect(await screen.findByText("We couldn't send the email. Please try again.")).toBeInTheDocument();
  });

  it("shows the API's message when a link was sent too recently", async () => {
    const refusal = new ApiError(429, { code: "account_deletion_cooldown", message: "A deletion link was just sent." }, "429");
    const { user } = setup({ eligibility: { status: "clean" }, response: Promise.reject(refusal) });

    await confirmWithEmail(user);

    expect(await screen.findByText("A deletion link was just sent.")).toBeInTheDocument();
  });

  it("asks the user to retry when the email could not be sent", async () => {
    const { user } = setup({ eligibility: { status: "clean" }, response: Promise.reject(new ApiError(500, {}, "500")) });

    await confirmWithEmail(user);

    expect(await screen.findByText("We couldn't send the email. Please try again.")).toBeInTheDocument();
  });

  it("closes when the user cancels", async () => {
    const { user, onClose } = setup({ eligibility: { status: "clean" } });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the user presses Escape", async () => {
    const { user, onClose } = setup({ eligibility: { status: "clean" } });

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("stays open on Escape while the email is being sent", async () => {
    const { user, onClose } = setup({ eligibility: { status: "clean" }, response: new Promise(() => undefined) });

    await confirmWithEmail(user);
    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from the deployments notice when the user cancels", async () => {
    const { user, onClose } = setup({ eligibility: { status: "blocked", activeDeploymentCount: 1 } });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });

  async function confirmWithEmail(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByRole("textbox", { name: `Type ${EMAIL} to confirm` }), EMAIL);
    await user.click(screen.getByRole("button", { name: "Send confirmation email" }));
  }

  function setup(input: { eligibility: AccountDeletionEligibility; response?: Promise<unknown> }) {
    const response = input.response ?? Promise.resolve(undefined);
    response.catch(() => undefined);
    const createAccountDeletionRequest = vi.fn(() => response);
    const api = createProxy({ v1: { createAccountDeletionRequest } }) as unknown as AppDIContainer["api"];
    const analyticsService = mock<AnalyticsService>();
    const publicConfig = mock<AppDIContainer["publicConfig"]>({ NEXT_PUBLIC_CONTACT_SUPPORT_URL: SUPPORT_URL });
    const onClose = vi.fn();
    const dependencies: typeof DEPENDENCIES = { useAccountDeletionEligibility: () => input.eligibility };

    render(
      <IntlProvider locale="en">
        <TestContainerProvider services={{ api: () => api, analyticsService: () => analyticsService, publicConfig: () => publicConfig }}>
          <DeleteAccountDialog email={EMAIL} onClose={onClose} dependencies={dependencies} />
        </TestContainerProvider>
      </IntlProvider>
    );

    return { user: userEvent.setup(), createAccountDeletionRequest, analyticsService, onClose };
  }
});
