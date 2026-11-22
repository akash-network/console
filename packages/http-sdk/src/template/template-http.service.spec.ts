import type { AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { HttpClient } from "../utils/httpClient";
import type { TemplateCategory, TemplateOutput } from "./template-http.service";
import { TemplateHttpService } from "./template-http.service";

describe(TemplateHttpService.name, () => {
  describe("findById", () => {
    it("reads the template by its id and answers with it", async () => {
      const template = mock<TemplateOutput>({ id: "akash-network-awesome-akash-ollama" });
      const { service, httpClient } = setup({ data: { data: template } });

      expect(await service.findById("akash-network-awesome-akash-ollama")).toBe(template);
      expect(httpClient.get).toHaveBeenCalledWith("/v1/templates/akash-network-awesome-akash-ollama.json", { signal: undefined });
    });

    it("passes on the signal it was given, so the caller can abort the request", async () => {
      const { service, httpClient } = setup({ data: { data: mock<TemplateOutput>() } });
      const { signal } = new AbortController();

      await service.findById("akash-network-awesome-akash-ollama", { signal });

      expect(httpClient.get).toHaveBeenCalledWith("/v1/templates/akash-network-awesome-akash-ollama.json", { signal });
    });
  });

  describe("findGroupedByCategory", () => {
    it("reads the template list and answers with it", async () => {
      const list = { data: [mock<TemplateCategory>({ title: "Tools" })] };
      const { service, httpClient } = setup({ data: list });

      expect(await service.findGroupedByCategory()).toEqual(list);
      expect(httpClient.get).toHaveBeenCalledWith("/v1/templates-list.json", { signal: undefined });
    });

    it("passes on the signal it was given, so the caller can abort the request", async () => {
      const { service, httpClient } = setup({ data: { data: [] } });
      const { signal } = new AbortController();

      await service.findGroupedByCategory({ signal });

      expect(httpClient.get).toHaveBeenCalledWith("/v1/templates-list.json", { signal });
    });
  });

  function setup(input: { data: unknown }) {
    const httpClient = mock<HttpClient>();
    httpClient.get.mockResolvedValue(Object.assign(mock<AxiosResponse>(), { data: input.data }));

    return { service: new TemplateHttpService(httpClient), httpClient };
  }
});
