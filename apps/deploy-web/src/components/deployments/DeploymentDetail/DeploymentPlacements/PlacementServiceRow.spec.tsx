import { TooltipProvider } from "@akashnetwork/ui/components";
import { faker } from "@faker-js/faker";
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

  it("reports loading when lease status has not arrived", () => {
    setup({ leaseState: "active" });

    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("reports a closed service when the lease has been reclaimed while still active", () => {
    setup({ service: mock<LeaseServiceStatus>({ available: 1 }), leaseState: "active", isReclaimed: true });

    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });

  it("keeps the service URL out of the collapsed header", () => {
    setup({ uris: ["shop.example.com"] });

    expect(screen.queryByRole("link", { name: /shop\.example\.com/ })).not.toBeInTheDocument();
  });

  it("shows the service URL below Image when expanded", async () => {
    setup({
      uris: ["shop.example.com"],
      detail: { image: "nginx:1.25" }
    });

    await expandService();

    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.getByText("URL")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /shop\.example\.com/ })).toHaveAttribute("href", "http://shop.example.com");
  });

  it("shows the replica count in the collapsed header", () => {
    setup({ service: mock<LeaseServiceStatus>({ available: 2, total: 3 }) });

    expect(screen.getByText("2/3 replicas")).toBeInTheDocument();
  });

  it("hides the replica count when the lease is closed", () => {
    setup({ service: mock<LeaseServiceStatus>({ available: 2, total: 3 }), leaseState: "closed" });

    expect(screen.queryByText("2/3 replicas")).not.toBeInTheDocument();
  });

  it("hides the replica count when the lease has been reclaimed", () => {
    setup({ service: mock<LeaseServiceStatus>({ available: 2, total: 3 }), leaseState: "active", isReclaimed: true });

    expect(screen.queryByText("2/3 replicas")).not.toBeInTheDocument();
  });

  it("keeps forwarded ports collapsed until the row is expanded", async () => {
    setup({ forwardedPorts: [{ host: "provider.io", externalPort: 30000, port: 80, available: 1 }] });

    expect(screen.queryByText("Ports")).not.toBeInTheDocument();

    await expandService();

    expect(screen.getByText("Ports")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /80/ })).toHaveAttribute("href", "http://provider.io:30000");
  });

  it("keeps the row expanded when a URL link is clicked", async () => {
    setup({
      uris: ["app.example.com"],
      forwardedPorts: [{ host: "provider.io", externalPort: 30000, port: 80, available: 1 }]
    });

    await expandService();
    await userEvent.click(screen.getByRole("link", { name: /app\.example\.com/ }));

    expect(screen.getByText("Ports")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /web/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("hides the service URI once the lease is no longer live", () => {
    setup({ uris: ["app.example.com"], leaseState: "closed" });

    expect(screen.queryByRole("link", { name: /app\.example\.com/ })).not.toBeInTheDocument();
  });

  it("expands a running service even without live endpoints", async () => {
    setup({ service: mock<LeaseServiceStatus>({ available: 1 }), leaseState: "active", detail: { image: "nginx:1.25" } });

    await expandService();

    expect(screen.getByRole("button", { name: /web/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Image")).toBeInTheDocument();
  });

  it("is not expandable when there is nothing to show", () => {
    setup({ service: mock<LeaseServiceStatus>({ available: 1 }), leaseState: "active" });

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /web/ })).not.toBeInTheDocument();
  });

  it("shows image and resources when expanded", async () => {
    setup({
      detail: {
        image: "ghcr.io/acmecorp/llm-gateway:0.9.4",
        resources: { gpuUnits: 0, cpu: 1, memory: { value: 2, unit: "Gi" }, storage: { value: 10, unit: "Gi" } }
      }
    });

    await expandService();

    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.getByText("ghcr.io/acmecorp/llm-gateway:0.9.4")).toBeInTheDocument();
    expect(screen.getByText("vCPU")).toBeInTheDocument();
    expect(screen.getByText("Memory")).toBeInTheDocument();
    expect(screen.getByText("2 Gi")).toBeInTheDocument();
    expect(screen.getByText("Storage")).toBeInTheDocument();
  });

  it("does not show env vars or command", async () => {
    const envValue = faker.string.alphanumeric(24);

    setup({
      detail: {
        image: "nginx:1.25",
        env: [{ key: "API_KEY", value: envValue }],
        command: "sh -c echo hi"
      }
    });

    await expandService();

    expect(screen.queryByText("Env vars")).not.toBeInTheDocument();
    expect(screen.queryByText("Command")).not.toBeInTheDocument();
    expect(screen.queryByText("API_KEY")).not.toBeInTheDocument();
    expect(screen.queryByText(envValue)).not.toBeInTheDocument();
    expect(screen.queryByText("sh -c echo hi")).not.toBeInTheDocument();
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
