import { afterEach, describe, expect, it, vi } from "vitest";

import { copyPendingTextToClipboard } from "./copyPendingTextToClipboard";

describe(copyPendingTextToClipboard.name, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts a clipboard write right away with the text still pending", async () => {
    const { write, writeText, ClipboardItem } = setup({ supportsClipboardItem: true });
    let resolveText: (text: string) => void = () => undefined;
    const pendingText = new Promise<string>(resolve => {
      resolveText = resolve;
    });

    const copied = copyPendingTextToClipboard(pendingText);

    expect(write).toHaveBeenCalledOnce();
    resolveText("https://console.akash.network/invitations#token=abc");
    await expect(copied).resolves.toBe(true);
    const [items] = ClipboardItem.mock.calls[0] as [Record<string, Promise<Blob>>];
    await expect((await items["text/plain"]).text()).resolves.toBe("https://console.akash.network/invitations#token=abc");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to writing the text once known when the browser has no clipboard items", async () => {
    const { writeText } = setup({ supportsClipboardItem: false });

    await expect(copyPendingTextToClipboard(Promise.resolve("link"))).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("link");
  });

  it("falls back to writing the text when the clipboard item is refused", async () => {
    const { write, writeText } = setup({ supportsClipboardItem: true });
    write.mockRejectedValue(new DOMException("denied", "NotAllowedError"));

    await expect(copyPendingTextToClipboard(Promise.resolve("link"))).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("link");
  });

  it("reports a refused fallback write", async () => {
    const { writeText } = setup({ supportsClipboardItem: false });
    writeText.mockRejectedValue(new DOMException("denied", "NotAllowedError"));

    await expect(copyPendingTextToClipboard(Promise.resolve("link"))).resolves.toBe(false);
  });

  it("passes on the failure of the pending text", async () => {
    setup({ supportsClipboardItem: true });

    await expect(copyPendingTextToClipboard(Promise.reject(new Error("no link")))).rejects.toThrow("no link");
  });

  function setup(input: { supportsClipboardItem: boolean }) {
    const write = vi.fn(async (items: unknown[]) => {
      await Promise.all(items.map(item => (item as { pending: Promise<Blob> }).pending));
    });
    const writeText = vi.fn(async (_text: string) => undefined);
    const ClipboardItem = vi.fn(function ClipboardItemStub(this: { pending: Promise<Blob> }, items: Record<string, Promise<Blob>>) {
      this.pending = items["text/plain"];
    });
    vi.stubGlobal("navigator", { ...navigator, clipboard: input.supportsClipboardItem ? { write, writeText } : { writeText } });
    if (input.supportsClipboardItem) vi.stubGlobal("ClipboardItem", ClipboardItem);
    else vi.stubGlobal("ClipboardItem", undefined);

    return { write, writeText, ClipboardItem };
  }
});
