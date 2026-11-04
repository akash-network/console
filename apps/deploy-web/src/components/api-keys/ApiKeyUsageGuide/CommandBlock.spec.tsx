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

  it("masks the lines in session replays when asked", () => {
    setup({ isMasked: true });

    expect(screen.getByLabelText("install commands")).toHaveClass("amp-mask");
  });

  it("leaves the lines unmasked by default", () => {
    setup();

    expect(screen.getByLabelText("install commands")).not.toHaveClass("amp-mask");
  });

  it("copies without anyone to report the copy to", async () => {
    const { user, writeText } = setup({ withoutOnCopied: true });

    await user.click(screen.getByRole("button", { name: "Copy install commands" }));

    expect(writeText).toHaveBeenCalledWith(LINES.join("\n"));
  });

  it("copies all lines", async () => {
    const { user, enqueueSnackbar, writeText, onCopied } = setup();

    await user.click(screen.getByRole("button", { name: "Copy install commands" }));

    expect(writeText).toHaveBeenCalledWith(LINES.join("\n"));
    await vi.waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Copied to clipboard" }) }), {
        variant: "success",
        autoHideDuration: 1500
      })
    );
    expect(onCopied).toHaveBeenCalled();
  });

  it("tells the user when the lines can't be copied", async () => {
    const { user, enqueueSnackbar, writeText, onCopied } = setup();
    writeText.mockRejectedValue(new Error("denied"));

    await user.click(screen.getByRole("button", { name: "Copy install commands" }));

    await vi.waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't copy to your clipboard" }) }), {
        variant: "error"
      })
    );
    expect(enqueueSnackbar).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
    expect(onCopied).not.toHaveBeenCalled();
  });

  function setup(input?: { isMasked?: boolean; withoutOnCopied?: boolean }) {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    writeText.mockClear();
    const enqueueSnackbar = vi.fn();
    const onCopied = vi.fn();
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>(), { enqueueSnackbar });

    render(
      <CommandBlock
        label="install commands"
        lines={LINES}
        isMasked={input?.isMasked}
        onCopied={input?.withoutOnCopied ? undefined : onCopied}
        dependencies={{ useSnackbar }}
      />
    );

    return { user, enqueueSnackbar, writeText, onCopied };
  }
});
