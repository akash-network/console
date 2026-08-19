import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDto } from "@src/types/deployment";
import { DEPENDENCIES, DeploymentNotificationsSection } from "./DeploymentNotificationsSection";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("DeploymentNotificationsSection", () => {
  it("renders the alerts form when notifications are enabled", () => {
    setup({ isEnabled: true });

    expect(screen.getByText("alerts")).toBeInTheDocument();
  });

  it("shows a sign-in note when notifications are disabled", () => {
    setup({ isEnabled: false });

    expect(screen.getByText(/sign in to configure notifications/i)).toBeInTheDocument();
    expect(screen.queryByText("alerts")).not.toBeInTheDocument();
  });

  function setup(input: { isEnabled: boolean }) {
    const DeploymentAlerts = vi.fn(() => <div>alerts</div>);
    const deployment = mock<DeploymentDto>({ dseq: "1786440078202", state: "active" });

    render(
      <DeploymentNotificationsSection deployment={deployment} isEnabled={input.isEnabled} dependencies={MockComponents(DEPENDENCIES, { DeploymentAlerts })} />
    );
  }
});
