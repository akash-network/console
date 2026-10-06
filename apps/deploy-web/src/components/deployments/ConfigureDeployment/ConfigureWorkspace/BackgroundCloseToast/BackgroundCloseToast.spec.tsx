import { describe, expect, it, vi } from "vitest";

import { BackgroundCloseToast } from "./BackgroundCloseToast";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(BackgroundCloseToast.name, () => {
  it("reports a close still settling without offering a retry or a dismiss, so the toast cannot read as success", () => {
    setup({ failed: false });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Closing your previous deploymentThis finishes in the background. You can keep editing while it does."
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("spins while the close settles", () => {
    const { container } = setup({ failed: false });

    expect(container.querySelector("svg.animate-spin")).toBeInTheDocument();
  });

  it("warns assertively that the previous deployment is still open, since it lands long after the page settled", () => {
    setup({ failed: true });

    expect(screen.getByRole("alert")).toHaveTextContent("Your previous deployment is still open");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("explains a failed close with the api's reason when it gave one", () => {
    setup({ failed: true, message: "insufficient fees" });

    expect(screen.getByRole("alert")).toHaveTextContent("insufficient fees");
  });

  it("explains a failed close without a reason by what the next request does", () => {
    setup({ failed: true });

    expect(screen.getByRole("alert")).toHaveTextContent("Requesting new bids closes it first, so nothing is left behind.");
  });

  it("flags a failed close with a warning icon", () => {
    const { container } = setup({ failed: true });

    expect(container.querySelector("svg.text-warning")).toBeInTheDocument();
  });

  it("retries a failed close", async () => {
    const onRetry = vi.fn();
    setup({ failed: true, onRetry });

    await userEvent.click(screen.getByRole("button", { name: "Retry closing it" }));

    expect(onRetry).toHaveBeenCalled();
  });

  function setup(input: { failed: boolean; message?: string; onRetry?: () => void }) {
    return render(<BackgroundCloseToast pendingClose={{ dseq: "777", failed: input.failed, message: input.message }} onRetry={input.onRetry ?? vi.fn()} />);
  }
});
