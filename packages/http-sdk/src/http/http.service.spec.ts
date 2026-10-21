import type { AxiosRequestConfig } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpService } from "./http.service";

describe(HttpService.name, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("leaves the User-Agent header to the browser", async () => {
    const { request, sentHeaders } = setup({ runsInBrowser: true });

    await request();

    expect(sentHeaders().has("user-agent")).toBe(false);
  });

  it("sends the axios User-Agent outside the browser", async () => {
    const { request, sentHeaders } = setup({ runsInBrowser: false });

    await request();

    expect(sentHeaders().get("user-agent")).toMatch(/^axios\//);
  });

  it("sends the headers the caller sets", async () => {
    const { request, sentHeaders } = setup({ runsInBrowser: true, config: { headers: { Authorization: "Bearer token" } } });

    await request();

    expect(sentHeaders().get("authorization")).toBe("Bearer token");
  });

  function setup(input: { runsInBrowser: boolean; config?: AxiosRequestConfig }) {
    if (input.runsInBrowser) vi.stubGlobal("window", {});
    const fetch = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal("fetch", fetch);
    const service = new HttpService(input.config);

    const request = () => service.get("https://console.example/v1/usage", { adapter: "fetch" });
    const sentHeaders = (): Headers => fetch.mock.calls[0][0].headers;

    return { request, sentHeaders };
  }
});
