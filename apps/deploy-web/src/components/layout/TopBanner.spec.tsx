import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { type DEPENDENCIES, GenericBanner } from "./TopBanner";

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
