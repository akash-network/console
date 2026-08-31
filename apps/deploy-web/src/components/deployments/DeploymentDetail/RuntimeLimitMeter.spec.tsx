import { describe, expect, it } from "vitest";

import { getRuntimeLimitCountdown } from "@src/utils/runtimeLimitUtils";
import { RuntimeLimitMeter } from "./RuntimeLimitMeter";

import { render, screen } from "@testing-library/react";

const NOW = Date.parse("2026-08-21T12:00:00.000Z");

describe("RuntimeLimitMeter", () => {
  it("renders nothing until the countdown is anchored to a lease", () => {
    setup({ runtimeLimitHours: 12, runtimeEndsAt: null });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("fills to the share of the limit that is left", () => {
    setup({ runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T15:00:00.000Z" });

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
  });

  it("announces both the remaining time and the limit it is measured against", () => {
    setup({ runtimeLimitHours: 1, runtimeEndsAt: "2026-08-21T12:36:00.000Z" });

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "36m of 1h left");
  });

  it("empties once the limit is reached", () => {
    setup({ runtimeLimitHours: 1, runtimeEndsAt: "2026-08-21T11:00:00.000Z" });

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("renders nothing once the deployment has stopped, where a partial bar would still read as draining", () => {
    setup({ runtimeLimitHours: 12, runtimeEndsAt: "2026-08-21T15:00:00.000Z", hasStopped: true });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  function setup(input: { runtimeLimitHours: number; runtimeEndsAt: string | null; hasStopped?: boolean }) {
    const countdown = getRuntimeLimitCountdown({ ...input, now: NOW });
    render(<RuntimeLimitMeter countdown={countdown} />);
    return { countdown };
  }
});
