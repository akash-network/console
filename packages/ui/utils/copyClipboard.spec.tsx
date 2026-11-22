import { describe, expect, it, vi } from "vitest";

import { copyTextToClipboard } from "./copyClipboard";

describe(copyTextToClipboard.name, () => {
  it("writes the text through the async clipboard when the browser has one", async () => {
    const { writeText, copiedByCommand } = setup({ hasAsyncClipboard: true });

    const isCopied = await copyTextToClipboard("akash1abc");

    expect(isCopied).toBe(true);
    expect(writeText).toHaveBeenCalledWith("akash1abc");
    expect(copiedByCommand).toEqual([]);
  });

  it("reports a failure when the async clipboard refuses the write", async () => {
    const { writeText } = setup({ hasAsyncClipboard: true });
    writeText.mockRejectedValue(new Error("Document is not focused"));

    const isCopied = await copyTextToClipboard("akash1abc");

    expect(isCopied).toBe(false);
  });

  describe("when the browser has no async clipboard", () => {
    it("copies the text with the copy command and leaves no scratch field behind", async () => {
      const { copiedByCommand } = setup({});

      const isCopied = await copyTextToClipboard("akash1abc");

      expect(isCopied).toBe(true);
      expect(copiedByCommand).toEqual(["akash1abc"]);
      expect(document.querySelector("textarea")).toBeNull();
    });

    it("copies the asked text from inside a modal that keeps focus to itself", async () => {
      const { copiedByCommand, copyButton } = setup({ hasFocusTrappingModal: true });
      copyButton.focus();

      const isCopied = await copyTextToClipboard("[![Deploy on Akash](badge.svg)](template)");

      expect(isCopied).toBe(true);
      expect(copiedByCommand).toEqual(["[![Deploy on Akash](badge.svg)](template)"]);
      expect(document.querySelector("textarea")).toBeNull();
    });

    it("returns focus to the control that asked for the copy", async () => {
      const { copyButton } = setup({ hasFocusTrappingModal: true });
      copyButton.focus();

      await copyTextToClipboard("akash1abc");

      expect(document.activeElement).toBe(copyButton);
    });

    it("reports a failure instead of copying what a focus trap selected when the scratch field cannot take focus", async () => {
      const { copiedByCommand } = setup({ hasFocusTrappingModal: true });

      const isCopied = await copyTextToClipboard("akash1abc");

      expect(isCopied).toBe(false);
      expect(copiedByCommand).toEqual([]);
      expect(document.querySelector("textarea")).toBeNull();
    });

    it("reports a failure when the browser refuses the copy command", async () => {
      const { execCommand } = setup({});
      execCommand.mockReturnValue(false);

      const isCopied = await copyTextToClipboard("akash1abc");

      expect(isCopied).toBe(false);
    });

    it("reports a failure and removes the scratch field when the copy command throws", async () => {
      const { execCommand } = setup({});
      execCommand.mockImplementation(() => {
        throw new Error("copy is not allowed");
      });

      const isCopied = await copyTextToClipboard("akash1abc");

      expect(isCopied).toBe(false);
      expect(document.querySelector("textarea")).toBeNull();
    });
  });

  function setup(input: { hasAsyncClipboard?: boolean; hasFocusTrappingModal?: boolean }) {
    document.body.replaceChildren();

    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: input.hasAsyncClipboard ? { writeText } : undefined, configurable: true });

    const copiedByCommand: string[] = [];
    const execCommand = vi.fn((command: string) => {
      const field = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
      copiedByCommand.push(`${command === "copy" ? "" : command}${field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0)}`);
      return true;
    });
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });

    const modal = document.createElement("div");
    const linkField = document.createElement("input");
    const copyButton = document.createElement("button");
    if (input.hasFocusTrappingModal) {
      modal.setAttribute("role", "dialog");
      linkField.value = "https://console.akash.network/template/1";
      modal.append(linkField, copyButton);
      document.body.append(modal);
      document.addEventListener("focusin", event => {
        if (!modal.isConnected || modal.contains(event.target as Node)) return;
        linkField.focus();
        linkField.select();
      });
      linkField.focus();
      linkField.select();
      linkField.blur();
    }

    return { writeText, execCommand, copiedByCommand, copyButton };
  }
});
