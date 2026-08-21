import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseServiceStatus } from "@src/queries/useLeaseQuery";
import type { PlacementServiceRowProps } from "./PlacementServiceRow";
import { PlacementServiceRow } from "./PlacementServiceRow";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(PlacementServiceRow.name, () => {
  it("reports a running service when a replica is available", () => {
    setup({ service: mock<LeaseServiceStatus>({ available: 1 }), leaseState: "active" });

    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("reports a starting service when no replica is available", () => {
    setup({ service: mock<LeaseServiceStatus>({ available: 0 }), leaseState: "active" });

    expect(screen.getByText("Starting")).toBeInTheDocument();
  });

  it("reports a closed service when the lease has been reclaimed while still active", () => {
    setup({ service: mock<LeaseServiceStatus>({ available: 1 }), leaseState: "active", isReclaimed: true });

    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });

  it("shows the service URI in the collapsed header", () => {
    setup({ uris: ["shop.example.com"] });

    expect(screen.getByRole("link", { name: /shop\.example\.com/ })).toHaveAttribute("href", "http://shop.example.com");
  });

  it("shows the replica count in the collapsed header", () => {
    setup({ service: mock<LeaseServiceStatus>({ available: 2, total: 3 }) });

    expect(screen.getByText("2/3 replicas")).toBeInTheDocument();
  });

  it("keeps forwarded ports collapsed until the row is expanded", async () => {
    setup({ forwardedPorts: [{ host: "provider.io", externalPort: 30000, port: 80, available: 1 }] });

    expect(screen.queryByText("Ports")).not.toBeInTheDocument();

    await expandService();

    expect(screen.getByText("Ports")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /80/ })).toHaveAttribute("href", "http://provider.io:30000");
  });

  it("keeps the service collapsed when a URI link is clicked", async () => {
    setup({
      uris: ["app.example.com"],
      forwardedPorts: [{ host: "provider.io", externalPort: 30000, port: 80, available: 1 }]
    });

    await userEvent.click(screen.getByRole("link", { name: /app\.example\.com/ }));

    expect(screen.queryByText("Ports")).not.toBeInTheDocument();
  });

  it("hides the service URI once the lease is no longer live", () => {
    setup({ uris: ["app.example.com"], leaseState: "closed" });

    expect(screen.queryByRole("link", { name: /app\.example\.com/ })).not.toBeInTheDocument();
  });

  it("is not expandable when there are no live endpoints", () => {
    setup({});

    expect(screen.queryByRole("button", { name: /web/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Ports")).not.toBeInTheDocument();
  });

  it("is not expandable when the lease is closed", () => {
    setup({
      leaseState: "closed",
      forwardedPorts: [{ host: "provider.io", externalPort: 30000, port: 80, available: 1 }]
    });

    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /web/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Ports")).not.toBeInTheDocument();
  });

  function expandService() {
    return userEvent.click(screen.getByRole("button", { name: /web/ }));
  }

  function setup(input: Partial<PlacementServiceRowProps>) {
    return render(
      <TooltipProvider>
        <PlacementServiceRow serviceName="web" leaseState="active" {...input} />
      </TooltipProvider>
    );
  }
});
