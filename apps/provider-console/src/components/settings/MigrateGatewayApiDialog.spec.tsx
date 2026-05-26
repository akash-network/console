import "@testing-library/jest-dom";

import React from "react";

import { MigrateGatewayApiDialog } from "./MigrateGatewayApiDialog";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverMock });

const mockMutate = jest.fn();
const mockUseMigration = jest.fn();
jest.mock("@src/queries/useProviderQuery", () => ({
  useMigrateProviderToGatewayApi: () => mockUseMigration()
}));

const mockPush = jest.fn();
jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush })
}));

const mockUseControlMachine = jest.fn();
jest.mock("@src/context/ControlMachineProvider", () => ({
  useControlMachine: () => mockUseControlMachine()
}));

jest.mock("@src/utils/sanityUtils", () => ({
  sanitizeMachineAccess: (input: unknown) => input
}));

const VALID_TOKEN = "cf-token-abc";

describe("MigrateGatewayApiDialog", () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockMutate.mockResolvedValue({ message: "Migration started", action_id: "act-123" });
    mockUseMigration.mockReturnValue({ mutateAsync: mockMutate, isPending: false });
    mockPush.mockReset();
    mockUseControlMachine.mockReturnValue({
      activeControlMachine: { hostname: "10.0.0.1", port: 22, username: "root", keyfile: "abc==", passphrase: null, password: null }
    });
  });

  it("requires a non-empty domain before submission", async () => {
    const user = userEvent.setup();
    setup({ defaultDomain: "" });

    await user.click(screen.getByLabelText("Cloudflare"));
    await user.type(screen.getByPlaceholderText("ops@example.com"), "ops@example.com");
    await user.type(screen.getByLabelText("Cloudflare API token"), VALID_TOKEN);
    await user.click(screen.getByRole("button", { name: "Start migration" }));

    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Provider domain is required")).toBeInTheDocument();
  });

  it("requires acme_email since this is the migration flow", async () => {
    const user = userEvent.setup();
    setup({ defaultDomain: "provider.example.com" });

    await user.click(screen.getByLabelText("Cloudflare"));
    await user.type(screen.getByLabelText("Cloudflare API token"), VALID_TOKEN);
    await user.click(screen.getByRole("button", { name: "Start migration" }));

    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.getByText("Email is required")).toBeInTheDocument();
  });

  it("submits the migration request and redirects to the activity log on success", async () => {
    const user = userEvent.setup();
    setup({ defaultDomain: "provider.example.com" });

    await user.click(screen.getByLabelText("Cloudflare"));
    await user.type(screen.getByPlaceholderText("ops@example.com"), "ops@example.com");
    await user.type(screen.getByLabelText("Cloudflare API token"), VALID_TOKEN);
    await user.click(screen.getByRole("button", { name: "Start migration" }));

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate).toHaveBeenCalledWith({
      domain: "provider.example.com",
      control_machine: { hostname: "10.0.0.1", port: 22, username: "root", keyfile: "abc==", passphrase: null, password: null },
      cert_manager: {
        acme_email: "ops@example.com",
        use_staging: false,
        dns_provider: "cloudflare",
        cloudflare: { api_token: VALID_TOKEN }
      }
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/activity-logs/act-123"));
  });

  it("renders the API root error as a form-level banner on failure", async () => {
    const user = userEvent.setup();
    mockMutate.mockRejectedValueOnce({
      response: {
        data: {
          detail: {
            details: [{ field: "__root__", message: "dns_provider does not match payload shape" }]
          }
        }
      }
    });
    setup({ defaultDomain: "provider.example.com" });

    await user.click(screen.getByLabelText("Cloudflare"));
    await user.type(screen.getByPlaceholderText("ops@example.com"), "ops@example.com");
    await user.type(screen.getByLabelText("Cloudflare API token"), VALID_TOKEN);
    await user.click(screen.getByRole("button", { name: "Start migration" }));

    await waitFor(() => expect(screen.getByText("dns_provider does not match payload shape")).toBeInTheDocument());
  });

  function setup(input: { defaultDomain?: string; onClose?: () => void }) {
    return render(<MigrateGatewayApiDialog open onClose={input.onClose ?? jest.fn()} defaultDomain={input.defaultDomain ?? ""} />);
  }
});
