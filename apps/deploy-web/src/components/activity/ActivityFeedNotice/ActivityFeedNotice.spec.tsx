import { describe, expect, it } from "vitest";

import { ActivityFeedNotice, activityFeedStatusOf } from "./ActivityFeedNotice";

import { render, screen } from "@testing-library/react";

describe(ActivityFeedNotice.name, () => {
  it("says the feed could not be loaded when it never answered", () => {
    setup({ status: "unavailable" });

    expect(screen.getByText("Couldn't load your activity")).toBeInTheDocument();
    expect(screen.getByText("Try again in a moment.")).toBeInTheDocument();
  });

  it("shows it is loading", () => {
    setup({ status: "loading" });

    expect(screen.getByRole("status", { name: "Loading activity" })).toBeInTheDocument();
  });

  it("says there is no activity yet", () => {
    setup({ status: "empty" });

    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(screen.getByText("When you close a deployment, you can follow how it goes here.")).toBeInTheDocument();
  });

  describe(activityFeedStatusOf.name, () => {
    it.each([
      { isLoaded: false, isError: true, entryCount: 0, status: "unavailable" },
      { isLoaded: false, isError: false, entryCount: 0, status: "loading" },
      { isLoaded: true, isError: false, entryCount: 0, status: "empty" },
      { isLoaded: true, isError: true, entryCount: 0, status: "empty" },
      { isLoaded: true, isError: true, entryCount: 2, status: "listed" },
      { isLoaded: true, isError: false, entryCount: 1, status: "listed" }
    ])("reads a feed loaded=$isLoaded, failing=$isError with $entryCount entries as $status", ({ status, ...feed }) => {
      expect(activityFeedStatusOf(feed)).toBe(status);
    });
  });

  function setup(input: { status: "unavailable" | "loading" | "empty" }) {
    render(<ActivityFeedNotice status={input.status} />);
    return input;
  }
});
