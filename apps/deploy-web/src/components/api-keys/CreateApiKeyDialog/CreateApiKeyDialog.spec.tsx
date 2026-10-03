import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { differenceInCalendarDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { NewApiKey } from "@src/queries/useApiKeysQuery";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DEPENDENCIES } from "./CreateApiKeyDialog";
import { CreateApiKeyDialog } from "./CreateApiKeyDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildApiKey } from "@tests/seeders";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("CreateApiKeyDialog", () => {
  it("creates a key with the trimmed name that expires in one year by default", async () => {
    const { user, createApiKey } = setup();

    await user.type(screen.getByLabelText("Name"), "  CI/CD pipeline  ");
    await user.click(screen.getByRole("button", { name: "Create key" }));

    const [newApiKey] = createApiKey.mock.lastCall as [NewApiKey];
    expect(newApiKey.name).toBe("CI/CD pipeline");
    expect(differenceInCalendarDays(newApiKey.expiresAt, new Date())).toBe(365);
  });

  it("creates a key with the expiry the user picks", async () => {
    const { user, createApiKey } = setup();

    await user.type(screen.getByLabelText("Name"), "Monitoring");
    await user.click(screen.getByRole("combobox", { name: /Expiration/ }));
    await user.click(await screen.findByRole("option", { name: "30 days" }));
    await user.click(screen.getByRole("button", { name: "Create key" }));

    const [newApiKey] = createApiKey.mock.lastCall as [NewApiKey];
    expect(differenceInCalendarDays(newApiKey.expiresAt, new Date())).toBe(30);
  });

  it("offers expiries of at most one year", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("combobox", { name: /Expiration/ }));

    const options = await screen.findAllByRole("option");
    expect(options.map(option => option.textContent)).toEqual(["30 days", "90 days", "1 year"]);
  });

  it("tracks the key creation", async () => {
    const { user, analyticsService } = setup();

    await user.type(screen.getByLabelText("Name"), "Local dev");
    await user.click(screen.getByRole("button", { name: "Create key" }));

    expect(analyticsService.track).toHaveBeenCalledWith("create_api_key", { category: "settings", label: "Create API key" });
  });

  it("requires a name", async () => {
    const { user, createApiKey } = setup();

    await user.type(screen.getByLabelText("Name"), "   ");
    await user.click(screen.getByRole("button", { name: "Create key" }));

    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it("rejects a name longer than 40 characters", async () => {
    const { user, createApiKey } = setup();

    await user.type(screen.getByLabelText("Name"), "a".repeat(41));
    await user.click(screen.getByRole("button", { name: "Create key" }));

    expect(await screen.findByText("Name must be 40 characters or fewer.")).toBeInTheDocument();
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it("accepts a name of exactly 40 characters", async () => {
    const { user, createApiKey } = setup();

    await user.type(screen.getByLabelText("Name"), "a".repeat(40));
    await user.click(screen.getByRole("button", { name: "Create key" }));

    expect(createApiKey).toHaveBeenCalledWith(expect.objectContaining({ name: "a".repeat(40) }), expect.anything());
  });

  it("warns that the key has full access to the account", () => {
    setup();

    expect(screen.getByText(/to your Console account, including deployments, leases and billing/)).toBeInTheDocument();
  });

  it("blocks a second submit while the key is being created", () => {
    setup({ isPending: true });

    expect(screen.getByRole("button", { name: /Create key/ })).toBeDisabled();
  });

  it("tells the user when the key can't be created", async () => {
    const { user, createApiKey, enqueueSnackbar } = setup();
    createApiKey.mockImplementation((_newApiKey, options) => options?.onError?.(new Error("boom"), _newApiKey, undefined));

    await user.type(screen.getByLabelText("Name"), "Local dev");
    await user.click(screen.getByRole("button", { name: "Create key" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't create the API key" }) }), {
      variant: "error"
    });
  });

  it("closes when cancelled", async () => {
    const { user, onClose } = setup();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes from its close button", async () => {
    const { user, onClose } = setup();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  describe("when the key is created", () => {
    it("shows the secret once with a warning that it won't be shown again", () => {
      setup({ createdApiKey: { ...buildApiKey({ name: "CI/CD pipeline" }), apiKey: "ac.sk.mainnet.secret" } });

      expect(screen.getByRole("heading", { name: "“CI/CD pipeline” is ready" })).toBeInTheDocument();
      expect(screen.getByLabelText("API key secret")).toHaveTextContent("ac.sk.mainnet.secret");
      expect(screen.getByText("Copy it now. This is the only time it will be displayed.")).toBeInTheDocument();
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    });

    it("copies the secret from the footer", async () => {
      const { user, enqueueSnackbar, writeText } = setup({ createdApiKey: { ...buildApiKey(), apiKey: "ac.sk.mainnet.secret" } });

      await user.click(screen.getByRole("button", { name: "Copy key" }));

      expect(writeText).toHaveBeenCalledWith("ac.sk.mainnet.secret");
      await vi.waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Key copied to clipboard" }) }), {
          variant: "success",
          autoHideDuration: 1500
        })
      );
    });

    it("copies the secret from the secret field", async () => {
      const { user, writeText } = setup({ createdApiKey: { ...buildApiKey(), apiKey: "ac.sk.mainnet.secret" } });

      await user.click(screen.getByRole("button", { name: "Copy to clipboard" }));

      expect(writeText).toHaveBeenCalledWith("ac.sk.mainnet.secret");
    });

    it("tells the user when the secret can't be copied", async () => {
      const { user, enqueueSnackbar, writeText } = setup({ createdApiKey: { ...buildApiKey(), apiKey: "ac.sk.mainnet.secret" } });
      writeText.mockRejectedValue(new Error("denied"));

      await user.click(screen.getByRole("button", { name: "Copy key" }));

      await vi.waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't copy the key" }) }), {
          variant: "error"
        })
      );
      expect(enqueueSnackbar).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
    });

    it("closes when done", async () => {
      const { user, onClose } = setup({ createdApiKey: { ...buildApiKey(), apiKey: "ac.sk.mainnet.secret" } });

      await user.click(screen.getByRole("button", { name: "Done" }));

      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  function setup(input: { createdApiKey?: ApiKeyResponse; isPending?: boolean } = {}) {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    writeText.mockClear();
    const onClose = vi.fn();
    const createApiKey = vi.fn<ReturnType<typeof DEPENDENCIES.useCreateApiKey>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const analyticsService = mock<AnalyticsService>();

    const useCreateApiKey: typeof DEPENDENCIES.useCreateApiKey = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useCreateApiKey>>(), {
        mutate: createApiKey,
        data: input.createdApiKey,
        isPending: input.isPending ?? false
      });
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>(), { enqueueSnackbar });

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <CreateApiKeyDialog onClose={onClose} dependencies={{ useCreateApiKey, useSnackbar }} />
      </TestContainerProvider>
    );

    return { user, onClose, createApiKey, enqueueSnackbar, analyticsService, writeText };
  }
});
