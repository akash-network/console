import { describe, expect, it, vi } from "vitest";

import { BackgroundCloseBanner } from "./BackgroundCloseBanner";

import { fireEvent, render, screen } from "@testing-library/react";

describe(BackgroundCloseBanner.name, () => {
  it("warns the previous deployment is still open and retries the close", () => {
    const onRetry = vi.fn();
    render(<BackgroundCloseBanner onRetry={onRetry} />);

    expect(screen.getByText(/your previous deployment is still open/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry closing it/i }));

    expect(onRetry).toHaveBeenCalled();
  });

  it("shows the reason the close failed when the api gave one", () => {
    render(<BackgroundCloseBanner onRetry={vi.fn()} message="insufficient fees" />);

    expect(screen.getByText("insufficient fees")).toBeInTheDocument();
  });
});
