import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { QuoteRequestSource } from "../gpuQuoteDraft/gpuQuoteCatalog";
import type { DraftAnswers } from "../gpuQuoteDraft/gpuQuoteDraft";
import type { ConfigurationPrefill, DEPENDENCIES } from "./GpuQuoteRequestFlow";
import { GpuQuoteRequestFlow } from "./GpuQuoteRequestFlow";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

const CONFIGURATION: ConfigurationPrefill = {
  hardware: { gpuCount: 1, gpuModels: ["h100"], storageBytes: 2 * 1024 ** 4, regions: ["eu-central"] },
  summary: { summary: "4 vCPU · 1× H100", cpu: 4, memoryBytes: 1, storageBytes: 1, region: "eu-central" }
};

const REQUESTS_KEY = ["v1", "listHardwareRequests"];

describe("GpuQuoteRequestFlow", () => {
  it("sends a package request after changing only the region and term", async () => {
    const { user, createHardwareRequest, enqueueSnackbar, onClose, queryClient, analyticsService } = setup({ source: "reserve_capacity" });

    expect(screen.getByText("Commit to a term for guaranteed GPUs at a lower rate.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Full server/ }));
    await user.click(continueButton());

    expect(question()).toHaveTextContent("Where can they run?");
    await user.click(screen.getByRole("radio", { name: "Only in…" }));
    await user.click(continueButton());
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one region to continue.");

    await user.click(screen.getByRole("button", { name: "Europe" }));
    await user.click(continueButton());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await continueTo(user, "How long, and from when?");
    await user.click(screen.getByRole("radio", { name: "1 year" }));
    await continueTo(user, "Check your request");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createHardwareRequest).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: "quote",
        source: "reserve_capacity",
        email: "jane@example.com",
        configuration: undefined,
        spec: expect.objectContaining({
          gpu: { model: "RTX PRO 6000 Server Edition", count: 8, interconnect: "cluster", fabric: "infiniband" },
          region: { mode: "only", areas: ["eu"] },
          uplinkGbps: null,
          storage: { tbPerNode: 8, nvme: true },
          targetPrice: null,
          term: "12_months"
        })
      })
    });
    expect(snackbarProps(enqueueSnackbar)).toMatchObject({ title: "Request sent", subTitle: "We'll get back to you within one business day." });
    expect(queryClient.getQueryState(REQUESTS_KEY)?.isInvalidated).toBe(true);
    expect(analyticsService.track.mock.calls).toEqual([
      ["gpu_request_form_opened", { category: "deployments", source: "reserve_capacity" }],
      ["gpu_request_sent", { category: "deployments", source: "reserve_capacity", lane: "automated", hardwareRequestId: "request-id" }]
    ]);
  });

  it("sends the configuration being set up in whole nodes, asking only for the network", async () => {
    const { user, createHardwareRequest } = setup({ source: "no_fit", configuration: CONFIGURATION });

    expect(screen.getByText("No provider can host this configuration right now.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Your configuration/ })).toBeChecked();
    await user.click(continueButton());
    expect(question()).toHaveTextContent("Which network between servers?");
    await user.click(continueButton());
    expect(question()).toHaveTextContent("Where can they run?");
    await continueTo(user, "Check your request");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(createHardwareRequest).toHaveBeenCalled());
    expect(createHardwareRequest).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: "no_fit",
        configuration: CONFIGURATION.summary,
        spec: expect.objectContaining({
          gpu: { model: "H100", count: 8, interconnect: "cluster", fabric: "infiniband" },
          region: { mode: "only", areas: ["eu"] },
          storage: { tbPerNode: 2, nvme: true }
        })
      })
    });
  });

  it("sends a custom request for two A100 nodes in Asia Pacific for 6 months", async () => {
    const { user, createHardwareRequest, enqueueSnackbar } = setup({ source: "requests_page", lane: "sales" });

    await user.click(screen.getByRole("radio", { name: /Custom/ }));
    await user.click(continueButton());
    expect(question()).toHaveTextContent("Which GPU, and how many nodes?");
    await user.click(continueButton());
    expect(screen.getByRole("alert")).toHaveTextContent("Add a GPU model to continue.");

    await pickGpu(user, "NVIDIA A100");
    await user.click(screen.getByRole("radio", { name: "2" }));
    await user.click(continueButton());
    expect(question()).toHaveTextContent("Which network between servers?");
    await user.click(screen.getByRole("radio", { name: "RoCE (Ethernet)" }));
    await user.click(continueButton());
    await user.click(screen.getByRole("radio", { name: "Only in…" }));
    await user.click(screen.getByRole("button", { name: "Asia Pacific" }));
    await user.click(continueButton());
    expect(question()).toHaveTextContent("How much storage per node?");
    await continueTo(user, "How long, and from when?");
    expect(screen.queryByRole("radio", { name: "3 months" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "6 months" }));
    await continueTo(user, "Check your request");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
    expect(createHardwareRequest.mock.lastCall?.[0].data.spec).toMatchObject({
      gpu: { model: "A100", count: 16, interconnect: "cluster", fabric: "roce" },
      region: { mode: "only", areas: ["apac"] },
      storage: { tbPerNode: 10, nvme: true },
      term: "6_months"
    });
    expect(snackbarProps(enqueueSnackbar).subTitle).toBe("Our team will reply within 4 business hours.");
  });

  it("asks one question per step of a custom request, in racks for a rack-scale GPU", async () => {
    const { user } = setup({ source: "requests_page" });
    const questions: string[] = [];

    await user.click(screen.getByRole("radio", { name: /Custom/ }));
    questions.push(describeQuestion());
    await user.click(continueButton());
    expect(screen.queryByRole("radiogroup", { name: "Starting point" })).not.toBeInTheDocument();
    await pickGpu(user, "NVIDIA GB300");
    while (!question().textContent?.includes("Check your request")) {
      questions.push(describeQuestion());
      await user.click(continueButton());
    }
    questions.push(describeQuestion());

    expect(questions).toEqual([
      "What are you looking for? Pick a common setup, or choose Custom to set every detail. Step 1 of 9",
      "Which GPU, and how many racks? Step 2 of 9",
      "Which network between servers? Your GPUs are linked across servers over this network. Step 3 of 9",
      "Where can they run? Step 4 of 9",
      "How much storage per rack? Step 5 of 9",
      "What uptime do you need? The SLA sets how much downtime you can accept each month. Higher guarantees narrow the providers we can work with. Step 6 of 9",
      "How long, and from when? Step 7 of 9",
      "How should we reach you? We'll email you at jane@example.com. Add a phone number if you'd also like a call. Step 8 of 9",
      "Check your request Click any section to change it. Step 9 of 9"
    ]);
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it.each([
    ["no_fit", "No provider can host this configuration right now."],
    ["no_bids", "No provider bid on this configuration."],
    ["gpu_menu", "Looking for a GPU that isn't listed?"],
    ["reserve_capacity", "Commit to a term for guaranteed GPUs at a lower rate."],
    ["configure_reserve", "Commit to a term for guaranteed GPUs at a lower rate."]
  ] as const)("explains where a %s request comes from on the first step only", async (source, note) => {
    const { user } = setup({ source });

    expect(screen.getByText(note)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Custom/ }));
    await user.click(continueButton());
    expect(screen.queryByText(note)).not.toBeInTheDocument();
  });

  it("asks to pick a setup before moving on", async () => {
    const { user } = setup({ source: "requests_page" });

    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
    await user.click(continueButton());

    expect(screen.getByRole("alert")).toHaveTextContent("Pick a setup to continue.");
    expect(question()).toHaveTextContent("What are you looking for?");
  });

  it("confirms the request with the time the team promised to reply", async () => {
    const firstReplyDueAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const { user, enqueueSnackbar } = setup({ source: "requests_page", initialAnswers: { gpuModel: "h100" }, firstReplyDueAt });

    await continueTo(user, "Check your request");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" }));
    expect(snackbarProps(enqueueSnackbar).subTitle).toMatch(/^We'll get back to you by \w+day \d{1,2}(:\d{2})? [AP]M\.$/);
  });

  it("prints the request on the review and goes back to a section, then straight back to the review", async () => {
    const { user } = setup({ source: "requests_page" });

    await user.click(screen.getByRole("radio", { name: /Inference fleet/ }));
    await continueTo(user, "Check your request");

    expect(receiptSections()).toEqual([
      "Change SetupInference fleetGPUs2 nodes × 8 NVIDIA B30016 GPUs totalNetworkNVLink + InfiniBandStorage4 TB NVMe per node8 TB total",
      "Change RegionAnywhere",
      "Change SLANo requirement",
      "Change TermMonth to monthStartAs soon as possible",
      "Change Contactjane@example.com"
    ]);

    await user.click(screen.getByRole("button", { name: /^Change SLA/ }));
    expect(question()).toHaveTextContent("What uptime do you need?");
    await user.click(screen.getByRole("radio", { name: /99.5%/ }));
    await user.click(screen.getByRole("button", { name: "Back to review" }));

    expect(question()).toHaveTextContent("Check your request");
    expect(screen.getByRole("button", { name: /^Change SLA/ })).toHaveTextContent("99.5% uptime");
  });

  it("asks the new hardware questions after switching to custom from the review", async () => {
    const { user } = setup({ source: "requests_page" });

    await user.click(screen.getByRole("radio", { name: /Inference fleet/ }));
    await continueTo(user, "Check your request");
    await user.click(screen.getByRole("button", { name: /^Change Setup/ }));
    await user.click(screen.getByRole("radio", { name: /Custom/ }));
    const questions: string[] = [];
    while (!question().textContent?.includes("Check your request")) {
      await user.click(screen.getByRole("button", { name: /^(Continue|Back to review)$/ }));
      questions.push(question().textContent!);
    }

    expect(questions).toEqual(["Which GPU, and how many nodes?", "Which network between servers?", "How much storage per node?", "Check your request"]);
  });

  it("goes back to a question from the server room", async () => {
    const { user } = setup({ source: "requests_page" });

    await user.click(screen.getByRole("radio", { name: /Inference fleet/ }));
    await continueTo(user, "What uptime do you need?");
    await user.click(screen.getByRole("button", { name: "Change Region: Anywhere" }));

    expect(question()).toHaveTextContent("Where can they run?");
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("goes to the first missing answer instead of sending", async () => {
    const { user, createHardwareRequest } = setup({ source: "requests_page" });

    await user.click(screen.getByRole("radio", { name: /Inference fleet/ }));
    await continueTo(user, "Check your request");
    await user.click(screen.getByRole("button", { name: /^Change Region / }));
    await user.click(screen.getByRole("radio", { name: "Only in…" }));
    await user.click(screen.getByRole("button", { name: "Change Uptime: No SLA" }));
    await user.click(screen.getByRole("button", { name: "Back to review" }));
    expect(screen.getByRole("button", { name: /^Change Region / })).toHaveTextContent("Region—");

    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(question()).toHaveTextContent("Where can they run?");
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one region to continue.");
    expect(createHardwareRequest).not.toHaveBeenCalled();
  });

  it("goes back one step", async () => {
    const { user } = setup({ source: "requests_page", initialAnswers: { gpuModel: "h100" } });

    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    await user.click(continueButton());
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(question()).toHaveTextContent("What are you looking for?");
  });

  it("asks for an email when the account has none", async () => {
    const { user } = setup({ source: "gpu_menu", email: undefined, initialAnswers: { gpuModel: "h100" } });

    await continueTo(user, "How should we reach you?");
    expect(screen.getByText("Add the email we should reply to, and a phone number if you'd also like a call.")).toBeInTheDocument();
    await user.click(continueButton());

    expect(screen.getByRole("alert")).toHaveTextContent("Add an email address to continue.");
  });

  it("updates your configuration when it changes while open", async () => {
    const { user, rerender } = setup({ source: "configure_reserve", configuration: CONFIGURATION });

    rerender({ ...CONFIGURATION, hardware: { ...CONFIGURATION.hardware, gpuModels: ["a100"] } });
    await continueTo(user, "Check your request");

    expect(screen.getByRole("button", { name: /^Change Setup/ })).toHaveTextContent("1 node × 8 NVIDIA A100");
  });

  it("shows the limit in the flow when the user has sent too many requests", async () => {
    const message = "You can send up to 3 requests an hour.";
    const { user, onClose, enqueueSnackbar } = setup({
      source: "requests_page",
      initialAnswers: { gpuModel: "h100" },
      response: Promise.reject(new ApiError(429, { code: "hardware_request_limit", message }, "POST /v1/hardware-requests → 429"))
    });

    await continueTo(user, "Check your request");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("reports any other failure in a snackbar and stays open", async () => {
    const { user, onClose, enqueueSnackbar } = setup({
      source: "requests_page",
      initialAnswers: { gpuModel: "h100" },
      response: Promise.reject(new ApiError(500, { message: "Internal server error" }, "POST /v1/hardware-requests → 500"))
    });

    await continueTo(user, "Check your request");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" }));
    expect(snackbarProps(enqueueSnackbar).title).toBe("Couldn't send your request");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("opens as a full page titled with its progress, focused on the question, beside the server room", async () => {
    const { user } = setup({ source: "requests_page" });

    expect(screen.getByRole("dialog", { name: "Request GPUs" })).toHaveAccessibleDescription("Step 1 of 9");
    expect(screen.getByRole("complementary", { name: "Your server room" })).toHaveTextContent("Empty rack");
    expect(question()).toHaveFocus();
    expect(screen.getByText("Press")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Inference fleet/ }));
    await user.click(continueButton());

    expect(screen.getByRole("progressbar", { name: "Request progress" })).toHaveAttribute("aria-valuenow", String((2 / 6) * 100));
    expect(question()).toHaveFocus();
  });

  it("continues on Enter from the question and from a picked package", async () => {
    const { user } = setup({ source: "requests_page", initialAnswers: { gpuModel: "h100" } });

    await user.keyboard("{Enter}");
    expect(question()).toHaveTextContent("Which GPU, and how many nodes?");

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("radio", { name: /Inference fleet/ }));
    await user.keyboard("{Enter}");

    expect(question()).toHaveTextContent("Where can they run?");
  });

  it("leaves Enter to the GPU search, buttons, notes and text being composed, and ignores other keys", async () => {
    const { user } = setup({ source: "requests_page", initialAnswers: { gpuModel: "h100" } });

    await user.keyboard("x");
    expect(question()).toHaveTextContent("What are you looking for?");
    fireEvent.keyDown(question(), { key: "Enter", isComposing: true });
    expect(question()).toHaveTextContent("What are you looking for?");

    await user.click(screen.getByRole("radio", { name: /Custom/ }));
    await user.click(continueButton());
    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.type(screen.getByPlaceholderText("Search GPUs…"), "h200{Enter}");
    expect(question()).toHaveTextContent("Which GPU, and how many nodes?");
    expect(screen.getByRole("combobox", { name: "GPU model" })).toHaveTextContent("NVIDIA H200");

    screen.getByRole("button", { name: "Back" }).focus();
    await user.keyboard("{Enter}");
    expect(question()).toHaveTextContent("What are you looking for?");

    await continueTo(user, "How should we reach you?");
    await user.click(screen.getByRole("textbox", { name: /Anything else we should know/ }));
    await user.keyboard("{Enter}");
    expect(question()).toHaveTextContent("How should we reach you?");
  });

  it("sends once on Enter from the review while the request is on its way", async () => {
    const { user, createHardwareRequest } = setup({ source: "requests_page", initialAnswers: { gpuModel: "h100" }, response: new Promise(() => undefined) });

    await continueTo(user, "Check your request");
    expect(screen.queryByText("Press")).not.toBeInTheDocument();
    question().focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");

    expect(createHardwareRequest).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape without sending", async () => {
    const { user, onClose, createHardwareRequest } = setup({ source: "requests_page" });

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
    expect(createHardwareRequest).not.toHaveBeenCalled();
  });

  it("closes without sending", async () => {
    const { user, onClose, createHardwareRequest } = setup({ source: "requests_page" });

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
    expect(createHardwareRequest).not.toHaveBeenCalled();
  });

  async function pickGpu(user: ReturnType<typeof userEvent.setup>, name: string) {
    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(screen.getByRole("option", { name: new RegExp(`^${name}`) }));
  }

  function receiptSections() {
    return screen.getAllByRole("button", { name: /^Change [A-Za-z]+ / }).map(section => section.textContent);
  }

  function continueButton() {
    return screen.getByRole("button", { name: "Continue" });
  }

  function describeQuestion() {
    const hint = question().nextElementSibling?.textContent;
    return [question().textContent, hint, screen.getByText(/^Step \d+ of \d+$/).textContent].filter(Boolean).join(" ");
  }

  function question() {
    return screen.getByRole("heading", { level: 3 });
  }

  async function continueTo(user: ReturnType<typeof userEvent.setup>, title: string) {
    if (screen.queryAllByRole("radio", { checked: true }).length === 0 && question().textContent?.includes("What are you looking for?")) {
      await user.click(screen.getByRole("radio", { name: /Custom/ }));
    }
    while (!question().textContent?.includes(title)) {
      await user.click(continueButton());
    }
  }

  function snackbarProps(enqueueSnackbar: ReturnType<typeof vi.fn>) {
    return enqueueSnackbar.mock.lastCall?.[0].props;
  }

  function setup(input: {
    source: QuoteRequestSource;
    configuration?: ConfigurationPrefill;
    initialAnswers?: DraftAnswers;
    email?: string;
    lane?: "sales" | "automated";
    firstReplyDueAt?: string;
    response?: Promise<unknown>;
  }) {
    const response =
      input.response ??
      Promise.resolve({
        data: { id: "request-id", createdAt: "2026-11-04T12:00:00.000Z", lane: input.lane ?? "automated", firstReplyDueAt: input.firstReplyDueAt ?? null }
      });
    response.catch(() => undefined);
    const createHardwareRequest = vi.fn((_: { data: { spec: object } }) => response);
    const queryClient = new QueryClient();
    queryClient.setQueryData(REQUESTS_KEY, { data: [] });
    const api = createProxy({ v1: { createHardwareRequest, listHardwareRequests: vi.fn() } }) as unknown as AppDIContainer["api"];
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const email = "email" in input ? input.email : "jane@example.com";
    const dependencies: typeof DEPENDENCIES = {
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: email ? { email } : undefined }),
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() })
    };
    const renderFlow = (configuration?: ConfigurationPrefill) => (
      <TestContainerProvider services={{ api: () => api, queryClient: () => queryClient, analyticsService: () => analyticsService }}>
        <GpuQuoteRequestFlow
          source={input.source}
          configuration={configuration}
          initialAnswers={input.initialAnswers}
          onClose={onClose}
          dependencies={dependencies}
        />
      </TestContainerProvider>
    );
    const view = render(renderFlow(input.configuration));

    return {
      user: userEvent.setup(),
      createHardwareRequest,
      enqueueSnackbar,
      onClose,
      queryClient,
      analyticsService,
      rerender: (configuration: ConfigurationPrefill) => view.rerender(renderFlow(configuration))
    };
  }
});
