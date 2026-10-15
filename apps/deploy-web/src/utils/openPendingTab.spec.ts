import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { openPendingTab } from "./openPendingTab";

describe(openPendingTab.name, () => {
  it("opens a blank tab cut off from the console right away", () => {
    const { tab, open } = setup();

    openPendingTab();

    expect(open).toHaveBeenCalledWith("", "_blank");
    expect(tab.opener).toBeNull();
  });

  it("sends the opened tab to the url", () => {
    const { tab, open } = setup();

    openPendingTab().navigate("https://pay.stripe.com/invoice/pdf");

    expect(tab.location.href).toBe("https://pay.stripe.com/invoice/pdf");
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("closes the opened tab", () => {
    const { tab } = setup();

    openPendingTab().close();

    expect(tab.close).toHaveBeenCalled();
  });

  it("opens the url in a new tab when the browser blocked the blank one", () => {
    const { open } = setup({ isBlocked: true });

    const pendingTab = openPendingTab();
    pendingTab.navigate("https://pay.stripe.com/invoice/pdf");

    expect(open).toHaveBeenLastCalledWith("https://pay.stripe.com/invoice/pdf", "_blank", "noopener,noreferrer");
    expect(() => pendingTab.close()).not.toThrow();
  });

  function setup(input: { isBlocked?: boolean } = {}) {
    const tab = mock<Window>({ opener: {}, location: mock<Location>({ href: "about:blank" }) });
    const open = vi.spyOn(window, "open").mockReturnValue(input.isBlocked ? null : tab);
    onTestFinished(() => open.mockRestore());

    return { tab, open };
  }
});
