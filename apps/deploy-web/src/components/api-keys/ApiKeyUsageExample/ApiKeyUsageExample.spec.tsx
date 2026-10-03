import { describe, expect, it } from "vitest";

import { ApiKeyUsageExample } from "./ApiKeyUsageExample";

import { render, screen } from "@testing-library/react";

describe("ApiKeyUsageExample", () => {
  it("shows how to call the Console API with the x-api-key header", () => {
    render(<ApiKeyUsageExample />);

    const example = screen.getByRole("region", { name: "Using your keys" });
    expect(example).toHaveTextContent('curl https://console-api.akash.network/v1/deployments \\ -H "x-api-key: $AKASH_API_KEY"');
    expect(example).toHaveTextContent(`-d '{ "data": { "sdl": "<SDL_YAML>" } }'`);
  });
});
