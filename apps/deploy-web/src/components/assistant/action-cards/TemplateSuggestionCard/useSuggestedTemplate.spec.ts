import type { TemplateOutput } from "@akashnetwork/http-sdk";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { MarketplaceTemplate } from "@src/types/marketplace-template";
import { helloWorldTemplate } from "@src/utils/templates";
import type { DEPENDENCIES, SuggestedTemplateSource } from "./useSuggestedTemplate";
import { useSuggestedTemplate } from "./useSuggestedTemplate";

import { renderHook } from "@testing-library/react";
import { buildMarketplaceTemplate, buildTemplateVersion } from "@tests/seeders/userTemplate";

type ConsoleQuery = ReturnType<typeof DEPENDENCIES.useMarketplaceTemplate>;
type AwesomeAkashQuery = ReturnType<typeof DEPENDENCIES.usePublicTemplate>;

const TEMPLATE_ID = "5f0c7f0e-6a51-4a53-9a50-0c1f3f1d2b11";
const RESOURCES = { cpu: 8, memoryBytes: 48 * 1024 ** 3, storageBytes: 100 * 1024 ** 3, gpu: { units: 1, models: ["a100"] } };
const CONSOLE_TEMPLATE = buildMarketplaceTemplate({
  id: TEMPLATE_ID,
  title: "Open WebUI + vLLM",
  summary: "Private ChatGPT-style chat on your own GPU.",
  icon: "message-square",
  visibility: "public",
  publisher: {
    name: "Lambda Garage",
    slug: null,
    type: "team",
    handle: "lambda-garage",
    verified: true,
    memberSince: null,
    counts: { templates: 3, deploys: 9 }
  },
  currentVersion: buildTemplateVersion({ templateId: TEMPLATE_ID, version: 4, resources: RESOURCES }),
  usage: { deploys: 1300, lastDeployedAt: null, stillUpAfter24h: null, forks: 0, favorites: 0 }
});
const AWESOME_AKASH_TEMPLATE = mock<TemplateOutput>({
  id: "akash-network-awesome-akash-ollama",
  name: "Ollama + Open WebUI",
  summary: "Run open models with Ollama."
});

describe(useSuggestedTemplate.name, () => {
  describe("for a Console template", () => {
    it("reads the template by its id and describes it by what was read", () => {
      const { result, useMarketplaceTemplate, usePublicTemplate } = setup({ source: "console", consoleTemplate: CONSOLE_TEMPLATE });

      expect(useMarketplaceTemplate).toHaveBeenCalledWith(TEMPLATE_ID);
      expect(usePublicTemplate).toHaveBeenCalledWith(undefined);
      expect(result.current).toEqual({
        status: "ready",
        title: "Open WebUI + vLLM",
        summary: "Private ChatGPT-style chat on your own GPU.",
        icon: "message-square",
        publisher: { name: "Lambda Garage", verified: true },
        facts: ["v4", "1.3K deploys"],
        hardware: RESOURCES,
        isOfficial: false,
        viewUrl: `/template/${TEMPLATE_ID}`,
        configureUrl: expect.stringMatching(new RegExp(`\\?(.*&)?userTemplateId=${TEMPLATE_ID}`))
      });
    });

    it("opens Configure for the Console template and never as a gallery template", () => {
      const { result } = setup({ source: "console", consoleTemplate: CONSOLE_TEMPLATE });

      expect(result.current).toMatchObject({ configureUrl: expect.not.stringContaining("templateId=") });
    });

    it("says whether staff promoted the template", () => {
      const { result } = setup({ source: "console", consoleTemplate: { ...CONSOLE_TEMPLATE, isOfficial: true } });

      expect(result.current).toMatchObject({ isOfficial: true });
    });

    it("describes a template without a publisher or a summary with neither", () => {
      const { result } = setup({ source: "console", consoleTemplate: { ...CONSOLE_TEMPLATE, publisher: null, summary: null } });

      expect(result.current).toMatchObject({ status: "ready", publisher: null, summary: null });
    });

    it("counts a single deploy in the singular", () => {
      const { result } = setup({ source: "console", consoleTemplate: { ...CONSOLE_TEMPLATE, usage: { ...CONSOLE_TEMPLATE.usage, deploys: 1 } } });

      expect(result.current).toMatchObject({ facts: ["v4", "1 deploy"] });
    });

    it("waits while the template loads", () => {
      const { result } = setup({ source: "console", isLoading: true });

      expect(result.current).toEqual({ status: "loading" });
    });

    it.each([400, 401, 403, 404, 410])("calls a template the API refuses with %s unavailable", status => {
      const { result } = setup({ source: "console", error: new ApiError(status, { message: "refused" }, String(status)) });

      expect(result.current).toEqual({ status: "unavailable" });
    });

    it("calls a template with nothing to deploy unavailable", () => {
      const { result } = setup({ source: "console", consoleTemplate: { ...CONSOLE_TEMPLATE, currentVersion: null } });

      expect(result.current).toEqual({ status: "unavailable" });
    });

    it("offers to read again a template the API failed to answer for", () => {
      const refetch = vi.fn();
      const { result } = setup({ source: "console", error: new ApiError(503, { message: "down" }, "503"), refetch });

      expect(result.current.status).toBe("failed");
      (result.current as Extract<typeof result.current, { status: "failed" }>).retry();

      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("offers to read again a template the API turned away for asking too often", () => {
      const refetch = vi.fn();
      const { result } = setup({ source: "console", error: new ApiError(429, { message: "slow down" }, "429"), refetch });

      expect(result.current.status).toBe("failed");
      (result.current as Extract<typeof result.current, { status: "failed" }>).retry();

      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it("calls a template unavailable when the read ends with neither a template nor an error", () => {
      const { result } = setup({ source: "console" });

      expect(result.current).toEqual({ status: "unavailable" });
    });
  });

  describe("for an awesome-akash template", () => {
    it("reads the gallery template by its id and describes it as Akash's", () => {
      const { result, useMarketplaceTemplate, usePublicTemplate } = setup({
        source: "awesome_akash",
        templateId: "akash-network-awesome-akash-ollama",
        awesomeAkashTemplate: AWESOME_AKASH_TEMPLATE
      });

      expect(usePublicTemplate).toHaveBeenCalledWith("akash-network-awesome-akash-ollama");
      expect(useMarketplaceTemplate).toHaveBeenCalledWith(undefined);
      expect(result.current).toEqual({
        status: "ready",
        title: "Ollama + Open WebUI",
        summary: "Run open models with Ollama.",
        icon: null,
        publisher: { name: "Akash Network", handle: null, verified: true },
        facts: ["awesome-akash"],
        hardware: null,
        isOfficial: true,
        viewUrl: "/templates/akash-network-awesome-akash-ollama",
        configureUrl: expect.stringMatching(/\?(.*&)?templateId=akash-network-awesome-akash-ollama/)
      });
    });

    it("shows no summary for a gallery template whose summary is empty", () => {
      const { result } = setup({
        source: "awesome_akash",
        templateId: "akash-network-awesome-akash-ollama",
        awesomeAkashTemplate: mock<TemplateOutput>({ name: "Ollama", summary: "" })
      });

      expect(result.current).toMatchObject({ summary: null });
    });

    it("describes a template built into Console without reading anything", () => {
      const { result, usePublicTemplate, useMarketplaceTemplate } = setup({ source: "awesome_akash", templateId: helloWorldTemplate.code });

      expect(usePublicTemplate).toHaveBeenCalledWith(undefined);
      expect(useMarketplaceTemplate).toHaveBeenCalledWith(undefined);
      expect(result.current).toEqual({
        status: "ready",
        title: "Hello World",
        summary: "Simple next.js web application showing hello world.",
        icon: null,
        publisher: { name: "Akash Network", handle: null, verified: true },
        facts: ["Built into Console"],
        hardware: null,
        isOfficial: true,
        viewUrl: null,
        configureUrl: expect.stringMatching(/\?(.*&)?templateId=hello-world/)
      });
    });

    it("never reads a Console template under a built-in template's id", () => {
      const { result, useMarketplaceTemplate } = setup({ source: "console", templateId: helloWorldTemplate.code });

      expect(useMarketplaceTemplate).toHaveBeenCalledWith(helloWorldTemplate.code);
      expect(result.current).toEqual({ status: "unavailable" });
    });

    it("waits while the gallery template loads", () => {
      const { result } = setup({ source: "awesome_akash", templateId: "akash-network-awesome-akash-ollama", isLoading: true });

      expect(result.current).toEqual({ status: "loading" });
    });

    it("calls an unknown gallery template unavailable", () => {
      const { result } = setup({
        source: "awesome_akash",
        templateId: "akash-network-awesome-akash-gone",
        error: new ApiError(404, { message: "Not found" }, "404")
      });

      expect(result.current).toEqual({ status: "unavailable" });
    });

    it("offers to read again a gallery template that failed to load", () => {
      const { result } = setup({ source: "awesome_akash", templateId: "akash-network-awesome-akash-ollama", error: new Error("Network Error") });

      expect(result.current.status).toBe("failed");
    });
  });

  function setup(input: {
    source: SuggestedTemplateSource;
    templateId?: string;
    consoleTemplate?: MarketplaceTemplate;
    awesomeAkashTemplate?: TemplateOutput;
    isLoading?: boolean;
    error?: Error;
    refetch?: () => void;
  }) {
    const answer = { isLoading: !!input.isLoading, isError: !!input.error, error: input.error ?? null, refetch: input.refetch ?? vi.fn() };
    const idle = { isLoading: false, isError: false, error: null, data: undefined, refetch: vi.fn() };
    const useMarketplaceTemplate = vi.fn<typeof DEPENDENCIES.useMarketplaceTemplate>(id =>
      Object.assign(mock<ConsoleQuery>(), id ? { ...answer, data: input.consoleTemplate } : idle)
    );
    const usePublicTemplate = vi.fn<typeof DEPENDENCIES.usePublicTemplate>(id =>
      Object.assign(mock<AwesomeAkashQuery>(), id ? { ...answer, data: input.awesomeAkashTemplate } : idle)
    );
    const { result } = renderHook(() => useSuggestedTemplate(input.source, input.templateId ?? TEMPLATE_ID, { useMarketplaceTemplate, usePublicTemplate }));

    return { result, useMarketplaceTemplate, usePublicTemplate };
  }
});
