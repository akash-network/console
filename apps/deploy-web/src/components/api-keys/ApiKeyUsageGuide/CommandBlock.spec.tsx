import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./CommandBlock";
import { CommandBlock } from "./CommandBlock";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const LINES = ["# Install the CLI", 'export AKASH_API_KEY="<your-api-key>"', "", "brew install akash-network/tap/akt"];

describe("CommandBlock", () => {
  it("shows every line, keeping blank ones", () => {
    setup();

    expect(screen.getByLabelText("install commands").textContent).toBe(LINES.join("\n"));
  });

  it("marks comments, commands and strings for highlighting", () => {
    setup();

    const code = screen.getByLabelText("install commands");
    expect(code.querySelector('[data-token="comment"]')).toHaveTextContent("# Install the CLI");
    expect(code.querySelector('[data-token="command"]')).toHaveTextContent("export");
    expect(code.querySelector('[data-token="string"]')).toHaveTextContent('"<your-api-key>"');
  });

  it("copies all lines", async () => {
    const { user, enqueueSnackbar, writeText } = setup();

    await user.click(screen.getByRole("button", { name: "Copy install commands" }));

    expect(writeText).toHaveBeenCalledWith(LINES.join("\n"));
    await vi.waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Copied to clipboard" }) }), {
        variant: "success",
        autoHideDuration: 1500
      })
    );
  });

  it("tells the user when the lines can't be copied", async () => {
    const { user, enqueueSnackbar, writeText } = setup();
    writeText.mockRejectedValue(new Error("denied"));

    await user.click(screen.getByRole("button", { name: "Copy install commands" }));

    await vi.waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't copy to your clipboard" }) }), {
        variant: "error"
      })
    );
    expect(enqueueSnackbar).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
  });

  function setup() {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    writeText.mockClear();
    const enqueueSnackbar = vi.fn();
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>(), { enqueueSnackbar });

    render(<CommandBlock label="install commands" lines={LINES} dependencies={{ useSnackbar }} />);

    return { user, enqueueSnackbar, writeText };
  }
});
