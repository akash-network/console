import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseServiceStatus, LeaseStatusDto } from "@src/queries/useLeaseQuery";
import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { DEPENDENCIES, DeploymentVisitControl } from "./DeploymentVisitControl";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(DeploymentVisitControl.name, () => {
  it("hides the visit control when no lease has an endpoint yet", async () => {
    setup({ endpointsByLease: { "1": {} } });

    expect(screen.queryByRole("link", { name: "Visit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Visit" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("visit-control-skeleton")).not.toBeInTheDocument();
  });

  it("shows a skeleton while lease statuses have not settled", () => {
    setup({ endpointsByLease: {}, pendingLeases: ["1"] });

    expect(screen.getByTestId("visit-control-skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Visit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Visit" })).not.toBeInTheDocument();
  });

  it("shows the resolved endpoint instead of the skeleton while another lease is still pending", async () => {
    setup({
      leases: [buildLease("us", "akash1us"), buildLease("eu", "akash1eu")],
      providers: [mock<ApiProviderList>({ owner: "akash1us" }), mock<ApiProviderList>({ owner: "akash1eu" })],
      endpointsByLease: { us: { web: ["us.akash.app"] } },
      pendingLeases: ["eu"]
    });

    expect(await screen.findByRole("link", { name: "Visit" })).toBeInTheDocument();
    expect(screen.queryByTestId("visit-control-skeleton")).not.toBeInTheDocument();
  });

  it("gives up on the skeleton when statuses never settle", () => {
    vi.useFakeTimers();
    try {
      setup({ endpointsByLease: {}, pendingLeases: ["1"] });

      act(() => {
        vi.advanceTimersByTime(15_000);
      });

      expect(screen.queryByTestId("visit-control-skeleton")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Visit" })).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the URI, a copy button, and a Visit link when there is one endpoint", async () => {
    setup({ endpointsByLease: { "1": { web: ["app.akash.app"] } } });

    const visit = await screen.findByRole("link", { name: "Visit" });
    expect(visit).toHaveAttribute("href", "http://app.akash.app");
    expect(screen.getByText("app.akash.app")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy URL" })).toBeInTheDocument();
  });

  it("opens a dropdown of every endpoint when a lease exposes more than one service", async () => {
    setup({
      endpointsByLease: {
        "1": { storefront: ["shop.acmecorp.com"], api: ["api.shop.acmecorp.com"] }
      }
    });

    await userEvent.click(await screen.findByRole("button", { name: "Visit" }));

    expect(screen.getByText("2 endpoints")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /storefront/i })).toHaveAttribute("href", "http://shop.acmecorp.com");
    expect(screen.getByRole("menuitem", { name: /api/i })).toHaveAttribute("href", "http://api.shop.acmecorp.com");
    expect(screen.getByText("shop.acmecorp.com")).toBeInTheDocument();
    expect(screen.getByText("api.shop.acmecorp.com")).toBeInTheDocument();
    expect(screen.getAllByText(":80")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Copy storefront URL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy api URL" })).toBeInTheDocument();
  });

  it("lists endpoints from every live placement in the Visit dropdown", async () => {
    setup({
      leases: [buildLease("us", "akash1us"), buildLease("eu", "akash1eu")],
      providers: [mock<ApiProviderList>({ owner: "akash1us" }), mock<ApiProviderList>({ owner: "akash1eu" })],
      endpointsByLease: {
        us: { web: ["us.akash.app"] },
        eu: { web: ["eu.akash.app"] }
      }
    });

    await userEvent.click(await screen.findByRole("button", { name: "Visit" }));

    expect(screen.getByText("2 endpoints")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /us.akash.app/i })).toHaveAttribute("href", "http://us.akash.app");
    expect(screen.getByRole("menuitem", { name: /eu.akash.app/i })).toHaveAttribute("href", "http://eu.akash.app");
  });

  it("leaves closed placements out of the Visit dropdown", async () => {
    setup({
      leases: [buildLease("live", "akash1us"), mock<LeaseDto>({ id: "closed", provider: "akash1eu", state: "closed" })],
      providers: [mock<ApiProviderList>({ owner: "akash1us" }), mock<ApiProviderList>({ owner: "akash1eu" })],
      endpointsByLease: {
        live: { web: ["us.akash.app"] },
        closed: { web: ["eu.akash.app"] }
      }
    });

    const visit = await screen.findByRole("link", { name: "Visit" });
    expect(visit).toHaveAttribute("href", "http://us.akash.app");
    expect(screen.queryByRole("button", { name: "Visit" })).not.toBeInTheDocument();
  });

  function buildLease(id: string, provider: string) {
    return mock<LeaseDto>({ id, provider, state: "active" });
  }

  function setup(input: {
    leases?: LeaseDto[];
    providers?: ApiProviderList[];
    endpointsByLease: Record<string, Record<string, string[]>>;
    pendingLeases?: string[];
  }) {
    const leases = input.leases ?? [buildLease("1", "akash1provider")];
    const providers = input.providers ?? [mock<ApiProviderList>({ owner: "akash1provider" })];

    const useLeaseStatuses: typeof DEPENDENCIES.useLeaseStatuses = items =>
      items.map(({ lease }) => {
        if (input.pendingLeases?.includes(lease.id)) {
          return mock<ReturnType<typeof DEPENDENCIES.useLeaseStatuses>[number]>({ data: undefined, isPending: true });
        }
        const services: Record<string, string[]> = input.endpointsByLease[lease.id] ?? {};
        const leaseStatus = mock<LeaseStatusDto>();
        leaseStatus.forwarded_ports = {};
        leaseStatus.ips = {};
        leaseStatus.services = Object.fromEntries(
          Object.entries(services).map(([name, uris]) => {
            const service = mock<LeaseServiceStatus>();
            service.uris = uris;
            return [name, service];
          })
        );
        return mock<ReturnType<typeof DEPENDENCIES.useLeaseStatuses>[number]>({ data: leaseStatus, isPending: false });
      });

    const CopyTextToClipboardButton = vi.fn(({ value, "aria-label": label }: { value: string; "aria-label"?: string }) => (
      <button type="button" aria-label={label ?? "Copy URL"} data-value={value}>
        copy
      </button>
    ));

    return render(
      <DeploymentVisitControl
        leases={leases}
        providers={providers}
        dependencies={MockComponents(DEPENDENCIES, { useLeaseStatuses, CopyTextToClipboardButton })}
      />
    );
  }
});
