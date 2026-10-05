import type { AxiosInstance } from "axios";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiProviderDetail } from "@src/types/provider";
import { loadProviderDetail } from "./loadProviderDetail";

describe(loadProviderDetail.name, () => {
  it("loads the provider from the network's API", async () => {
    const provider = mock<ApiProviderDetail>({ owner: "akash1known" });
    const httpClient = mock<AxiosInstance>();
    httpClient.get.mockResolvedValue({ data: provider });

    const result = await loadProviderDetail(httpClient, "https://api.example.com", "akash1known");

    expect(result).toBe(provider);
    expect(httpClient.get).toHaveBeenCalledExactlyOnceWith("https://api.example.com/v1/providers/akash1known");
  });

  it.each([404, 400])("answers no provider when the API answers %s", async status => {
    const httpClient = mock<AxiosInstance>();
    httpClient.get.mockRejectedValue(createAxiosError(status));

    expect(await loadProviderDetail(httpClient, "https://api.example.com", "akash1unknown")).toBeNull();
  });

  it("lets any other failure through", async () => {
    const error = createAxiosError(503);
    const httpClient = mock<AxiosInstance>();
    httpClient.get.mockRejectedValue(error);

    await expect(loadProviderDetail(httpClient, "https://api.example.com", "akash1down")).rejects.toBe(error);
  });

  it("lets a request that got no answer through", async () => {
    const error = new AxiosError("Network Error");
    const httpClient = mock<AxiosInstance>();
    httpClient.get.mockRejectedValue(error);

    await expect(loadProviderDetail(httpClient, "https://api.example.com", "akash1down")).rejects.toBe(error);
  });

  function createAxiosError(status: number) {
    return new AxiosError("Request failed", String(status), undefined, undefined, {
      status,
      statusText: "",
      data: {},
      headers: {},
      config: { headers: new AxiosHeaders() }
    });
  }
});
