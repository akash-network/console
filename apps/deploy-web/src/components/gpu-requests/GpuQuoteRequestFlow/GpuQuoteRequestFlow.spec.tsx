import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { QuoteRequestSource } from "../gpuQuoteDraft/gpuQuoteCatalog";
import type { DraftAnswers } from "../gpuQuoteDraft/gpuQuoteDraft";
import type { ConfigurationPrefill, DEPENDENCIES } from "./GpuQuoteRequestFlow";
import { GpuQuoteRequestFlow } from "./GpuQuoteRequestFlow";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

const CONFIGURATION: ConfigurationPrefill = {
  hardware: { gpuCount: 1, gpuModels: ["h100"], storageBytes: 2 * 1024 ** 4, regions: ["eu-central"] },
  summary: { summary: "4 vCPU · 1× H100", cpu: 4, memoryBytes: 1, storageBytes: 1, region: "eu-central" }
};

const REQUESTS_KEY = ["v1", "listHardwareRequests"];

describe("GpuQuoteRequestFlow", () => {
  it("sends a package request after changing only the region and term", async () => {
    const { user, createHardwareRequest, enqueueSnackbar, onClose, queryClient } = setup({ source: "reserve_capacity" });

    expect(screen.getByText("Reserve GPUs for a term.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Full server/ }));
    await user.click(continueButton());

    expect(question()).toHaveTextContent("Where can they run?");
    expect(screen.queryByRole("group", { name: "Internet speed" })).not.toBeInTheDocument();
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
          gpu: { model: "H200", count: 8, interconnect: "server" },
          region: { mode: "only", areas: ["eu"] },
          uplinkGbps: 10,
          storage: { tbPerNode: 8, nvme: true },
          term: "12_months"
        })
      })
    });
    expect(snackbarProps(enqueueSnackbar)).toMatchObject({ title: "Request sent", subTitle: "We'll get back to you within one business day." });
    expect(queryClient.getQueryState(REQUESTS_KEY)?.isInvalidated).toBe(true);
  });

  it("sends the configuration being set up without asking hardware questions", async () => {
    const { user, createHardwareRequest } = setup({ source: "no_fit", configuration: CONFIGURATION });

    expect(screen.getByText("No provider can host this configuration right now.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Your configuration/ })).toBeChecked();
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
          gpu: { model: "H100", count: 1, interconnect: "none" },
          region: { mode: "only", areas: ["eu"] },
          storage: { tbPerNode: 2, nvme: true }
        })
      })
    });
  });

  it("sends a custom request for a single A100 in Asia Pacific for 3 months", async () => {
    const { user, createHardwareRequest, enqueueSnackbar } = setup({ source: "requests_page", lane: "sales" });

    await user.click(continueButton());
    expect(question()).toHaveTextContent("Which GPU, and how many?");
    await user.click(continueButton());
    expect(screen.getByRole("alert")).toHaveTextContent("Add a GPU model to continue.");

    await user.click(screen.getByRole("radio", { name: "A100 80 GB" }));
    await user.click(continueButton());
    expect(question()).toHaveTextContent("Where can they run?");
    await user.click(screen.getByRole("radio", { name: "Only in…" }));
    await user.click(screen.getByRole("button", { name: "Asia Pacific" }));
    await user.click(continueButton());
    expect(question()).toHaveTextContent("How much storage?");
    await continueTo(user, "How long, and from when?");
    await user.click(screen.getByRole("radio", { name: "3 months" }));
    await continueTo(user, "Check your request");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
    expect(createHardwareRequest.mock.lastCall?.[0].data.spec).toMatchObject({
      gpu: { model: "A100", count: 1, interconnect: "none" },
      region: { mode: "only", areas: ["apac"] },
      term: "3_months"
    });
    expect(snackbarProps(enqueueSnackbar).subTitle).toBe("Our team will reply within 4 business hours.");
  });

  it("asks how whole servers connect", async () => {
    const { user } = setup({ source: "requests_page" });

    await user.click(continueButton());
    await user.click(screen.getByRole("radio", { name: "B200 180 GB" }));
    await user.click(screen.getByRole("radio", { name: "Whole servers of 8" }));
    await user.click(continueButton());

    expect(question()).toHaveTextContent("Do the GPUs need to work together?");
    expect(screen.getByText("Step 3 of 11")).toBeInTheDocument();
  });

  it("asks one question per step of a custom request for whole servers", async () => {
    const { user } = setup({ source: "requests_page" });
    const questions: string[] = [];

    await user.click(screen.getByRole("radio", { name: /Custom/ }));
    questions.push(describeQuestion());
    await user.click(continueButton());
    expect(screen.queryByRole("radiogroup", { name: "Starting point" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "H200 141 GB" }));
    await user.click(screen.getByRole("radio", { name: "Whole servers of 8" }));
    while (!question().textContent?.includes("Check your request")) {
      questions.push(describeQuestion());
      await user.click(continueButton());
    }
    questions.push(describeQuestion());

    expect(questions).toEqual([
      "What are you looking for? Pick a common setup, or Custom to choose every detail. Step 1 of 10",
      "Which GPU, and how many? Step 2 of 11",
      "Do the GPUs need to work together? This decides how GPUs connect inside a server and between servers. Step 3 of 11",
      "Where can they run? Step 4 of 11",
      "How much storage? Step 5 of 11",
      "What uptime do you need? Higher guarantees narrow the providers we can work with. Step 6 of 11",
      "What would you like to pay? Your target price per GPU-hour. Step 7 of 11",
      "How long, and from when? Step 8 of 11",
      "Anything else? Both are optional. Step 9 of 11",
      "How should we reach you? Step 10 of 11",
      "Check your request Select a line to change it. Step 11 of 11"
    ]);
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it.each([
    ["no_fit", "No provider can host this configuration right now."],
    ["no_bids", "No provider bid on this configuration."],
    ["gpu_menu", "Looking for a GPU that isn't listed?"],
    ["reserve_capacity", "Reserve GPUs for a term."],
    ["configure_reserve", "Reserve GPUs for a term."]
  ] as const)("explains where a %s request comes from on the first step only", async (source, note) => {
    const { user } = setup({ source });

    expect(screen.getByText(note)).toBeInTheDocument();
    await user.click(continueButton());
    expect(screen.queryByText(note)).not.toBeInTheDocument();
  });

  it("starts from Custom when nothing was picked", async () => {
    const { user } = setup({ source: "requests_page" });

    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
    await user.click(continueButton());
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByRole("radio", { name: /Custom/ })).toBeChecked();
  });

  it("reads an unknown lane as the automated one", async () => {
    const { user, enqueueSnackbar } = setup({ source: "requests_page", initialAnswers: { gpuModel: "h100" }, lane: "priority" });

    await continueTo(user, "Check your request");
    await user.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" }));
    expect(snackbarProps(enqueueSnackbar).subTitle).toBe("We'll get back to you within one business day.");
  });

  it("shows every answer on the review step and jumps back to its question", async () => {
    const { user } = setup({ source: "requests_page", initialAnswers: { gpuModel: "rtx5090", gpuCount: 2 } });

    await continueTo(user, "Check your request");
    const lines = within(screen.getByRole("list")).getAllByRole("button");

    expect(lines.map(line => line.textContent)).toEqual([
      "GPUs2× RTX 5090",
      "RegionAnywhere",
      "InternetNo preference",
      "Storage1 TB NVMe",
      "UptimeNo requirement",
      "Target priceOpen to offers",
      "TermMonth to month",
      "StartAs soon as possible",
      "AlsoNothing else",
      "Contactjane@example.com"
    ]);

    await user.click(screen.getByRole("button", { name: /^Uptime/ }));
    expect(question()).toHaveTextContent("What uptime do you need?");
  });

  it("goes back to the starting point to change an answer the package gave", async () => {
    const { user } = setup({ source: "requests_page" });

    await user.click(screen.getByRole("radio", { name: /Inference fleet/ }));
    await continueTo(user, "Check your request");
    await user.click(screen.getByRole("button", { name: /^GPUs/ }));

    expect(question()).toHaveTextContent("What are you looking for?");
  });

  it("goes back one step", async () => {
    const { user } = setup({ source: "requests_page" });

    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    await user.click(continueButton());
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(question()).toHaveTextContent("What are you looking for?");
  });

  it("asks for an email when the account has none", async () => {
    const { user } = setup({ source: "gpu_menu", email: undefined, initialAnswers: { gpuModel: "h100" } });

    await continueTo(user, "How should we reach you?");
    await user.click(continueButton());

    expect(screen.getByRole("alert")).toHaveTextContent("Add an email address to continue.");
  });

  it("updates your configuration when it changes while open", async () => {
    const { user, rerender } = setup({ source: "configure_reserve", configuration: CONFIGURATION });

    rerender({ ...CONFIGURATION, hardware: { ...CONFIGURATION.hardware, gpuModels: ["a100"] } });
    await continueTo(user, "Check your request");

    expect(screen.getByRole("button", { name: /^GPUs/ })).toHaveTextContent("1× A100");
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

  it("closes without sending", async () => {
    const { user, onClose, createHardwareRequest } = setup({ source: "requests_page" });

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
    expect(createHardwareRequest).not.toHaveBeenCalled();
  });

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
    lane?: string;
    response?: Promise<unknown>;
  }) {
    const response =
      input.response ?? Promise.resolve({ data: { id: "request-id", createdAt: "2026-11-04T12:00:00.000Z", ...(input.lane ? { lane: input.lane } : {}) } });
    response.catch(() => undefined);
    const createHardwareRequest = vi.fn((_: { data: { spec: object } }) => response);
    const queryClient = new QueryClient();
    queryClient.setQueryData(REQUESTS_KEY, { data: [] });
    const api = createProxy({ v1: { createHardwareRequest, listHardwareRequests: vi.fn() } }) as unknown as AppDIContainer["api"];
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();
    const email = "email" in input ? input.email : "jane@example.com";
    const dependencies: typeof DEPENDENCIES = {
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: email ? { email } : undefined }),
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() })
    };
    const renderFlow = (configuration?: ConfigurationPrefill) => (
      <TestContainerProvider services={{ api: () => api, queryClient: () => queryClient }}>
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
      rerender: (configuration: ConfigurationPrefill) => view.rerender(renderFlow(configuration))
    };
  }
});
