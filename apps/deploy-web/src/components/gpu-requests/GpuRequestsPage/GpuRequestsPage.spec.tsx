import type { PropsWithChildren, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { HardwareRequest } from "../gpuRequestStatus/gpuRequestStatus";
import { DEPENDENCIES, GpuRequestsPage } from "./GpuRequestsPage";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildHardwareRequest } from "@tests/seeders/hardwareRequest";
import { MockComponents } from "@tests/unit/mocks";

describe(GpuRequestsPage.name, () => {
  it("lists the organization's requests, newest first", () => {
    const older = buildHardwareRequest({ createdAt: "2026-10-01T00:00:00.000Z" });
    const newer = buildHardwareRequest({ createdAt: "2026-11-01T00:00:00.000Z" });
    const { GpuRequestCard, SettingsLayout } = setup({ requests: [older, newer] });

    expect(GpuRequestCard.mock.calls.map(([props]) => props.request)).toEqual([newer, older]);
    expect(SettingsLayout).toHaveBeenCalledWith(
      expect.objectContaining({ title: "GPU requests", description: "Hardware your organization asked us to source, and where each request stands." }),
      expect.anything()
    );
  });

  it("opens a new request from the header", async () => {
    const { GpuQuoteRequestFlow } = setup({ requests: [buildHardwareRequest()] });

    await userEvent.click(screen.getByRole("button", { name: "New request" }));

    expect(GpuQuoteRequestFlow).toHaveBeenLastCalledWith(expect.objectContaining({ source: "requests_page" }), expect.anything());
    act(() => GpuQuoteRequestFlow.mock.lastCall![0].onClose());
    expect(screen.queryByText("GPU quote request")).not.toBeInTheDocument();
  });

  it("offers a new request when there are none yet", async () => {
    const { GpuQuoteRequestFlow, GpuRequestCard } = setup({ requests: [] });

    expect(screen.getByRole("heading", { name: "No GPU requests yet" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New request" })).toHaveLength(1);
    expect(GpuRequestCard).not.toHaveBeenCalled();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "New request" }));

    expect(screen.getByText("GPU quote request")).toBeInTheDocument();
    expect(GpuQuoteRequestFlow).toHaveBeenCalled();
  });

  it("shows that the requests are loading", () => {
    setup({ isLoading: true });

    expect(screen.getByText("Loading your requests…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "No GPU requests yet" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New request" })).not.toBeInTheDocument();
  });

  it("says when the requests could not be loaded", () => {
    setup({ isError: true });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load your requests. Try again in a moment.");
    expect(screen.queryByText("Loading your requests…")).not.toBeInTheDocument();
  });

  function setup(input: { requests?: HardwareRequest[]; isLoading?: boolean; isError?: boolean }) {
    const GpuRequestCard = vi.fn<typeof DEPENDENCIES.GpuRequestCard>(() => null);
    const GpuQuoteRequestFlow = vi.fn<typeof DEPENDENCIES.GpuQuoteRequestFlow>(() => <div>GPU quote request</div>);
    const SettingsLayout = vi.fn(({ headerActions, children }: PropsWithChildren<{ headerActions?: ReactNode }>) => (
      <div>
        {headerActions}
        {children}
      </div>
    ));
    const dependencies = MockComponents(DEPENDENCIES, {
      Layout: (({ children }: PropsWithChildren) => <div>{children}</div>) as never,
      SettingsLayout: SettingsLayout as never,
      GpuRequestCard,
      GpuQuoteRequestFlow,
      useHardwareRequestsQuery: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useHardwareRequestsQuery>>(), {
          data: input.requests,
          isLoading: input.isLoading ?? false,
          isError: input.isError ?? false
        })
    });

    render(<GpuRequestsPage dependencies={dependencies} />);

    return { GpuRequestCard, GpuQuoteRequestFlow, SettingsLayout };
  }
});
