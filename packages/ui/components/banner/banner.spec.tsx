import { describe, expect, it, vi } from "vitest";

import { Banner } from "./banner";

import { fireEvent, render, screen } from "@testing-library/react";

describe("Banner", () => {
  it("renders its content", () => {
    render(<Banner>Heads up</Banner>);

    expect(screen.getByText("Heads up")).toBeInTheDocument();
  });

  it("is not focusable/clickable when no onClick is provided", () => {
    render(<Banner>Static</Banner>);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onClick when the banner is clicked", () => {
    const onClick = vi.fn();
    render(<Banner onClick={onClick}>Get $100</Banner>);

    fireEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("activates via keyboard (Enter and Space) when clickable", () => {
    const onClick = vi.fn();
    render(<Banner onClick={onClick}>Get $100</Banner>);
    const banner = screen.getByRole("button");

    fireEvent.keyDown(banner, { key: "Enter" });
    fireEvent.keyDown(banner, { key: " " });

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("calls onClose when the dismiss control is clicked", () => {
    const onClose = vi.fn();
    render(<Banner onClose={onClose}>Dismiss me</Banner>);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not trigger the banner's onClick when the dismiss control is clicked", () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    render(
      <Banner onClick={onClick} onClose={onClose}>
        Both
      </Banner>
    );

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not trigger the banner's onClick when a key is pressed on the dismiss control", () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    render(
      <Banner onClick={onClick} onClose={onClose}>
        Both
      </Banner>
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Dismiss" }), { key: "Enter" });

    expect(onClick).not.toHaveBeenCalled();
  });
});
