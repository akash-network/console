import { describe, expect, it, vi } from "vitest";

import type { VisitEndpoint } from "../DeploymentDetail/DeploymentVisitControl/visitEndpoints";
import { DeploymentEndpoints, DeploymentEndpointsPanel } from "./DeploymentEndpoints";
import type { UnreachableReason } from "./useDeploymentReachability";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("DeploymentEndpoints", () => {
  it("renders a single endpoint as a link to the service", () => {
    setup({ endpoints: [endpoint({ serviceName: "site", host: "acmecorp.com", port: 443 })] });

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "http://acmecorp.com:443");
    expect(link).toHaveTextContent("acmecorp.com");
  });

  it("leaves the service name off a lone endpoint, which has nothing to be told apart from", () => {
    setup({ endpoints: [endpoint({ serviceName: "site", host: "acmecorp.com", port: 443 })] });

    expect(screen.queryByText("site")).not.toBeInTheDocument();
  });

  it("drops the port of a lone endpoint that serves on 80, where it tells the reader nothing", () => {
    setup({ endpoints: [endpoint({ host: "acmecorp.com", port: 80 })] });

    expect(screen.getByRole("link")).toHaveTextContent("acmecorp.com");
    expect(screen.getByRole("link")).not.toHaveTextContent(":80");
  });

  it("keeps the port of a lone endpoint that serves anywhere else, which the reader needs to reach it", () => {
    setup({ endpoints: [endpoint({ host: "acmecorp.com", port: 8080 })] });

    expect(screen.getByRole("link")).toHaveTextContent("acmecorp.com:8080");
  });

  it("offers a count rather than the endpoints themselves once there are several", () => {
    setup({
      endpoints: [endpoint({ host: "one.example.com", port: 80 }), endpoint({ host: "two.example.com", port: 8080 })]
    });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2 endpoints/ })).toBeInTheDocument();
  });

  it("reports whether the endpoints are showing, so the toggle reads correctly to a screen reader", () => {
    setup({ endpoints: [endpoint({ host: "one.example.com" }), endpoint({ host: "two.example.com" })], isExpanded: true });

    expect(screen.getByRole("button", { name: /2 endpoints/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("asks its owner to toggle rather than expanding in place, since the panel renders outside it", async () => {
    const { onToggleExpanded } = setup({ endpoints: [endpoint({ host: "one.example.com" }), endpoint({ host: "two.example.com" })] });

    await userEvent.click(screen.getByRole("button", { name: /2 endpoints/ }));

    expect(onToggleExpanded).toHaveBeenCalled();
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

  it("keeps a click on an endpoint from reaching whatever the row is wired to", async () => {
    const onContainerClick = vi.fn();
    render(
      <div onClick={onContainerClick}>
        <DeploymentEndpoints endpoints={[endpoint({ host: "acmecorp.com", port: 443 })]} isLoading={false} unreachableReason={null} />
      </div>
    );

    await userEvent.click(screen.getByRole("link"));

    expect(onContainerClick).not.toHaveBeenCalled();
  });

  it("opens an endpoint in a new tab without leaking the referrer", () => {
    setup({ endpoints: [endpoint({ host: "acmecorp.com", port: 443 })] });

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("says nothing at all when there are no endpoints and no reason to give", () => {
    setup({ endpoints: [], unreachableReason: undefined });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/no public endpoint|not running|provider unreachable/)).not.toBeInTheDocument();
  });

  it("shows a placeholder instead of a wrong reason while endpoints are still resolving", () => {
    setup({ endpoints: [], isLoading: true });

    expect(screen.getByTestId("deployment-endpoints-skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/no public endpoint/)).not.toBeInTheDocument();
  });

  describe(DeploymentEndpointsPanel.name, () => {
    it("names every endpoint alongside its host and port, so they can be told apart", () => {
      render(<DeploymentEndpointsPanel endpoints={[endpoint({ serviceName: "api", host: "api.acmecorp.com", port: 443 })]} />);

      expect(screen.getByText("api")).toBeInTheDocument();
      expect(screen.getByText("api.acmecorp.com")).toBeInTheDocument();
      expect(screen.getByText(":443")).toBeInTheDocument();
    });

    it("links every endpoint it lists", () => {
      render(<DeploymentEndpointsPanel endpoints={[endpoint({ host: "one.example.com" }), endpoint({ host: "two.example.com", port: 8080 })]} />);

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute("href", "http://one.example.com:80");
      expect(links[1]).toHaveAttribute("target", "_blank");
      expect(links[1]).toHaveAttribute("rel", "noreferrer");
    });

    it("keeps a click on an endpoint from reaching whatever the row is wired to", async () => {
      const onContainerClick = vi.fn();
      render(
        <div onClick={onContainerClick}>
          <DeploymentEndpointsPanel endpoints={[endpoint({ host: "one.example.com" }), endpoint({ host: "two.example.com", port: 8080 })]} />
        </div>
      );

      await userEvent.click(screen.getAllByRole("link")[0]);

      expect(onContainerClick).not.toHaveBeenCalled();
    });
  });

  function endpoint(input: Partial<VisitEndpoint>): VisitEndpoint {
    const host = input.host ?? "example.com";
    const port = input.port ?? 80;
    return { serviceName: input.serviceName ?? "web", host, port, href: input.href ?? `http://${host}:${port}` };
  }

  function setup(input: { endpoints: VisitEndpoint[]; isLoading?: boolean; unreachableReason?: UnreachableReason; isExpanded?: boolean }) {
    const onToggleExpanded = vi.fn();
    render(
      <DeploymentEndpoints
        endpoints={input.endpoints}
        isLoading={input.isLoading ?? false}
        unreachableReason={input.unreachableReason ?? null}
        isExpanded={input.isExpanded ?? false}
        onToggleExpanded={onToggleExpanded}
      />
    );

    return { ...input, onToggleExpanded };
  }
});
