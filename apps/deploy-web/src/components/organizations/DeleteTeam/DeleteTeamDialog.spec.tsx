import { IntlProvider } from "react-intl";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletDeletionEligibility } from "@src/components/user/DeleteAccount/useAccountDeletionEligibility";
import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { OrganizationOutput } from "@src/types/organization";
import { DeleteTeamDialog, DEPENDENCIES } from "./DeleteTeamDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

const TEAM = { id: "org-2", name: "Acme Corp" };
const PERSONAL: OrganizationOutput = {
  id: "org-1",
  name: "jane",
  slug: "personal-jane",
  type: "personal",
  role: "owner",
  isActive: false,
  hasPaymentMethod: null,
  createdAt: "2026-01-01T00:00:00Z"
};
const SUPPORT_URL = "https://discord.akash.network/";

describe(DeleteTeamDialog.name, () => {
  it("checks the team before offering anything", () => {
    setup({ eligibility: { status: "loading" } });

    expect(screen.getByText("Checking the team's deployments and credits…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete team" })).not.toBeInTheDocument();
  });

  it("sends an owner whose team has active deployments to close them first", () => {
    setup({ eligibility: { status: "blocked", activeDeploymentCount: 2 } });

    expect(screen.getByText("Close the team's deployments first")).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp has 2 active deployments\. Close them before/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to deployments" })).toHaveAttribute("href", "/deployments");
    expect(screen.queryByRole("button", { name: "Delete team" })).not.toBeInTheDocument();
  });

  it("speaks of a single active deployment in the singular", () => {
    setup({ eligibility: { status: "blocked", activeDeploymentCount: 1 } });

    expect(screen.getByText(/Acme Corp has 1 active deployment\. Close it before/)).toBeInTheDocument();
  });

  it("closes from the deployments notice", async () => {
    const { user, onClose } = setup({ eligibility: { status: "blocked", activeDeploymentCount: 1 } });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("shows the team's credits and offers to contact support or forfeit them", () => {
    setup({ eligibility: { status: "forfeit", balanceUsd: 12.5 } });

    expect(screen.getByText(/Acme Corp still has \$12\.50 in credits/)).toBeInTheDocument();
    const supportLink = screen.getByRole("link", { name: "Contact support" });
    expect(supportLink).toHaveAttribute("href", SUPPORT_URL);
    expect(supportLink).toHaveAttribute("target", "_blank");
    expect(supportLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("deletes a team with credits only once the owner acknowledges forfeiting them", async () => {
    const { user, deleteOrganization } = setup({ eligibility: { status: "forfeit", balanceUsd: 12.5 } });

    await user.click(screen.getByRole("button", { name: "Delete and forfeit" }));
    await user.type(screen.getByRole("textbox", { name: "Type Acme Corp to confirm" }), "Acme Corp");

    expect(screen.getByRole("button", { name: "Delete team" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /I understand the team's remaining \$12\.50 in credits won't be refunded/ }));
    await user.click(screen.getByRole("button", { name: "Delete team" }));

    expect(deleteOrganization).toHaveBeenCalledWith({ id: TEAM.id, acknowledgedForfeitUsd: 12.5 });
  });

  it("withdraws the forfeit acknowledgement when the box is unchecked", async () => {
    const { user } = setup({ eligibility: { status: "forfeit", balanceUsd: 12.5 } });
    await user.click(screen.getByRole("button", { name: "Delete and forfeit" }));
    await user.type(screen.getByRole("textbox", { name: "Type Acme Corp to confirm" }), "Acme Corp");
    const acknowledgement = screen.getByRole("checkbox", { name: /I understand the team's remaining/ });

    await user.click(acknowledgement);
    await user.click(acknowledgement);

    expect(screen.getByRole("button", { name: "Delete team" })).toBeDisabled();
  });

  it("keeps the team until the owner types its name", async () => {
    const { user, deleteOrganization } = setup({ eligibility: { status: "clean" } });

    await user.type(screen.getByRole("textbox", { name: "Type Acme Corp to confirm" }), "acme corp{Enter}");

    expect(screen.getByRole("button", { name: "Delete team" })).toBeDisabled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(deleteOrganization).not.toHaveBeenCalled();
  });

  it("deletes a team without credits, acknowledging no forfeit, and moves the owner to their personal account", async () => {
    const { user, deleteOrganization, switchOrganization, enqueueSnackbar, onClose } = setup({ eligibility: { status: "clean" } });

    await user.type(screen.getByRole("textbox", { name: "Type Acme Corp to confirm" }), " Acme Corp ");
    await user.click(screen.getByRole("button", { name: "Delete team" }));

    expect(deleteOrganization).toHaveBeenCalledWith({ id: TEAM.id, acknowledgedForfeitUsd: 0 });
    await vi.waitFor(() => expect(switchOrganization).toHaveBeenCalledWith(PERSONAL.id, { destination: "/deployments" }));
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
    expect(onClose).toHaveBeenCalled();
  });

  it("only closes when no personal account is known to switch to", async () => {
    const { user, switchOrganization, onClose } = setup({ eligibility: { status: "clean" }, organizations: [] });

    await confirmWithName(user);

    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it("switches to the deployments notice when the API finds active deployments", async () => {
    const refusal = new ApiError(409, { code: "active_deployments", data: { activeDeploymentCount: 3, dseqs: ["1", "2", "3"] } }, "409");
    const { user } = setup({ eligibility: { status: "clean" }, response: Promise.reject(refusal) });

    await confirmWithName(user);

    expect(await screen.findByText(/Acme Corp has 3 active deployments/)).toBeInTheDocument();
  });

  it("assumes a single active deployment when the API does not say how many", async () => {
    const { user } = setup({ eligibility: { status: "clean" }, response: Promise.reject(new ApiError(409, { code: "active_deployments" }, "409")) });

    await confirmWithName(user);

    expect(await screen.findByText(/Acme Corp has 1 active deployment\./)).toBeInTheDocument();
  });

  it("asks for the forfeit acknowledgement when the API finds credits the dialog did not see, without showing it as an error", async () => {
    const refusal = new ApiError(400, { code: "forfeit_acknowledgement_required", data: { balanceUsd: 7 } }, "400");
    const { user } = setup({ eligibility: { status: "clean" }, response: Promise.reject(refusal) });

    await confirmWithName(user);
    await user.click(await screen.findByRole("button", { name: "Delete and forfeit" }));

    expect(screen.getByRole("checkbox", { name: /I understand the team's remaining \$7\.00 in credits/ })).toBeInTheDocument();
    expect(screen.queryByText("We couldn't delete the team. Please try again.")).not.toBeInTheDocument();
  });

  it("acknowledges the credits the API found once the owner forfeits them", async () => {
    const refusal = new ApiError(400, { code: "forfeit_acknowledgement_required", data: { balanceUsd: 7 } }, "400");
    const { user, deleteOrganization } = setup({ eligibility: { status: "clean" }, response: Promise.reject(refusal) });

    await confirmWithName(user);
    await user.click(await screen.findByRole("button", { name: "Delete and forfeit" }));
    await user.click(screen.getByRole("checkbox", { name: /I understand the team's remaining \$7\.00 in credits/ }));
    await confirmWithName(user);

    expect(deleteOrganization).toHaveBeenLastCalledWith({ id: TEAM.id, acknowledgedForfeitUsd: 7 });
  });

  it("speaks of no credits when the API asks for an acknowledgement without a balance", async () => {
    const { user } = setup({
      eligibility: { status: "clean" },
      response: Promise.reject(new ApiError(400, { code: "forfeit_acknowledgement_required" }, "400"))
    });

    await confirmWithName(user);

    expect(await screen.findByText(/Acme Corp still has \$0\.00 in credits/)).toBeInTheDocument();
  });

  it("asks the owner to retry when the team could not be deleted", async () => {
    const { user, switchOrganization } = setup({
      eligibility: { status: "clean" },
      response: Promise.reject(new ApiError(500, { message: "Internal Server Error" }, "500"))
    });

    await confirmWithName(user);

    expect(await screen.findByText("We couldn't delete the team. Please try again.")).toBeInTheDocument();
    expect(screen.queryByText("Internal Server Error")).not.toBeInTheDocument();
    expect(switchOrganization).not.toHaveBeenCalled();
  });

  it("closes when the owner cancels", async () => {
    const { user, onClose } = setup({ eligibility: { status: "clean" } });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the owner presses Escape", async () => {
    const { user, onClose } = setup({ eligibility: { status: "clean" } });

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("stays open while the team is being deleted", async () => {
    const { user, onClose } = setup({ eligibility: { status: "clean" }, response: new Promise(() => undefined) });

    await confirmWithName(user);
    await user.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  async function confirmWithName(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByRole("textbox", { name: "Type Acme Corp to confirm" }), TEAM.name);
    await user.click(screen.getByRole("button", { name: "Delete team" }));
  }

  function setup(input: { eligibility: WalletDeletionEligibility; response?: Promise<unknown>; organizations?: OrganizationOutput[] }) {
    const response = input.response ?? Promise.resolve(undefined);
    response.catch(() => undefined);
    const deleteOrganization = vi.fn(() => response);
    const api = createProxy({ v1: { deleteOrganization } }) as unknown as AppDIContainer["api"];
    const publicConfig = mock<AppDIContainer["publicConfig"]>({ NEXT_PUBLIC_CONTACT_SUPPORT_URL: SUPPORT_URL });
    const switchOrganization = vi.fn(() => true);
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useWalletDeletionEligibility: () => input.eligibility,
      useActiveOrganization: () =>
        mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ organizations: input.organizations ?? [PERSONAL], switchOrganization }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    render(
      <IntlProvider locale="en">
        <TestContainerProvider services={{ api: () => api, publicConfig: () => publicConfig }}>
          <DeleteTeamDialog organization={TEAM} onClose={onClose} dependencies={dependencies} />
        </TestContainerProvider>
      </IntlProvider>
    );

    return { user: userEvent.setup(), deleteOrganization, switchOrganization, enqueueSnackbar, onClose };
  }
});
