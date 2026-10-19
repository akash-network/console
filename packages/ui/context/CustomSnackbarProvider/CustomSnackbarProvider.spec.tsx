import { useEffect } from "react";
import type { OptionsObject, SnackbarMessage } from "notistack";
import { useSnackbar } from "notistack";
import { describe, expect, it } from "vitest";

import { CustomSnackbarProvider } from "./CustomSnackbarProvider";

import { render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(CustomSnackbarProvider.name, () => {
  it.each([
    ["success", "bg-green-50"],
    ["warning", "bg-amber-50"],
    ["error", "bg-red-50"],
    ["info", "bg-popover"],
    ["default", "bg-popover"]
  ] as const)("shows a %s toast as a %s card", async (variant, background) => {
    setup({ message: "Event has been created", options: { variant } });

    const toast = await screen.findByRole("alert");

    expect(toast).toHaveClass(background, "rounded-lg", "border");
    expect(toast).toHaveTextContent("Event has been created");
  });

  it("gives a plain-text message the icon of its variant", async () => {
    setup({ message: "Event has not been created", options: { variant: "error" } });

    expect(await screen.findByRole("img", { name: "Error" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Event has not been created" })).toBeInTheDocument();
  });

  it("shows a plain-text message of the default variant without an icon", async () => {
    setup({ message: "Event has been created" });

    expect(await screen.findByRole("heading", { name: "Event has been created" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows a message given as an element as it is", async () => {
    setup({ message: <p>Be at the area 10 minutes before the event time</p>, options: { variant: "info" } });

    expect(await screen.findByText("Be at the area 10 minutes before the event time")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("closes a toast from its dismiss button", async () => {
    setup({ message: "Event has been created", options: { variant: "success", persist: true } });

    await userEvent.click(await screen.findByRole("button", { name: "Dismiss" }));

    await waitForElementToBeRemoved(() => screen.queryByRole("alert"));
  });

  it("lets a toast bring its own action in place of the dismiss button", async () => {
    setup({ message: "Event has been created", options: { action: () => <button>Undo</button> } });

    expect(await screen.findByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
  });

  function setup(input: { message: SnackbarMessage; options?: OptionsObject }) {
    function Notify() {
      const { enqueueSnackbar } = useSnackbar();

      useEffect(
        function enqueueOnMount() {
          enqueueSnackbar(input.message, input.options);
        },
        [enqueueSnackbar]
      );

      return null;
    }

    return render(
      <CustomSnackbarProvider>
        <Notify />
      </CustomSnackbarProvider>
    );
  }
});
