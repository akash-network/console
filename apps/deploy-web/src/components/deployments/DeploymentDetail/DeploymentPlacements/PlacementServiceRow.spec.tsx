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

  it("keeps the service contents collapsed until the row is expanded", async () => {
    setup({ detail: { resources: { gpuUnits: 0, memory: { value: 36, unit: "Gi" } } } });

    expect(screen.queryByText("36 Gi")).not.toBeInTheDocument();

    await expandService();

    expect(screen.getByText("Memory")).toBeInTheDocument();
    expect(screen.getByText("36 Gi")).toBeInTheDocument();
  });

  it("lists the service endpoints when expanded", async () => {
    setup({ uris: ["app.example.com"] });

    await expandService();

    expect(screen.getByRole("link", { name: /app\.example\.com/ })).toHaveAttribute("href", "http://app.example.com");
  });

  it("shows a None placeholder for Expose Ports when there are no endpoints", async () => {
    setup({});

    await expandService();

    expect(screen.getByText("Expose Ports")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("shows the Docker image row when an image is known", async () => {
    setup({ detail: { image: "nginx:1.25" } });

    await expandService();

    expect(screen.getByText("Docker image")).toBeInTheDocument();
  });

  it("shows environment variables and commands when present", async () => {
    setup({ detail: { env: [{ key: "KEY", value: "value" }], command: "sh -c echo hi" } });

    await expandService();

    expect(screen.getByText("Environment Variables")).toBeInTheDocument();
    expect(screen.getByText("KEY=value")).toBeInTheDocument();
    expect(screen.getByText("Commands")).toBeInTheDocument();
    expect(screen.getByText("sh -c echo hi")).toBeInTheDocument();
  });

  it("omits the Docker image row when no image is known", async () => {
    setup({ detail: {} });

    await expandService();

    expect(screen.queryByText("Docker image")).not.toBeInTheDocument();
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
