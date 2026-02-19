import type { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it } from "vitest";

import { useDeployButtonFlow } from "./useDeployButtonFlow";

import { renderHook } from "@testing-library/react";

describe(useDeployButtonFlow.name, () => {
  describe("deploy button flow detection", () => {
    it("detects deploy button flow when repoUrl is present in searchParams", () => {
      const { result } = setup({
        repoUrl: "https://github.com/test/repo.git"
      });

      expect(result.current.isDeployButtonFlow).toBe(true);
      expect(result.current.params.repoUrl).toBe("https://github.com/test/repo.git");
    });

    it("does not detect deploy button flow when repoUrl is absent", () => {
      const { result } = setup({});

      expect(result.current.isDeployButtonFlow).toBe(false);
      expect(result.current.params.repoUrl).toBeNull();
    });
  });

  describe("parameter extraction", () => {
    it("extracts all deploy button parameters", () => {
      const { result } = setup({
        repoUrl: "https://github.com/test/repo.git",
        branch: "main",
        buildCommand: "npm run build",
        startCommand: "npm start",
        installCommand: "npm install",
        buildDirectory: "dist",
        nodeVersion: "18",
        templateId: "custom-template"
      });

      expect(result.current.params).toEqual({
        repoUrl: "https://github.com/test/repo.git",
        branch: "main",
        buildCommand: "npm run build",
        startCommand: "npm start",
        installCommand: "npm install",
        buildDirectory: "dist",
        nodeVersion: "18",
        templateId: "custom-template"
      });
    });

    it("returns null for missing parameters", () => {
      const { result } = setup({ repoUrl: "https://github.com/test/repo.git" });

      expect(result.current.params.branch).toBeNull();
      expect(result.current.params.buildCommand).toBeNull();
      expect(result.current.params.startCommand).toBeNull();
      expect(result.current.params.installCommand).toBeNull();
      expect(result.current.params.buildDirectory).toBeNull();
      expect(result.current.params.nodeVersion).toBeNull();
      expect(result.current.params.templateId).toBeNull();
    });

    it("handles URL-encoded parameters", () => {
      const { result } = setupWithQueryString("repoUrl=https%3A%2F%2Fgithub.com%2Ftest%2Frepo.git&buildCommand=npm%20run%20build");

      expect(result.current.params.repoUrl).toBe("https://github.com/test/repo.git");
      expect(result.current.params.buildCommand).toBe("npm run build");
    });
  });

  function setup(searchParams: Record<string, string | null>) {
    const mockWindow = {
      location: {
        href: "http://localhost:3000/new-deployment",
        origin: "http://localhost:3000"
      }
    } as Window & typeof globalThis;

    const params = createSearchParams(searchParams);
    const useSearchParams = () => params as ReadonlyURLSearchParams;

    return renderHook(() =>
      useDeployButtonFlow({
        dependencies: {
          useSearchParams,
          window: mockWindow
        }
      })
    );
  }

  function setupWithQueryString(queryString: string) {
    const mockWindow = {
      location: {
        href: `http://localhost:3000/new-deployment?${queryString}`,
        origin: "http://localhost:3000"
      }
    } as Window & typeof globalThis;

    const params = new URLSearchParams(queryString);
    const useSearchParams = () => params as ReadonlyURLSearchParams;

    return renderHook(() =>
      useDeployButtonFlow({
        dependencies: {
          useSearchParams,
          window: mockWindow
        }
      })
    );
  }

  function createSearchParams(params: Record<string, string | null>) {
    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null) {
        urlParams.set(key, value);
      }
    });
    return urlParams as URLSearchParams;
  }
});
