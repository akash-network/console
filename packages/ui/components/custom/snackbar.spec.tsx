import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { Snackbar } from "./snackbar";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(Snackbar.name, () => {
  it("shows the title with its subtitle under it", () => {
    setup({ title: "Event has been created", subTitle: "Monday, January 3rd at 6:00pm" });

    expect(screen.getByRole("heading", { name: "Event has been created" })).toBeInTheDocument();
    expect(screen.getByText("Monday, January 3rd at 6:00pm")).toHaveClass("text-muted-foreground");
  });

  it.each([
    ["success", "Success"],
    ["info", "Info"],
    ["warning", "Warning"],
    ["error", "Error"]
  ] as const)("marks a %s toast with its own icon", (iconVariant, label) => {
    setup({ title: "Event has been created", iconVariant });

    expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("shows no icon when the toast has no variant", () => {
    setup({ title: "Event has been created" });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a spinner while the work it reports is still running", () => {
    setup({ title: "Processing payment...", showLoading: true });

    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("offers its action next to the text", async () => {
    const undo = vi.fn();
    setup({ title: "Event has been created", action: <button onClick={undo}>Undo</button> });

    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(undo).toHaveBeenCalledTimes(1);
  });

  function setup(input: ComponentProps<typeof Snackbar>) {
    return render(<Snackbar {...input} />);
  }
});
