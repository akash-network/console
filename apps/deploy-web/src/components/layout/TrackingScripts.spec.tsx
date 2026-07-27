import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./TrackingScripts";
import { TrackingScripts } from "./TrackingScripts";

import { render } from "@testing-library/react";

describe("TrackingScripts", () => {
  it("loads gtm.js as an external script without inline content and seeds the dataLayer", () => {
    setup({});

    const gtmScript = document.getElementById("gtm") as HTMLScriptElement;
    expect(gtmScript).toBeInTheDocument();
    expect(gtmScript.src).toBe("https://www.googletagmanager.com/gtm.js?id=GTM-TEST123");
    expect(gtmScript.async).toBe(true);
    expect(gtmScript.textContent).toBe("");
    expect(window.dataLayer).toEqual([{ "gtm.start": expect.any(Number), event: "gtm.js" }]);
  });

  it("appends the GTM noscript iframe fallback", () => {
    setup({});

    const gtmIframe = document.querySelector("noscript iframe");
    expect(gtmIframe).toHaveAttribute("src", "https://www.googletagmanager.com/ns.html?id=GTM-TEST123");
  });

  it("does not duplicate the GTM bootstrap when mounted twice", () => {
    const { renderComponent } = setup({});

    renderComponent();

    expect(document.querySelectorAll("#gtm")).toHaveLength(1);
    expect(window.dataLayer).toHaveLength(1);
  });

  it("appends growth-channel pixel scripts when growth-channel tracking is enabled", () => {
    setup({ growthChannelEnabled: true });

    expect(document.getElementById("growth-channel-script-retargeting")).toBeInTheDocument();
    expect(document.getElementById("growth-channel-script-console")).toBeInTheDocument();
  });

  it("does not append growth-channel pixel scripts when growth-channel tracking is disabled", () => {
    setup({});

    expect(document.getElementById("growth-channel-script-retargeting")).toBeNull();
    expect(document.getElementById("growth-channel-script-console")).toBeNull();
  });

  it("adds no tracking scripts outside production", () => {
    setup({ nodeEnv: "development" });

    expect(document.getElementById("gtm")).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });

  it("adds no tracking scripts when tracking is disabled", () => {
    setup({ trackingEnabled: false });

    expect(document.getElementById("gtm")).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });

  function setup(input: { nodeEnv?: "development" | "production" | "test"; trackingEnabled?: boolean; growthChannelEnabled?: boolean }) {
    document.querySelectorAll("#gtm, #growth-channel-script-retargeting, #growth-channel-script-console, noscript").forEach(element => element.remove());
    delete window.dataLayer;

    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        publicConfig: {
          NEXT_PUBLIC_NODE_ENV: input.nodeEnv ?? "production",
          NEXT_PUBLIC_TRACKING_ENABLED: input.trackingEnabled ?? true,
          NEXT_PUBLIC_GROWTH_CHANNEL_TRACKING_ENABLED: input.growthChannelEnabled ?? false,
          NEXT_PUBLIC_GTM_ID: "GTM-TEST123"
        }
      });

    const renderComponent = () => render(<TrackingScripts dependencies={{ useServices }} />);
    renderComponent();

    return { renderComponent };
  }
});
