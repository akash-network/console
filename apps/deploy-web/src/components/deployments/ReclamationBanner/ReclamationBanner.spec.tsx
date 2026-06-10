import { afterEach, describe, expect, it, vi } from "vitest";

import type { LeaseDto } from "@src/types/deployment";
import { ReclamationBanner } from "./ReclamationBanner";

import { render, screen } from "@testing-library/react";

describe("ReclamationBanner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when no lease is reclaiming", () => {
    setup({ leases: [createLease({ state: "active" }), createLease({ state: "closed" })] });
    expect(screen.queryByText("This deployment is being reclaimed")).not.toBeInTheDocument();
  });

  it("renders nothing when there are no leases", () => {
    setup({ leases: [] });
    expect(screen.queryByText("This deployment is being reclaimed")).not.toBeInTheDocument();
  });

  it("shows a live countdown to the nearest deadline while a lease is reclaiming", () => {
    const now = new Date("2026-06-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const deadline = Math.floor(now.getTime() / 1000) + 3600;

    setup({ leases: [createLease({ state: "reclaiming", reclamation: { deadline } })] });

    expect(screen.getByText("This deployment is being reclaimed")).toBeInTheDocument();
    expect(screen.getByLabelText("reclamation deadline")).toHaveTextContent("closes in 1 hour");
  });

  it("shows 'Closing now…' once the deadline has passed", () => {
    const now = new Date("2026-06-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const deadline = Math.floor(now.getTime() / 1000) - 60;

    setup({ leases: [createLease({ state: "reclaiming", reclamation: { deadline } })] });

    expect(screen.getByLabelText("reclamation deadline")).toHaveTextContent("Closing now…");
  });

  it("shows 'Reclamation pending' when a reclaiming lease has no deadline", () => {
    setup({ leases: [createLease({ state: "reclaiming" })] });
    expect(screen.getByLabelText("reclamation deadline")).toHaveTextContent("Reclamation pending");
  });

  it("offers a redeploy action", () => {
    setup({ leases: [createLease({ state: "reclaiming" })] });
    expect(screen.getByRole("link", { name: "Redeploy" })).toHaveAttribute("href", expect.stringContaining("redeploy=123"));
  });

  function setup(input: { leases: LeaseDto[] | null }) {
    return render(<ReclamationBanner leases={input.leases} dseq="123" />);
  }

  function createLease(overrides: { state?: string; reclamation?: LeaseDto["reclamation"] } = {}): LeaseDto {
    return {
      id: "1",
      owner: "owner1",
      provider: "provider1",
      dseq: "123",
      gseq: 1,
      oseq: 1,
      state: overrides.state ?? "active",
      price: { denom: "uakt", amount: "100" },
      cpuAmount: 0,
      memoryAmount: 0,
      storageAmount: 0,
      reclamation: overrides.reclamation
    } as LeaseDto;
  }
});
