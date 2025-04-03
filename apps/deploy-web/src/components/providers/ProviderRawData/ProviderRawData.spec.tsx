import { QueryClientProvider as LegacyQueryClientProvider } from "react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import type { AxiosStatic } from "axios";

import { COMPONENTS, ProviderRawData } from "@src/components/providers/ProviderRawData/ProviderRawData";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { legacyQueryClient, queryClient } from "@src/queries";
import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import type { ApiProviderDetail } from "@src/types/provider";

import { act, render } from "@testing-library/react";
import { buildProvider } from "@tests/seeders/provider";
import { MockComponents } from "@tests/unit/mocks";

describe(ProviderRawData.name, () => {
  it("renders", async () => {
    const components = MockComponents(COMPONENTS);
    const provider = buildProvider();
    await setup({ components, provider });

    expect(components.Layout).toHaveBeenCalled();
    expect(components.CustomNextSeo).toHaveBeenCalled();
    expect(components.ProviderDetailLayout).toHaveBeenCalledWith(expect.objectContaining({ address: provider.owner, provider }), {});
    expect(components.DynamicReactJson).toHaveBeenCalledWith(expect.objectContaining({ src: JSON.parse(JSON.stringify(provider)) }), {});
  });

  async function setup(props?: Props) {
    const axios = {
      get: jest.fn(async url => {
        if (url.includes("/leases/")) return new Promise(() => {});
        if (url.includes("/providers/"))
          return {
            data: props?.provider || buildProvider()
          };

        throw new Error(`unexpected request: ${url}`);
      })
    } as unknown as AxiosStatic;
    const providerProxy = {
      fetchProviderUrl: jest.fn(() => {
        return new Promise(() => {});
      })
    } as unknown as ProviderProxyService;
    const result = render(
      <ServicesProvider services={{ axios, providerProxy }}>
        <LegacyQueryClientProvider client={legacyQueryClient}>
          <QueryClientProvider client={queryClient}>
            <ProviderRawData owner={props?.provider?.owner || "test"} components={MockComponents(COMPONENTS, props?.components)} />
          </QueryClientProvider>
        </LegacyQueryClientProvider>
      </ServicesProvider>
    );

    await act(() => Promise.resolve());

    return result;
  }

  interface Props {
    provider?: ApiProviderDetail;
    components?: typeof COMPONENTS;
  }
});
