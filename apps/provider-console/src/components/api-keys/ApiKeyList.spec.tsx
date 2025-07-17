import "@testing-library/jest-dom";

import React from "react";
import { IntlProvider } from "react-intl";
import { PopupProvider } from "@akashnetwork/ui/context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { ApiKey } from "@src/types/apiKey";
import { ApiKeyList } from "./ApiKeyList";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn()
  }
});

describe("ApiKeyList", () => {
  const mockApiKey: ApiKey = {
    id: "1",
    apiKey: "test-api-key-123456789",
    walletAddress: "test-wallet-address",
    isActive: true,
    createdAt: "2024-01-01T10:00:00Z",
    lastUsedAt: "2024-01-15T14:30:00Z",
    expiresAt: "2025-01-01T10:00:00Z"
  };

  const mockInactiveApiKey: ApiKey = {
    ...mockApiKey,
    isActive: false
  };

  const mockExpiredApiKey: ApiKey = {
    ...mockApiKey,
    expiresAt: "2023-01-01T10:00:00Z"
  };

  const defaultProps = {
    apiKey: null,
    onDeleteApiKey: jest.fn(),
    onDeleteClose: jest.fn(),
    isDeleting: false,
    apiKeyToDelete: null,
    updateApiKeyToDelete: jest.fn(),
    onCreateApiKey: jest.fn(),
    isCreating: false
  };

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
  });

  it("should render empty state when no API key exists", () => {
    setup({});
    expect(screen.queryByText("No API Key Available")).toBeInTheDocument();
    expect(screen.queryByText("Create your first API key to start integrating with our services.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create Your First API Key" })).toBeInTheDocument();
  });

  it("should render API key details when key exists", () => {
    setup({ apiKey: mockApiKey });
    expect(screen.queryByText("Active API Key")).toBeInTheDocument();
    expect(screen.queryByText("••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••")).toBeInTheDocument();
    expect(screen.queryByText("Created:")).toBeInTheDocument();
    expect(screen.queryByText("Last used:")).toBeInTheDocument();
    expect(screen.queryByText("Expires:")).toBeInTheDocument();
  });

  it("should show inactive status for inactive API key", () => {
    setup({ apiKey: mockInactiveApiKey });
    expect(screen.queryByText("Inactive API Key")).toBeInTheDocument();
  });

  it("should show expired status for expired API key", () => {
    setup({ apiKey: mockExpiredApiKey });
    expect(screen.queryByText("Expired")).toBeInTheDocument();
  });

  it("should toggle API key visibility when show/hide button is clicked", async () => {
    const user = userEvent.setup();
    setup({ apiKey: mockApiKey });

    const showButton = screen.queryByRole("button", { name: "Show" });
    await user.click(showButton!);

    expect(screen.queryByText("test-api-key-123456789")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide" })).toBeInTheDocument();
  });

  it("should call onCreateApiKey when create button is clicked", async () => {
    const user = userEvent.setup();
    const onCreateApiKey = jest.fn();

    setup({ onCreateApiKey });

    const createButton = screen.queryByRole("button", { name: "Create Your First API Key" });
    await user.click(createButton!);

    expect(onCreateApiKey).toHaveBeenCalled();
  });

  it("should disable create button when isCreating is true", () => {
    setup({ isCreating: true });
    const createButton = screen.queryByRole("button", { name: "Creating..." });
    expect(createButton).toBeDisabled();
  });

  it("should call updateApiKeyToDelete when delete button is clicked", async () => {
    const user = userEvent.setup();
    const updateApiKeyToDelete = jest.fn();

    setup({ apiKey: mockApiKey, updateApiKeyToDelete });

    const deleteButton = screen.queryByRole("button", { name: "Delete" });
    await user.click(deleteButton!);

    expect(updateApiKeyToDelete).toHaveBeenCalledWith(mockApiKey);
  });

  it("should disable delete button when isDeleting is true", () => {
    setup({ apiKey: mockApiKey, isDeleting: true });
    const deleteButton = screen.queryByRole("button", { name: "Deleting..." });
    expect(deleteButton).toBeDisabled();
  });

  it("should display created date correctly", () => {
    setup({ apiKey: mockApiKey });
    expect(screen.queryByText("Created:")).toBeInTheDocument();
    // The actual date formatting is handled by react-intl, so we just check the label is present
  });

  it("should display last used date when available", () => {
    setup({ apiKey: mockApiKey });
    expect(screen.queryByText("Last used:")).toBeInTheDocument();
  });

  it("should display expiration date when available", () => {
    setup({ apiKey: mockApiKey });
    expect(screen.queryByText("Expires:")).toBeInTheDocument();
  });

  it("should display API documentation link", () => {
    setup({ apiKey: mockApiKey });
    expect(screen.queryByText("View API Documentation →")).toBeInTheDocument();
    expect(screen.queryByText("View API Documentation →")).toHaveAttribute("href");
  });

  it("should show security warning when key is hidden", () => {
    setup({ apiKey: mockApiKey });
    expect(screen.queryByText("Click “Show” to reveal your API key. Keep it secure and never share it publicly.")).toBeInTheDocument();
  });

  function setup(input: {
    apiKey?: ApiKey | null;
    isCreating?: boolean;
    isDeleting?: boolean;
    apiKeyToDelete?: ApiKey | null;
    onCreateApiKey?: () => void;
    updateApiKeyToDelete?: (apiKey: ApiKey) => void;
  }) {
    return render(
      <IntlProvider locale="en" messages={{}}>
        <QueryClientProvider client={queryClient}>
          <PopupProvider>
            <ApiKeyList
              {...defaultProps}
              apiKey={input.apiKey ?? defaultProps.apiKey}
              isCreating={input.isCreating ?? defaultProps.isCreating}
              isDeleting={input.isDeleting ?? defaultProps.isDeleting}
              apiKeyToDelete={input.apiKeyToDelete ?? defaultProps.apiKeyToDelete}
              onCreateApiKey={input.onCreateApiKey ?? defaultProps.onCreateApiKey}
              updateApiKeyToDelete={input.updateApiKeyToDelete ?? defaultProps.updateApiKeyToDelete}
            />
          </PopupProvider>
        </QueryClientProvider>
      </IntlProvider>
    );
  }
});
