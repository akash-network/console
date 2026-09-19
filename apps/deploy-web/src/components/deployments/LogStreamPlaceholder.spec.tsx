import { describe, expect, it, vi } from "vitest";

import type { LOGS_MODE } from "@src/hooks/useLogStream/useLogStream";
import { LogStreamDisconnectedBar, LogStreamPlaceholder } from "./LogStreamPlaceholder";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(LogStreamPlaceholder.name, () => {
  it("explains the provider retention window in events mode", () => {
    setup({ mode: "events", status: "silent" });

    expect(screen.getByText("No recent events")).toBeInTheDocument();
    expect(screen.getByText(/keep Kubernetes events for about an hour/)).toBeInTheDocument();
  });

  it("explains the absence of output in logs mode", () => {
    setup({ mode: "logs", status: "silent" });

    expect(screen.getByText("No logs yet")).toBeInTheDocument();
    expect(screen.queryByText("No recent events")).not.toBeInTheDocument();
  });

  it("offers no retry while the stream is only silent", () => {
    setup({ mode: "events", status: "silent" });

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("reports a disconnect instead of the retention copy once the stream closed", () => {
    setup({ mode: "events", status: "closed" });

    expect(screen.getByText("Stream disconnected")).toBeInTheDocument();
    expect(screen.queryByText("No recent events")).not.toBeInTheDocument();
  });

  it("retries on demand once the stream closed", async () => {
    const { onRetry } = setup({ mode: "logs", status: "closed" });

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  function setup(input: { mode: LOGS_MODE; status: "silent" | "closed" }) {
    const onRetry = vi.fn();
    render(<LogStreamPlaceholder mode={input.mode} status={input.status} onRetry={onRetry} />);
    return { onRetry };
  }
});

describe(LogStreamDisconnectedBar.name, () => {
  it("reports the disconnect alongside output that already arrived", () => {
    setup();

    expect(screen.getByText("Stream disconnected")).toBeInTheDocument();
  });

  it("retries on demand", async () => {
    const { onRetry } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  function setup() {
    const onRetry = vi.fn();
    render(<LogStreamDisconnectedBar onRetry={onRetry} />);
    return { onRetry };
  }
});
