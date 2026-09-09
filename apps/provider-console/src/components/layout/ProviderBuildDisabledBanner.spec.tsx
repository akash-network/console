import "@testing-library/jest-dom";

import React from "react";

import { topBannerHeightCssVar } from "@src/utils/constants";
import { ProviderBuildDisabledBanner } from "./ProviderBuildDisabledBanner";

import { render, screen } from "@testing-library/react";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverMock });

describe(ProviderBuildDisabledBanner.name, () => {
  it("tells users that provider builds are disabled and where to build instead", () => {
    setup();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Provider builds are disabled in Provider Console. Use the Provider Playbook to build providers. Provider Console remains available for dashboards and management."
    );
  });

  it("links to the Provider Playbook in a new tab", () => {
    setup();

    const link = screen.getByRole("link", { name: "Provider Playbook" });
    expect(link).toHaveAttribute("href", "https://akash.network/docs/providers/setup-and-installation/provider-playbook/");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("publishes its height as a root CSS variable and clears it on unmount", () => {
    const { unmount } = setup();

    expect(document.documentElement.style.getPropertyValue(topBannerHeightCssVar)).toBe("0px");

    unmount();

    expect(document.documentElement.style.getPropertyValue(topBannerHeightCssVar)).toBe("");
  });

  function setup() {
    return render(<ProviderBuildDisabledBanner />);
  }
});
