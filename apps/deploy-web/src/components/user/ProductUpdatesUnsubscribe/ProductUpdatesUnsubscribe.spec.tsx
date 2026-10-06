import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import type { NextRouter } from "next/router";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import { DEPENDENCIES, ProductUpdatesUnsubscribe } from "./ProductUpdatesUnsubscribe";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(ProductUpdatesUnsubscribe.name, () => {
  it("unsubscribes with the token from the link once the button is clicked", async () => {
    const { user, createProductUpdateUnsubscription } = setup({ token: "user-id.signature" });

    await user.click(screen.getByRole("button", { name: "Unsubscribe" }));

    expect(await screen.findByText("You're unsubscribed")).toBeInTheDocument();
    expect(createProductUpdateUnsubscription).toHaveBeenCalledWith({ token: "user-id.signature" });
  });

  it("does not unsubscribe just because the page was opened", () => {
    const { createProductUpdateUnsubscription } = setup({ token: "user-id.signature" });

    expect(screen.getByText("Unsubscribe from product updates")).toBeInTheDocument();
    expect(screen.queryByText("You're unsubscribed")).not.toBeInTheDocument();
    expect(createProductUpdateUnsubscription).not.toHaveBeenCalled();
  });

  it("explains the link does not work when it has no token", () => {
    setup({ token: undefined });

    expect(screen.getByText("This link doesn't work")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "support@akash.network" })).toHaveAttribute("href", "mailto:support@akash.network");
    expect(screen.queryByRole("button", { name: "Unsubscribe" })).not.toBeInTheDocument();
  });

  it("explains the link does not work when the API refuses its token", async () => {
    const { user } = setup({ token: "user-id.forged", response: Promise.reject(new ApiError(400, {}, "refused")) });

    await user.click(screen.getByRole("button", { name: "Unsubscribe" }));

    expect(await screen.findByText("This link doesn't work")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unsubscribe" })).not.toBeInTheDocument();
  });

  it("keeps the button and asks to try again when the API fails", async () => {
    const { user } = setup({ token: "user-id.signature", response: Promise.reject(new ApiError(503, {}, "unavailable")) });

    await user.click(screen.getByRole("button", { name: "Unsubscribe" }));

    expect(await screen.findByText("We couldn't unsubscribe you just now. Try again in a moment.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unsubscribe" })).toBeEnabled();
  });

  it("waits for the router before deciding whether the link has a token", () => {
    setup({ token: undefined, isReady: false });

    expect(screen.queryByText("This link doesn't work")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unsubscribe" })).not.toBeInTheDocument();
  });

  function setup(input: { token: string | undefined; isReady?: boolean; response?: Promise<unknown> }) {
    const response = input.response ?? Promise.resolve(undefined);
    response.catch(() => undefined);
    const createProductUpdateUnsubscription = vi.fn(() => response);
    const api = createProxy({ v1: { createProductUpdateUnsubscription } }) as unknown as AppDIContainer["api"];
    const useRouter: typeof DEPENDENCIES.useRouter = () =>
      mock<NextRouter>({ isReady: input.isReady ?? true, query: input.token === undefined ? {} : { token: input.token } });

    render(
      <TestContainerProvider services={{ api: () => api }}>
        <ProductUpdatesUnsubscribe dependencies={MockComponents(DEPENDENCIES, { useRouter })} />
      </TestContainerProvider>
    );

    return { user: userEvent.setup(), createProductUpdateUnsubscription };
  }
});
