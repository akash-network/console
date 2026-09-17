import { describe, expect, it, vi } from "vitest";

import { BackgroundCloseBanner } from "./BackgroundCloseBanner";

import { fireEvent, render, screen } from "@testing-library/react";

describe(BackgroundCloseBanner.name, () => {
  it("warns the previous deployment is still open and retries the close", () => {
    const onRetry = vi.fn();
    setup({ failed: true, onRetry });

    expect(screen.getByText(/your previous deployment is still open/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry closing it/i }));

    expect(onRetry).toHaveBeenCalled();
  });

  it("shows the reason the close failed when the api gave one", () => {
    setup({ failed: true, message: "insufficient fees" });

    expect(screen.getByText("insufficient fees")).toBeInTheDocument();
  });

  it("announces a failed close assertively, since it mounts long after the page settled", () => {
    setup({ failed: true });

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("reports a close still settling without offering a retry, so the notice cannot read as success", () => {
    setup({ failed: false });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/closing your previous deployment/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry closing it/i })).not.toBeInTheDocument();
  });

  function setup(input: { failed: boolean; message?: string; onRetry?: () => void }) {
    return render(<BackgroundCloseBanner pendingClose={{ dseq: "777", failed: input.failed, message: input.message }} onRetry={input.onRetry ?? vi.fn()} />);
  }
});
