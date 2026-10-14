import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { QueryClient } from "@tanstack/react-query";
import type { AxiosResponse } from "axios";
import { AxiosError } from "axios";
import { differenceInCalendarDays } from "date-fns";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ALL_PROJECTS_LABEL } from "@src/components/api-keys/ApiKeyList/ApiKeyList";
import type { NewApiKey } from "@src/queries/useApiKeysQuery";
import { PROJECTS_QUERY_KEY } from "@src/queries/useProjectsQuery";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { ProjectOutput } from "@src/types/project";
import type { DEPENDENCIES } from "./CreateApiKeyDialog";
import { CreateApiKeyDialog, PROJECT_NOT_FOUND_MESSAGE } from "./CreateApiKeyDialog";

import { render, screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import userEvent from "@testing-library/user-event";
import { buildApiKey, buildProject } from "@tests/seeders";
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

  it("offers preset expiries of at most one year and a custom date", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("combobox", { name: /Expiration/ }));

    const options = await screen.findAllByRole("option");
    expect(options.map(option => option.textContent)).toEqual(["30 days", "90 days", "1 year", "Custom date"]);
  });

  it("shows the date picker only for a custom expiry", async () => {
    const { user } = setup();

    expect(screen.queryByLabelText("Expiration date")).not.toBeInTheDocument();

    await pickCustomExpiry(user);

    expect(screen.getByLabelText("Expiration date")).toBeInTheDocument();
  });

  it("creates a key that expires tomorrow when the custom date is left as is", async () => {
    const { user, createApiKey } = setup({ now: new Date(2026, 9, 9, 12) });

    await user.type(screen.getByLabelText("Name"), "One day");
    await pickCustomExpiry(user);

    expect(screen.getByLabelText("Expiration date")).toHaveTextContent("Oct 10, 2026");

    await user.click(screen.getByRole("button", { name: "Create key" }));

    const [newApiKey] = createApiKey.mock.lastCall as [NewApiKey];
    expect(newApiKey.expiresAt).toEqual(new Date(2026, 9, 10, 12));
  });

  it("still creates a key one day out when the dialog stays open past midnight", async () => {
    const { user, createApiKey } = setup({ now: new Date(2026, 9, 9, 23, 50) });

    await user.type(screen.getByLabelText("Name"), "Overnight");
    await pickCustomExpiry(user);
    vi.setSystemTime(new Date(2026, 9, 10, 0, 5));
    await user.click(screen.getByRole("button", { name: "Create key" }));

    const [newApiKey] = createApiKey.mock.lastCall as [NewApiKey];
    expect(newApiKey.expiresAt).toEqual(new Date(2026, 9, 11, 0, 5));
  });

  it("creates a key that expires on the custom date the user picks", async () => {
    const { user, createApiKey } = setup({ now: new Date(2026, 9, 9, 12) });

    await user.type(screen.getByLabelText("Name"), "One week");
    await pickCustomExpiry(user);
    await user.click(screen.getByLabelText("Expiration date"));
    await user.click(await screen.findByRole("button", { name: /October 16th, 2026/ }));

    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Expiration date")).toHaveTextContent("Oct 16, 2026");

    await user.click(screen.getByRole("button", { name: "Create key" }));

    const [newApiKey] = createApiKey.mock.lastCall as [NewApiKey];
    expect(newApiKey.expiresAt).toEqual(new Date(2026, 9, 16, 12));
  });

  it("limits the custom date to between tomorrow and one year out", async () => {
    const { user } = setup({ now: new Date(2026, 9, 9, 12) });

    await pickCustomExpiry(user);
    await user.click(screen.getByLabelText("Expiration date"));

    expect(await screen.findByRole("button", { name: /October 9th, 2026/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /October 10th, 2026/ })).toBeEnabled();

    for (let month = 0; month < 12; month++) {
      await user.click(screen.getByRole("button", { name: "Go to the Next Month" }));
    }

    expect(screen.getByRole("button", { name: /October 9th, 2027/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /October 10th, 2027/ })).toBeDisabled();
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

  it("stays open while the key is being created", async () => {
    const { user, onClose } = setup({ isPending: true });

    await user.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
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

  it("closes when dismissed with Escape", async () => {
    const { user, onClose } = setup();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("offers no project choice when no projects are given", () => {
    setup();

    expect(screen.queryByRole("combobox", { name: /Project/ })).not.toBeInTheDocument();
  });

  it("offers no project choice when the organization has no project the user can reach", () => {
    setup({ projects: [] });

    expect(screen.queryByRole("combobox", { name: /Project/ })).not.toBeInTheDocument();
  });

  describe("when projects are given", () => {
    it("offers every project after all projects, the default", async () => {
      const { user } = setup({ projects: [buildProject({ name: "default" }), buildProject({ name: "storefront" })] });

      expect(screen.getByRole("combobox", { name: /Project/ })).toHaveTextContent(ALL_PROJECTS_LABEL);
      await user.click(screen.getByRole("combobox", { name: /Project/ }));

      const options = await screen.findAllByRole("option");
      expect(options.map(option => option.textContent)).toEqual([ALL_PROJECTS_LABEL, "default", "storefront"]);
    });

    it("creates a key for all projects without naming a project", async () => {
      const { user, createApiKey } = setup({ projects: [buildProject({ name: "storefront" })] });

      await user.type(screen.getByLabelText("Name"), "Local dev");
      await user.click(screen.getByRole("button", { name: "Create key" }));

      const [newApiKey] = createApiKey.mock.lastCall as [NewApiKey];
      expect(newApiKey).not.toHaveProperty("projectId");
    });

    it("creates a key limited to the project the user picks", async () => {
      const storefront = buildProject({ name: "storefront" });
      const { user, createApiKey } = setup({ projects: [buildProject({ name: "default" }), storefront] });

      await user.type(screen.getByLabelText("Name"), "Deploy bot");
      await pickProject(user, "storefront");
      await user.click(screen.getByRole("button", { name: "Create key" }));

      const [newApiKey] = createApiKey.mock.lastCall as [NewApiKey];
      expect(newApiKey).toEqual(expect.objectContaining({ name: "Deploy bot", projectId: storefront.id }));
    });

    it("asks for another project when the picked one is gone", async () => {
      const { user, createApiKey, enqueueSnackbar } = setup({ projects: [buildProject({ name: "storefront" })] });
      createApiKey.mockImplementation((newApiKey, options) => options?.onError?.(buildHttpError(404), newApiKey, undefined));

      await user.type(screen.getByLabelText("Name"), "Deploy bot");
      await pickProject(user, "storefront");
      await user.click(screen.getByRole("button", { name: "Create key" }));

      expect(await screen.findByText(PROJECT_NOT_FOUND_MESSAGE)).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: /Project/ })).toHaveFocus();
      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it("reloads the projects when the picked one is gone", async () => {
      const { user, createApiKey, queryClient } = setup({ projects: [buildProject({ name: "storefront" })] });
      queryClient.setQueryData(PROJECTS_QUERY_KEY, { data: [] });
      createApiKey.mockImplementation((newApiKey, options) => options?.onError?.(buildHttpError(404), newApiKey, undefined));

      await user.type(screen.getByLabelText("Name"), "Deploy bot");
      await pickProject(user, "storefront");
      await user.click(screen.getByRole("button", { name: "Create key" }));

      expect(queryClient.getQueryState(PROJECTS_QUERY_KEY)?.isInvalidated).toBe(true);
    });

    it("keeps the projects when another error stops a key for a project", async () => {
      const { user, createApiKey, queryClient } = setup({ projects: [buildProject({ name: "storefront" })] });
      queryClient.setQueryData(PROJECTS_QUERY_KEY, { data: [] });
      createApiKey.mockImplementation((newApiKey, options) => options?.onError?.(buildHttpError(500), newApiKey, undefined));

      await user.type(screen.getByLabelText("Name"), "Deploy bot");
      await pickProject(user, "storefront");
      await user.click(screen.getByRole("button", { name: "Create key" }));

      expect(queryClient.getQueryState(PROJECTS_QUERY_KEY)?.isInvalidated).toBe(false);
    });

    it("says a key for a project only works on that project", async () => {
      const { user } = setup({ projects: [buildProject({ name: "storefront" })] });

      await pickProject(user, "storefront");

      expect(screen.getByText(/This key only works on the/)).toHaveTextContent("This key only works on the storefront project. Treat it like a password.");
      expect(screen.queryByText(/to your Console account, including deployments, leases and billing/)).not.toBeInTheDocument();
    });

    it("warns about full access again when all projects is picked back", async () => {
      const { user } = setup({ projects: [buildProject({ name: "storefront" })] });

      await pickProject(user, "storefront");
      await pickProject(user, ALL_PROJECTS_LABEL);

      expect(screen.getByText(/to your Console account, including deployments, leases and billing/)).toBeInTheDocument();
      expect(screen.queryByText(/This key only works on the/)).not.toBeInTheDocument();
    });

    it("clears the project error once another project is picked", async () => {
      const { user, createApiKey } = setup({ projects: [buildProject({ name: "storefront" }), buildProject({ name: "checkout" })] });
      createApiKey.mockImplementation((newApiKey, options) => options?.onError?.(buildHttpError(404), newApiKey, undefined));

      await user.type(screen.getByLabelText("Name"), "Deploy bot");
      await pickProject(user, "storefront");
      await user.click(screen.getByRole("button", { name: "Create key" }));
      await screen.findByText(PROJECT_NOT_FOUND_MESSAGE);
      await pickProject(user, "checkout");

      await vi.waitFor(() => expect(screen.queryByText(PROJECT_NOT_FOUND_MESSAGE)).not.toBeInTheDocument());
    });

    it("tells the user the key can't be created when a key for all projects is not found", async () => {
      const { user, createApiKey, enqueueSnackbar } = setup({ projects: [buildProject({ name: "storefront" })] });
      createApiKey.mockImplementation((newApiKey, options) => options?.onError?.(buildHttpError(404), newApiKey, undefined));

      await user.type(screen.getByLabelText("Name"), "Local dev");
      await user.click(screen.getByRole("button", { name: "Create key" }));

      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't create the API key" }) }), {
        variant: "error"
      });
      expect(screen.queryByText(PROJECT_NOT_FOUND_MESSAGE)).not.toBeInTheDocument();
    });

    it("tells the user the key can't be created when a key for a project fails otherwise", async () => {
      const { user, createApiKey, enqueueSnackbar } = setup({ projects: [buildProject({ name: "storefront" })] });
      createApiKey.mockImplementation((newApiKey, options) => options?.onError?.(buildHttpError(500), newApiKey, undefined));

      await user.type(screen.getByLabelText("Name"), "Deploy bot");
      await pickProject(user, "storefront");
      await user.click(screen.getByRole("button", { name: "Create key" }));

      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't create the API key" }) }), {
        variant: "error"
      });
      expect(screen.queryByText(PROJECT_NOT_FOUND_MESSAGE)).not.toBeInTheDocument();
    });

    it("tells the user the key can't be created when a key for a project fails without a response", async () => {
      const { user, createApiKey, enqueueSnackbar } = setup({ projects: [buildProject({ name: "storefront" })] });
      createApiKey.mockImplementation((newApiKey, options) => options?.onError?.(new AxiosError("Network Error", "ERR_NETWORK"), newApiKey, undefined));

      await user.type(screen.getByLabelText("Name"), "Deploy bot");
      await pickProject(user, "storefront");
      await user.click(screen.getByRole("button", { name: "Create key" }));

      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't create the API key" }) }), {
        variant: "error"
      });
    });

    async function pickProject(user: ReturnType<typeof userEvent.setup>, name: string) {
      await user.click(screen.getByRole("combobox", { name: /Project/ }));
      await user.click(await screen.findByRole("option", { name }));
    }

    function buildHttpError(status: number) {
      return new AxiosError("Request failed", String(status), undefined, undefined, mock<AxiosResponse>({ status }));
    }
  });

  describe("when the key is created", () => {
    it("shows the secret once with a warning that it won't be shown again", () => {
      setup({ createdApiKey: { ...buildApiKey({ name: "CI/CD pipeline" }), apiKey: "ac.sk.mainnet.secret" } });

      expect(screen.getByRole("heading", { name: "“CI/CD pipeline” is ready" })).toBeInTheDocument();
      expect(screen.getByLabelText("API key secret")).toHaveTextContent("ac.sk.mainnet.secret");
      expect(screen.getByText("Copy it now. This is the only time it will be displayed.")).toBeInTheDocument();
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    });

    it("masks the secret in session replays", () => {
      setup({ createdApiKey: { ...buildApiKey(), apiKey: "ac.sk.mainnet.secret" } });

      expect(screen.getByLabelText("API key secret")).toHaveClass("amp-mask");
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

    it("stays open until the user is done", async () => {
      const { user, onClose } = setup({ createdApiKey: { ...buildApiKey(), apiKey: "ac.sk.mainnet.secret" } });

      await user.keyboard("{Escape}");

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    });
  });

  async function pickCustomExpiry(user: UserEvent) {
    await user.click(screen.getByRole("combobox", { name: /Expiration/ }));
    await user.click(await screen.findByRole("option", { name: "Custom date" }));
  }

  function setup(input: { createdApiKey?: ApiKeyResponse; isPending?: boolean; now?: Date; projects?: ProjectOutput[] } = {}) {
    if (input.now) {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(input.now);
      onTestFinished(() => {
        vi.useRealTimers();
      });
    }
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    writeText.mockClear();
    const onClose = vi.fn();
    const createApiKey = vi.fn<ReturnType<typeof DEPENDENCIES.useCreateApiKey>["mutate"]>();
    const enqueueSnackbar = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const queryClient = new QueryClient();

    const useCreateApiKey: typeof DEPENDENCIES.useCreateApiKey = () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useCreateApiKey>>(), {
        mutate: createApiKey,
        data: input.createdApiKey,
        isPending: input.isPending ?? false
      });
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>(), { enqueueSnackbar });

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService, queryClient: () => queryClient }}>
        <CreateApiKeyDialog onClose={onClose} projects={input.projects} dependencies={{ useCreateApiKey, useSnackbar }} />
      </TestContainerProvider>
    );

    return { user, onClose, createApiKey, enqueueSnackbar, analyticsService, writeText, queryClient };
  }
});
