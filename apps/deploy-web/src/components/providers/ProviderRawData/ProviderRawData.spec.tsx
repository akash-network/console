import { COMPONENTS, ProviderRawData } from "@src/components/providers/ProviderRawData/ProviderRawData";
import type { AppDIContainer } from "@src/context/ServicesProvider";
import type { ApiProviderDetail } from "@src/types/provider";

import { act, render, waitFor } from "@testing-library/react";
import { buildProvider } from "@tests/seeders/provider";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(ProviderRawData.name, () => {
  it("renders", async () => {
    const components = MockComponents(COMPONENTS);
    const provider = buildProvider();
    await setup({ components, provider });

    expect(components.Layout).toHaveBeenCalled();
    expect(components.CustomNextSeo).toHaveBeenCalled();
    await waitFor(() => expect(components.ProviderDetailLayout).toHaveBeenCalledWith(expect.objectContaining({ address: provider.owner, provider }), {}));
    expect(components.DynamicReactJson).toHaveBeenCalledWith(expect.objectContaining({ src: JSON.parse(JSON.stringify(provider)) }), {});
  });

  async function setup(props?: Props) {
    const publicConsoleApiHttpClient = () =>
      ({
        get: jest.fn(async url => {
          if (url.includes("/providers/"))
            return {
              data: props?.provider || buildProvider()
            };

          throw new Error(`unexpected request: ${url}`);
        })
      }) as unknown as AppDIContainer["publicConsoleApiHttpClient"];
    const chainApiHttpClient = () =>
      ({
        get: jest.fn(async url => {
          if (url.includes("/leases/")) return { data: [] };
          throw new Error(`unexpected request: ${url}`);
        })
      }) as unknown as AppDIContainer["chainApiHttpClient"];
    const providerProxy = () =>
      ({
        fetchProviderUrl: jest.fn(() => {
          return new Promise(() => {});
        })
      }) as unknown as AppDIContainer["providerProxy"];

    const result = render(
      <TestContainerProvider services={{ chainApiHttpClient, publicConsoleApiHttpClient, providerProxy }}>
        <ProviderRawData owner={props?.provider?.owner || "test"} components={MockComponents(COMPONENTS, props?.components)} />
      </TestContainerProvider>
    );

    await act(() => Promise.resolve());

    return result;
  }

  interface Props {
    provider?: ApiProviderDetail;
    components?: typeof COMPONENTS;
  }
});
