import { describe, expect, it } from "vitest";

import { services as rootContainer } from "@src/services/app-di-container/browser-di-container";
import { ServicesProvider, useServices } from "./ServicesProvider";

import { render, screen } from "@testing-library/react";

describe(ServicesProvider.name, () => {
  it("resolves services from the root container", () => {
    setup();

    expect(screen.getByTestId("app-url")).toHaveTextContent(rootContainer.publicConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL);
  });

  it("resolves an overridden service instead of the root one", () => {
    setup({ apiUrl: "https://api.example.test" });

    expect(screen.getByTestId("app-url")).toHaveTextContent("https://api.example.test");
  });

  it("resolves the overrides it is given on a later render", () => {
    const { rerender } = setup();

    rerender(
      <ServicesProvider services={overrideApiUrl("https://api.example.test")}>
        <ApiUrlProbe />
      </ServicesProvider>
    );

    expect(screen.getByTestId("app-url")).toHaveTextContent("https://api.example.test");
  });

  function setup(input: { apiUrl?: string } = {}) {
    return render(
      <ServicesProvider services={input.apiUrl ? overrideApiUrl(input.apiUrl) : undefined}>
        <ApiUrlProbe />
      </ServicesProvider>
    );
  }
});

function overrideApiUrl(apiUrl: string) {
  return { publicConfig: () => ({ ...rootContainer.publicConfig, NEXT_PUBLIC_BASE_API_MAINNET_URL: apiUrl }) };
}

function ApiUrlProbe() {
  const { publicConfig } = useServices();
  return <span data-testid="app-url">{publicConfig.NEXT_PUBLIC_BASE_API_MAINNET_URL}</span>;
}
