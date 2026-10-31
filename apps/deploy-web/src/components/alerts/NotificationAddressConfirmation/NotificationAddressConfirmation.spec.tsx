import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import type { NextRouter } from "next/router";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import { DEPENDENCIES, NotificationAddressConfirmation } from "./NotificationAddressConfirmation";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(NotificationAddressConfirmation.name, () => {
  it("confirms the address with the token from the link once the button is clicked", async () => {
    const { user, createNotificationAddressConfirmation } = setup({ token: "link-token" });

    await user.click(screen.getByRole("button", { name: "Confirm email address" }));

    expect(await screen.findByText("Email address confirmed")).toBeInTheDocument();
    expect(createNotificationAddressConfirmation).toHaveBeenCalledWith({ data: { token: "link-token" } });
  });

  it("does not confirm the address just because the page was opened", () => {
    const { createNotificationAddressConfirmation } = setup({ token: "link-token" });

    expect(screen.getByText("Confirm your email address")).toBeInTheDocument();
    expect(screen.queryByText("Email address confirmed")).not.toBeInTheDocument();
    expect(createNotificationAddressConfirmation).not.toHaveBeenCalled();
  });

  it("explains the link does not work when it has no token", () => {
    setup({ token: undefined });

    expect(screen.getByText("This link doesn't work")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm email address" })).not.toBeInTheDocument();
  });

  it("explains the link does not work when the API refuses its token", async () => {
    const { user } = setup({ token: "used-token", response: Promise.reject(new ApiError(400, {}, "refused")) });

    await user.click(screen.getByRole("button", { name: "Confirm email address" }));

    expect(await screen.findByText("This link doesn't work")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm email address" })).not.toBeInTheDocument();
  });

  it("keeps the button and asks to try again when the API fails", async () => {
    const { user } = setup({ token: "link-token", response: Promise.reject(new ApiError(503, {}, "unavailable")) });

    await user.click(screen.getByRole("button", { name: "Confirm email address" }));

    expect(await screen.findByText("We couldn't confirm your address just now. Try again in a moment.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm email address" })).toBeEnabled();
  });

  it("waits for the router before deciding whether the link has a token", () => {
    setup({ token: undefined, isReady: false });

    expect(screen.queryByText("This link doesn't work")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm email address" })).not.toBeInTheDocument();
  });

  function setup(input: { token: string | undefined; isReady?: boolean; response?: Promise<unknown> }) {
    const response = input.response ?? Promise.resolve(undefined);
    response.catch(() => undefined);
    const createNotificationAddressConfirmation = vi.fn(() => response);
    const api = createProxy({ v1: { createNotificationAddressConfirmation } }) as unknown as AppDIContainer["api"];
    const useRouter: typeof DEPENDENCIES.useRouter = () =>
      mock<NextRouter>({ isReady: input.isReady ?? true, query: input.token === undefined ? {} : { token: input.token } });

    render(
      <TestContainerProvider services={{ api: () => api }}>
        <NotificationAddressConfirmation dependencies={MockComponents(DEPENDENCIES, { useRouter })} />
      </TestContainerProvider>
    );

    return { user: userEvent.setup(), createNotificationAddressConfirmation };
  }
});
