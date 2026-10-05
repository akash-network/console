import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto } from "@src/types/deployment";
import { UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, YourLeasesCard } from "./YourLeasesCard";

import { render, screen } from "@testing-library/react";

describe("YourLeasesCard", () => {
  it("links each lease to its deployment, named when it has a name, pricing GPU leases hourly and the rest monthly", () => {
    const PricePerTimeUnit = vi.fn<typeof DEPENDENCIES.PricePerTimeUnit>(({ perBlockValue }) => <span>{`${perBlockValue} per block`}</span>);
    const leases = [
      Object.assign(mock<LeaseDto>(), { id: "a", dseq: "100", gpuAmount: 2, price: { denom: "uact", amount: "231" } }),
      Object.assign(mock<LeaseDto>(), { id: "b", dseq: "200", gpuAmount: 0, price: { denom: "uact", amount: "12" } })
    ];

    render(
      <YourLeasesCard leases={leases} getDeploymentName={dseq => (dseq === "100" ? "llama-chat" : null)} dependencies={{ ...DEPENDENCIES, PricePerTimeUnit }} />
    );

    expect(screen.getByText("2 active")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /llama-chat/ })).toHaveAttribute("href", UrlService.deploymentDetails("100"));
    expect(screen.getByRole("link", { name: /Deployment 200/ })).toHaveAttribute("href", UrlService.deploymentDetails("200"));
    expect(PricePerTimeUnit.mock.calls[0][0]).toMatchObject({ denom: "uact", showAsHourly: true, abbreviated: true });
    expect(PricePerTimeUnit.mock.calls[1][0]).toMatchObject({ denom: "uact", showAsHourly: false, abbreviated: true });
    expect(screen.getByText("dseq 100")).toBeInTheDocument();
  });

  it("counts a single active lease", () => {
    render(
      <YourLeasesCard
        leases={[Object.assign(mock<LeaseDto>(), { id: "a", dseq: "100", price: { denom: "uact", amount: "1" } })]}
        getDeploymentName={() => null}
        dependencies={{ ...DEPENDENCIES, PricePerTimeUnit: () => null }}
      />
    );

    expect(screen.getByText("1 active")).toBeInTheDocument();
  });
});
