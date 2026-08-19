import { netConfig } from "@akashnetwork/net";
import { describe, expect, it } from "vitest";

import networkStore from "@src/store/networkStore";
import { ServicesProvider, useServices } from "./ServicesProvider";

import { render, screen } from "@testing-library/react";

describe(ServicesProvider.name, () => {
  it("exposes the chain api base url on the very first render", () => {
    setup();

    expect(screen.getByTestId("chain-api-base-url")).toHaveTextContent(netConfig.getBaseAPIUrl(networkStore.selectedNetworkId));
  });

  function setup() {
    render(
      <ServicesProvider>
        <ChainApiBaseUrlProbe />
      </ServicesProvider>
    );
  }
});

function ChainApiBaseUrlProbe() {
  const { chainApiHttpClient } = useServices();
  return <span data-testid="chain-api-base-url">{chainApiHttpClient.defaults.baseURL}</span>;
}
