import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import { ConfirmAccountDeletion, DEPENDENCIES } from "./ConfirmAccountDeletion";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(ConfirmAccountDeletion.name, () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("waits until it has read the link", () => {
    setup({ token: undefined });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete my account" })).not.toBeInTheDocument();
  });

  it("points a link without a token to account settings", () => {
    setup({ token: null });

    expect(screen.getByText("This link isn't valid")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to account settings" })).toHaveAttribute("href", "/user/settings");
  });

  it("asks before deleting and lets the user keep their account", () => {
    const { confirmAccountDeletion } = setup({ token: "link-token" });

    expect(screen.getByText("Delete your Akash Console account?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Keep my account" })).toHaveAttribute("href", "/");
    expect(confirmAccountDeletion).not.toHaveBeenCalled();
  });

  it("deletes the account, then signs the user out with a notice waiting for them", async () => {
    const { user, confirmAccountDeletion, authService } = setup({ token: "link-token" });

    await user.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(await screen.findByText("Your account has been deleted")).toBeInTheDocument();
    expect(confirmAccountDeletion).toHaveBeenCalledWith({ data: { token: "link-token" } });
    expect(authService.logout).toHaveBeenCalled();
    expect(window.sessionStorage.getItem("accountDeleted")).toBe("1");
  });

  it.each([
    { outcome: "deletion is not available", error: new ApiError(404, { code: "not_found" }, "404"), title: "Account deletion isn't available", link: "/" },
    { outcome: "the link expired", error: refusal(400, "expired_deletion_token"), title: "This link has expired", link: "/user/settings" },
    { outcome: "the link is not valid", error: refusal(400, "invalid_deletion_token"), title: "This link isn't valid", link: "/user/settings" },
    { outcome: "deployments are still active", error: refusal(409, "active_deployments"), title: "Close your deployments first", link: "/deployments" },
    { outcome: "credits were added", error: refusal(409, "forfeit_acknowledgement_required"), title: "Your account has new credits", link: "/user/settings" }
  ])("explains what to do when $outcome", async ({ error, title, link }) => {
    const { user, authService } = setup({ token: "link-token", response: Promise.reject(error) });

    await user.click(screen.getByRole("button", { name: "Delete my account" }));

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", link);
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it("lets the user retry after an unexpected failure", async () => {
    const { user, confirmAccountDeletion } = setup({ token: "link-token", response: Promise.reject(new ApiError(500, {}, "500")) });

    await user.click(screen.getByRole("button", { name: "Delete my account" }));
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(confirmAccountDeletion).toHaveBeenCalledTimes(2);
  });

  function refusal(status: number, code: string) {
    return new ApiError(status, { code }, String(status));
  }

  function setup(input: { token: string | null | undefined; response?: Promise<unknown> }) {
    const response = input.response ?? Promise.resolve(undefined);
    response.catch(() => undefined);
    const confirmAccountDeletion = vi.fn(() => response);
    const api = createProxy({ v1: { confirmAccountDeletion } }) as unknown as AppDIContainer["api"];
    const authService = mock<AppDIContainer["authService"]>();
    const dependencies = MockComponents(DEPENDENCIES, { useDeletionLinkToken: () => input.token });

    render(
      <TestContainerProvider services={{ api: () => api, authService: () => authService }}>
        <ConfirmAccountDeletion dependencies={dependencies} />
      </TestContainerProvider>
    );

    return { user: userEvent.setup(), confirmAccountDeletion, authService };
  }
});
