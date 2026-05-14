import type { paths } from "@akashnetwork/console-api-types";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { type DEPENDENCIES, H100PriceStatus } from "./H100PriceStatus";

import { render, screen } from "@testing-library/react";

type ListGpuPricesData = paths["/v1/gpu-prices"]["get"]["responses"][200]["content"]["application/json"];
type ListGpuPricesResult = ReturnType<ReturnType<typeof DEPENDENCIES.useServices>["api"]["v1"]["listGpuPrices"]["useQuery"]>;

describe(H100PriceStatus.name, () => {
  it("renders the fallback price while data is loading", () => {
    setup({ data: undefined });
    expect(screen.getByText(/H100 GPUs: Starting at \$1\.80\/hr/i)).toBeInTheDocument();
  });

  it("renders the lowest h100 min price across variants", () => {
    setup({
      data: {
        availability: { total: 0, available: 0 },
        models: [
          {
            vendor: "nvidia",
            model: "h100",
            ram: "80Gi",
            interface: "pcie",
            availability: { total: 0, available: 0 },
            providerAvailability: { total: 0, available: 0 },
            price: { currency: "USD", min: 2.4, max: 5, avg: 3, weightedAverage: 3, med: 3 }
          },
          {
            vendor: "nvidia",
            model: "h100",
            ram: "80Gi",
            interface: "sxm",
            availability: { total: 0, available: 0 },
            providerAvailability: { total: 0, available: 0 },
            price: { currency: "USD", min: 1.95, max: 4, avg: 2.5, weightedAverage: 2.5, med: 2.5 }
          },
          {
            vendor: "nvidia",
            model: "a100",
            ram: "80Gi",
            interface: "pcie",
            availability: { total: 0, available: 0 },
            providerAvailability: { total: 0, available: 0 },
            price: { currency: "USD", min: 0.5, max: 1, avg: 0.7, weightedAverage: 0.7, med: 0.7 }
          }
        ]
      }
    });
    expect(screen.getByText(/H100 GPUs: Starting at \$1\.95\/hr/i)).toBeInTheDocument();
  });

  it("falls back when no h100 model is returned", () => {
    setup({ data: { availability: { total: 0, available: 0 }, models: [] } });
    expect(screen.getByText(/H100 GPUs: Starting at \$1\.80\/hr/i)).toBeInTheDocument();
  });

  function setup(input: { data: ListGpuPricesData | undefined }) {
    const queryResult = mock<ListGpuPricesResult>({ data: input.data });
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        api: {
          v1: {
            listGpuPrices: {
              useQuery: () => queryResult
            }
          }
        }
      });

    return render(<H100PriceStatus dependencies={{ useServices }} />);
  }
});
