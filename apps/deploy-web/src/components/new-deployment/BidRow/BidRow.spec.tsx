import type { RadioGroupItem } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { LocalNoteProvider } from "@src/context/LocalNoteProvider/LocalNoteContext";
import { queryClient } from "@src/queries/queryClient";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import type { BidDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { BidRow, COMPONENTS } from "./BidRow";

import { render } from "@testing-library/react";
import { buildDeploymentBid } from "@tests/seeders/deploymentBid";
import { buildProvider } from "@tests/seeders/provider";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(BidRow.name, () => {
  it("displays bid details", () => {
    const provider = buildProvider({
      hostUri: "https://provider-host-uri",
      uptime7d: 0.9
    });
    const bid = buildDeploymentBid({
      price: {
        denom: "uakt",
        amount: "1280000000000000000"
      },
      provider: provider.owner
    });
    const components = {
      PricePerTimeUnit: vi.fn(),
      ProviderName: vi.fn(),
      Uptime: vi.fn(),
      RadioGroupItem: vi.fn() as unknown as typeof RadioGroupItem
    };
    const { getByText } = setup({
      bid,
      provider,
      components
    });

    expect(components.PricePerTimeUnit).toHaveBeenCalledWith(
      expect.objectContaining({
        denom: bid.price.denom,
        perBlockValue: udenomToDenom(bid.price.amount, 10)
      }),
      {}
    );
    expect(components.ProviderName).toHaveBeenCalledWith({ provider }, {});
    expect(components.Uptime).toHaveBeenCalledWith(
      expect.objectContaining({
        value: provider.uptime7d
      }),
      {}
    );
    expect(getByText(`${provider.ipRegionCode}, ${provider.ipCountryCode}`)).toBeInTheDocument();
    expect(components.RadioGroupItem).toHaveBeenCalledWith(
      expect.objectContaining({
        value: bid.id,
        id: bid.id,
        disabled: false,
        "aria-label": provider.name
      }),
      {}
    );
  });

  it("does not display RadioGroupItem when disabled or bid closed", () => {
    const provider = buildProvider({
      hostUri: "https://provider-host-uri",
      uptime7d: 0.9
    });
    let bid = buildDeploymentBid({ provider: provider.owner });
    const components = {
      RadioGroupItem: vi.fn() as unknown as typeof RadioGroupItem
    };
    setup({
      bid,
      provider,
      components,
      disabled: true
    });
    expect(components.RadioGroupItem).not.toHaveBeenCalled();

    bid = buildDeploymentBid({ provider: provider.owner, state: "closed" });
    setup({
      bid,
      provider,
      components
    });
    expect(components.RadioGroupItem).not.toHaveBeenCalled();
  });

  function setup(
    props: Partial<{
      bid: BidDto;
      selectedBid: BidDto;
      handleBidSelected: (bid: BidDto) => void;
      disabled: boolean;
      provider: ApiProviderList;
      isSendingManifest: boolean;
      components?: Partial<typeof COMPONENTS>;
    }>
  ) {
    const providerProxy = () =>
      ({
        request: vi.fn(() => {
          return new Promise(() => {});
        })
      }) as unknown as ProviderProxyService;
    return render(
      <TestContainerProvider services={{ providerProxy, queryClient: () => queryClient, analyticsService: () => mock<AnalyticsService>() }}>
        <LocalNoteProvider>
          <BidRow
            bid={props?.bid ?? buildDeploymentBid()}
            selectedBid={props?.selectedBid}
            handleBidSelected={props?.handleBidSelected || (() => {})}
            disabled={props?.disabled ?? false}
            provider={props?.provider ?? buildProvider()}
            isSendingManifest={props?.isSendingManifest ?? false}
            components={MockComponents(COMPONENTS, props?.components)}
          />
        </LocalNoteProvider>
      </TestContainerProvider>
    );
  }
});
