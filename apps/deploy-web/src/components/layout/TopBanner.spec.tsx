import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import {
  type DEPENDENCIES,
  GenericBanner,
  type MAINTENANCE_BANNER_DEPENDENCIES,
  MaintenanceBanner,
  type NETWORK_DOWN_BANNER_DEPENDENCIES,
  NetworkDownBanner
} from "./TopBanner";

import { render, screen } from "@testing-library/react";

describe(GenericBanner.name, () => {
  it("renders the message and each provided link with safe external attributes", () => {
    setup({
      message: "Self-custody is moving to Console Air.",
      links: [
        { label: "Read the announcement", href: "https://akash.network/announcement" },
        { label: "Open Console Air", href: "https://console.air" }
      ]
    });

    expect(screen.getByText("Self-custody is moving to Console Air.")).toBeInTheDocument();

    const announcementLink = screen.getByRole("link", { name: "Read the announcement" });
    expect(announcementLink).toHaveAttribute("href", "https://akash.network/announcement");
    expect(announcementLink).toHaveAttribute("target", "_blank");
    expect(announcementLink).toHaveAttribute("rel", "noopener noreferrer");

    expect(screen.getByRole("link", { name: "Open Console Air" })).toHaveAttribute("href", "https://console.air");
  });

  it("renders nothing for links when none are provided", () => {
    setup({ message: "Heads up!" });

    expect(screen.getByText("Heads up!")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("invokes onClose when the close button is clicked", () => {
    const { onClose } = setup({ message: "anything" });

    screen.getByRole("button").click();

    expect(onClose).toHaveBeenCalledOnce();
  });

  function setup(input: { message: string; links?: { label: string; href: string }[] }) {
    const onClose = vi.fn();
    const useGenericBannerDetails: typeof DEPENDENCIES.useGenericBannerDetails = () =>
      mock<ReturnType<typeof DEPENDENCIES.useGenericBannerDetails>>({
        message: input.message,
        links: input.links
      });

    render(<GenericBanner onClose={onClose} dependencies={{ useGenericBannerDetails }} />);
    return { onClose };
  }
});

describe(NetworkDownBanner.name, () => {
  it("shows the read-only message when no upgrade time is set", () => {
    setup({ date: "" });

    expect(screen.getByText(/read-only mode until service is restored/)).toBeInTheDocument();
  });

  it("shows the upgrading message once the upgrade window has started", () => {
    setup({ date: "2000-01-01T00:00:00Z" });

    expect(screen.getByText(/We are upgrading the blockchain/)).toBeInTheDocument();
  });

  it("reverts to the read-only message when a started upgrade window is later cleared", () => {
    const { rerenderWithDate } = setup({ date: "2000-01-01T00:00:00Z" });
    expect(screen.getByText(/We are upgrading the blockchain/)).toBeInTheDocument();

    rerenderWithDate("");

    expect(screen.getByText(/read-only mode until service is restored/)).toBeInTheDocument();
  });

  function setup(input: { date: string }) {
    const bannerWithDate = (date: string) => {
      const useChainMaintenanceDetails: typeof NETWORK_DOWN_BANNER_DEPENDENCIES.useChainMaintenanceDetails = () => ({ date });
      return <NetworkDownBanner dependencies={{ useChainMaintenanceDetails }} />;
    };

    const { rerender } = render(bannerWithDate(input.date));

    return { rerenderWithDate: (date: string) => rerender(bannerWithDate(date)) };
  }
});

describe(MaintenanceBanner.name, () => {
  it("announces the scheduled upgrade time when one is set", () => {
    setup({ date: "2026-08-01T10:00:00Z" });

    expect(screen.getByText(/Network upgrade scheduled at/)).toBeInTheDocument();
  });

  it("omits the time when none is set", () => {
    setup({ date: "" });

    expect(screen.getByText(/Network upgrade scheduled\. Console will switch/)).toBeInTheDocument();
  });

  it("invokes onClose when the close button is clicked", () => {
    const { onClose } = setup({ date: "" });

    screen.getByRole("button", { name: "Dismiss" }).click();

    expect(onClose).toHaveBeenCalledOnce();
  });

  function setup(input: { date: string }) {
    const onClose = vi.fn();
    const useChainMaintenanceDetails: typeof MAINTENANCE_BANNER_DEPENDENCIES.useChainMaintenanceDetails = () => ({ date: input.date });

    render(
      <IntlProvider locale="en-US">
        <MaintenanceBanner onClose={onClose} dependencies={{ useChainMaintenanceDetails }} />
      </IntlProvider>
    );
    return { onClose };
  }
});
