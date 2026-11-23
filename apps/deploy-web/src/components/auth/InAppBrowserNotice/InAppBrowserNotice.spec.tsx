import { describe, expect, it, vi } from "vitest";

import type { InAppBrowser } from "@src/lib/in-app-browser/detectInAppBrowser";
import { UNNAMED_ANDROID_WEBVIEW } from "@src/lib/in-app-browser/detectInAppBrowser";
import { InAppBrowserNotice } from "./InAppBrowserNotice";

import { fireEvent, render, screen } from "@testing-library/react";

describe(InAppBrowserNotice.name, () => {
  it("names the app whose built-in browser blocks Google sign-in", () => {
    setup({ browser: "X" });

    expect(screen.getByText(/Google sign-in doesn't work in X's built-in browser/)).toBeInTheDocument();
  });

  it("refers to the app generically when the WebView does not name it", () => {
    setup({ browser: UNNAMED_ANDROID_WEBVIEW });

    expect(screen.getByText(/Google sign-in doesn't work in this app's built-in browser/)).toBeInTheDocument();
  });

  it("copies the current page link so it can be opened in another browser", async () => {
    const { writeText } = setup({ browser: "X" });

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByRole("button", { name: "Link copied" })).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it("says so when the link could not be copied", async () => {
    setup({ browser: "X", isClipboardWriteRejected: true });

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByRole("button", { name: "Couldn't copy the link" })).toBeInTheDocument();
  });

  function setup(input: { browser: InAppBrowser; isClipboardWriteRejected?: boolean }) {
    const writeText = input.isClipboardWriteRejected ? vi.fn().mockRejectedValue(new Error("denied")) : vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<InAppBrowserNotice browser={input.browser} />);

    return { writeText };
  }
});
