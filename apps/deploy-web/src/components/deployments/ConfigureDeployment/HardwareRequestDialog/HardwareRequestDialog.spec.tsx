import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { DEPENDENCIES } from "./HardwareRequestDialog";
import { HardwareRequestDialog } from "./HardwareRequestDialog";
import type { HardwareRequestConfiguration } from "./hardwareRequestForm";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

const CONFIGURATION: HardwareRequestConfiguration = {
  summary: "1 vCPU · 2 GiB memory · 1 GiB storage · Any region",
  cpu: 1,
  memoryBytes: 2 * 1024 ** 3,
  storageBytes: 1024 ** 3,
  region: null
};

const DISCORD_URL = "https://discord.akash.network/";

describe("HardwareRequestDialog", () => {
  it("prefills the GPU model from the search and the email from the account", () => {
    setup({ initialGpuModel: "B200", email: "jane@example.com" });

    expect(screen.getByRole("textbox", { name: "GPU model" })).toHaveValue("B200");
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("jane@example.com");
    expect(screen.getByRole("radio", { name: "GPU model" })).toBeChecked();
    expect(screen.queryByRole("textbox", { name: "Region" })).not.toBeInTheDocument();
  });

  it.each([
    { category: "GPU model", field: "GPU model", message: "Enter the GPU model you need" },
    { category: "Region", field: "Region", message: "Enter the region you need" },
    { category: "Something else", field: "Details", message: "Describe what you need" }
  ])("explains a missing $field on a $category request next to the field", async ({ category, field, message }) => {
    const { user } = setup({ initialGpuModel: "B200" });

    await user.click(screen.getByRole("radio", { name: category }));
    const input = screen.getByRole("textbox", { name: field });
    expect(input).toHaveAttribute("aria-invalid", "false");
    await user.type(input, "x");
    await user.clear(input);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("leaves the email empty for an account without one", () => {
    setup({ email: undefined });

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("");
  });

  it("shows the configuration it offers to include, included by default", () => {
    setup({});

    expect(screen.getByText(CONFIGURATION.summary)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Include my current configuration" })).toBeChecked();
  });

  it("sends a GPU request with the current configuration", async () => {
    const { user, createHardwareRequest } = setup({ initialGpuModel: "B200" });

    await user.click(screen.getByRole("button", { name: "Increase Quantity" }));
    await user.type(screen.getByRole("textbox", { name: "Details" }), "Training run");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => {
      expect(createHardwareRequest).toHaveBeenCalledWith({
        data: {
          category: "gpu_model",
          gpuModel: "B200",
          quantity: 2,
          details: "Training run",
          email: "jane@example.com",
          configuration: CONFIGURATION
        }
      });
    });
  });

  it("leaves the configuration out when the user unchecks it", async () => {
    const { user, createHardwareRequest } = setup({ initialGpuModel: "B200" });

    await user.click(screen.getByRole("checkbox", { name: "Include my current configuration" }));
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => {
      expect(createHardwareRequest).toHaveBeenCalledWith({ data: expect.objectContaining({ configuration: undefined }) });
    });
  });

  it("asks only for the region on a region request", async () => {
    const { user, createHardwareRequest } = setup({ initialGpuModel: "B200" });

    await user.click(screen.getByRole("radio", { name: "Region" }));
    await user.type(screen.getByRole("textbox", { name: "Region" }), "Frankfurt");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(screen.queryByRole("textbox", { name: "GPU model" })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(createHardwareRequest).toHaveBeenCalledWith({
        data: { category: "region", region: "Frankfurt", details: undefined, email: "jane@example.com", configuration: CONFIGURATION }
      });
    });
  });

  it("marks the GPU model optional on a capacity request", async () => {
    const { user } = setup({ initialGpuModel: "" });

    await user.click(screen.getByRole("radio", { name: "More capacity" }));

    expect(screen.getByRole("textbox", { name: "GPU model (optional)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });

  it("asks for details on a request for something else", async () => {
    const { user } = setup({ initialGpuModel: "B200" });

    await user.click(screen.getByRole("radio", { name: "Something else" }));

    expect(screen.queryByRole("textbox", { name: "GPU model" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Details" }), "Need ARM nodes");

    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });

  it("keeps a category picked when it is clicked again", async () => {
    const { user } = setup({});

    await user.click(screen.getByRole("radio", { name: "GPU model" }));

    expect(screen.getByRole("radio", { name: "GPU model" })).toBeChecked();
  });

  it("keeps send disabled until the GPU model is filled in", async () => {
    const { user } = setup({ initialGpuModel: "" });

    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "GPU model" }), "B200");

    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });

  it("explains an invalid email next to the field", async () => {
    const { user } = setup({});

    await user.clear(screen.getByRole("textbox", { name: "Email" }));
    await user.type(screen.getByRole("textbox", { name: "Email" }), "jane");

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
  });

  it("includes the configuration again when the user re-checks it", async () => {
    const { user, createHardwareRequest } = setup({ initialGpuModel: "B200" });

    await user.click(screen.getByRole("checkbox", { name: "Include my current configuration" }));
    await user.click(screen.getByRole("checkbox", { name: "Include my current configuration" }));
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => {
      expect(createHardwareRequest).toHaveBeenCalledWith({ data: expect.objectContaining({ configuration: CONFIGURATION }) });
    });
  });

  it("closes when the user presses Escape", async () => {
    const { user, onClose } = setup({});

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("confirms the request and closes once it is sent", async () => {
    const { user, onClose, enqueueSnackbar } = setup({});

    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
  });

  it("shows the limit in the dialog when the user has sent too many requests", async () => {
    const message = "You can send up to 3 requests an hour. Try again later, or ask us on Discord.";
    const { user, onClose, enqueueSnackbar } = setup({
      response: Promise.reject(new ApiError(429, { code: "hardware_request_limit", message }, "POST /v1/hardware-requests → 429"))
    });

    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("reports any other failure in a snackbar and stays open", async () => {
    const { user, onClose, enqueueSnackbar } = setup({
      response: Promise.reject(new ApiError(500, { message: "Internal server error" }, "POST /v1/hardware-requests → 500"))
    });

    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => {
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" });
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("closes without sending when the user cancels", async () => {
    const { user, onClose, createHardwareRequest } = setup({});

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(createHardwareRequest).not.toHaveBeenCalled();
  });

  it("offers Discord as another way to ask", () => {
    setup({});

    expect(screen.getByRole("link", { name: "Or ask on Discord" })).toHaveAttribute("href", DISCORD_URL);
  });

  function setup(input: { initialGpuModel?: string; email?: string; response?: Promise<unknown> }) {
    const response = input.response ?? Promise.resolve({ data: { id: "request-id", createdAt: "2026-09-29T12:00:00.000Z" } });
    response.catch(() => undefined);
    const createHardwareRequest = vi.fn(() => response);
    const api = createProxy({ v1: { createHardwareRequest } }) as unknown as AppDIContainer["api"];
    const publicConfig = mock<AppDIContainer["publicConfig"]>({ NEXT_PUBLIC_CONTACT_SUPPORT_URL: DISCORD_URL });
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();
    const email = "email" in input ? input.email : "jane@example.com";
    const dependencies: typeof DEPENDENCIES = {
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: email ? { email } : undefined }),
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() })
    };

    render(
      <TestContainerProvider services={{ api: () => api, publicConfig: () => publicConfig }}>
        <HardwareRequestDialog initialGpuModel={input.initialGpuModel ?? "B200"} configuration={CONFIGURATION} onClose={onClose} dependencies={dependencies} />
      </TestContainerProvider>
    );

    return { user: userEvent.setup(), createHardwareRequest, enqueueSnackbar, onClose };
  }
});
