import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { AgentModePanel } from "./AgentModePanel";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(AgentModePanel.name, () => {
  it("renders the header but keeps the setup steps collapsed by default", () => {
    setup();

    expect(screen.getByRole("heading", { name: "Deploy with your agent" })).toBeInTheDocument();
    expect(screen.queryByText("Install the Akash skill")).not.toBeInTheDocument();
  });

  it("reveals the setup steps and tracks the click when Set up with your agent is clicked", async () => {
    const { analyticsService } = setup();

    await userEvent.click(screen.getByRole("button", { name: /Set up with your agent/ }));

    expect(analyticsService.track).toHaveBeenCalledWith("deploy_with_agent_btn_clk", "Amplitude");
    expect(screen.getByText("Install the Akash skill")).toBeInTheDocument();
    expect(screen.getByText("npx skills add akash-network/akash-skill --skill akash")).toBeInTheDocument();
  });

  it("tracks opening the steps but not closing them", async () => {
    const { analyticsService } = setup();

    await userEvent.click(screen.getByRole("button", { name: /Set up with your agent/ }));
    await userEvent.click(screen.getByRole("button", { name: /Set up with your agent/ }));

    expect(analyticsService.track).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Install the Akash skill")).not.toBeInTheDocument();
  });

  it("copies the install command", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    setup();

    await user.click(screen.getByRole("button", { name: /Set up with your agent/ }));
    await user.click(screen.getByRole("button", { name: "Copy command" }));

    expect(writeText).toHaveBeenCalledWith("npx skills add akash-network/akash-skill --skill akash");
  });

  it("links Create an API key to the in-app API keys page", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: /Set up with your agent/ }));

    expect(screen.getByRole("link", { name: /Go to API keys/ })).toHaveAttribute("href", "/user/api-keys");
  });

  it("opens the setup guide docs in a new tab", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: /Set up with your agent/ }));

    const setupGuide = screen.getByRole("link", { name: /Setup guide/ });
    expect(setupGuide).toHaveAttribute("href", "https://akash.network/docs/getting-started/ai-agents/");
    expect(setupGuide).toHaveAttribute("target", "_blank");
  });

  function setup() {
    const analyticsService = mock<AnalyticsService>();

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <AgentModePanel />
      </TestContainerProvider>
    );

    return { analyticsService };
  }
});
