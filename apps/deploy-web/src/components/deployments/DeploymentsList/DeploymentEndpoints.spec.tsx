import { describe, expect, it } from "vitest";

import type { VisitEndpoint } from "../DeploymentDetail/DeploymentVisitControl/visitEndpoints";
import { DeploymentEndpoints } from "./DeploymentEndpoints";
import type { UnreachableReason } from "./useDeploymentReachability";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("DeploymentEndpoints", () => {
  it("renders a single endpoint as a link to the service", () => {
    setup({ endpoints: [endpoint({ serviceName: "site", host: "acmecorp.com", port: 443 })] });

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "http://acmecorp.com:443");
    expect(screen.getByText("acmecorp.com")).toBeInTheDocument();
    expect(screen.getByText(":443")).toBeInTheDocument();
    expect(screen.getByText("site")).toBeInTheDocument();
  });

  it("collapses several endpoints behind a count until it is expanded", async () => {
    setup({
      endpoints: [endpoint({ host: "one.example.com", port: 80 }), endpoint({ host: "two.example.com", port: 8080 })]
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /2 endpoints/ }));

    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("explains that a running deployment exposes nothing publicly", () => {
    setup({ endpoints: [], unreachableReason: "no-public-endpoint" });

    expect(screen.getByText("private · no public endpoint")).toBeInTheDocument();
  });

  it("explains that the deployment is not running rather than claiming it is private", () => {
    setup({ endpoints: [], unreachableReason: "not-running" });

    expect(screen.getByText("no endpoint · not running")).toBeInTheDocument();
  });

  it("distinguishes an unreachable provider from a deployment without endpoints", () => {
    setup({ endpoints: [], unreachableReason: "provider-unreachable" });

    expect(screen.getByText("endpoints unavailable · provider unreachable")).toBeInTheDocument();
  });

  it("shows a placeholder instead of a wrong reason while endpoints are still resolving", () => {
    setup({ endpoints: [], isLoading: true });

    expect(screen.getByTestId("deployment-endpoints-skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/no public endpoint/)).not.toBeInTheDocument();
  });

  function endpoint(input: Partial<VisitEndpoint>): VisitEndpoint {
    const host = input.host ?? "example.com";
    const port = input.port ?? 80;
    return { serviceName: input.serviceName ?? "web", host, port, href: input.href ?? `http://${host}:${port}` };
  }

  function setup(input: { endpoints: VisitEndpoint[]; isLoading?: boolean; unreachableReason?: UnreachableReason }) {
    render(<DeploymentEndpoints endpoints={input.endpoints} isLoading={input.isLoading ?? false} unreachableReason={input.unreachableReason ?? null} />);

    return input;
  }
});
