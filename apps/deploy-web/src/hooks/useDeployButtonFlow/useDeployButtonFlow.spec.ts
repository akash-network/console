import type { ReadonlyURLSearchParams } from "next/navigation";

import { CI_CD_TEMPLATE_ID } from "@src/config/remote-deploy.config";
import { RouteStep } from "@src/types/route-steps.type";
import { useDeployButtonFlow } from "./useDeployButtonFlow";

import { renderHook } from "@testing-library/react";

describe(useDeployButtonFlow.name, () => {
  describe("deploy button flow detection", () => {
    it("detects deploy button flow when repoUrl is present in searchParams", () => {
      const { result } = setup({}, "http://localhost:3000/new-deployment?repoUrl=https://github.com/test/repo.git");

      expect(result.current.isDeployButtonFlow).toBe(true);
      expect(result.current.params.repoUrl).toBe("https://github.com/test/repo.git");
    });

    it("does not detect deploy button flow when repoUrl is absent", () => {
      const { result } = setup({});

      expect(result.current.isDeployButtonFlow).toBe(false);
      expect(result.current.params.repoUrl).toBeNull();
    });

    it("detects deploy button flow when repoUrl is in returnTo parameter", () => {
      const { result } = setup({
        returnTo: "/new-deployment?repoUrl=https://github.com/test/repo.git&branch=main"
      });

      expect(result.current.isDeployButtonFlow).toBe(true);
      expect(result.current.params.repoUrl).toBe("https://github.com/test/repo.git");
      expect(result.current.params.branch).toBe("main");
    });

    it("detects deploy button flow when repoUrl is in from parameter", () => {
      const { result } = setup({
        from: "/new-deployment?repoUrl=https://github.com/test/repo.git&buildCommand=npm%20run%20build"
      });

      expect(result.current.isDeployButtonFlow).toBe(true);
      expect(result.current.params.repoUrl).toBe("https://github.com/test/repo.git");
      expect(result.current.params.buildCommand).toBe("npm run build");
    });

    it("falls back to window.location.href when returnTo and from are absent", () => {
      const { result } = setup({}, "http://localhost:3000/new-deployment?repoUrl=https://github.com/test/repo.git&branch=main");

      expect(result.current.isDeployButtonFlow).toBe(true);
      expect(result.current.params.repoUrl).toBe("https://github.com/test/repo.git");
      expect(result.current.params.branch).toBe("main");
    });
  });

  describe("parameter extraction", () => {
    it("extracts all deploy button parameters", () => {
      const { result } = setup(
        {},
        "http://localhost:3000/new-deployment?repoUrl=https://github.com/test/repo.git&branch=main&buildCommand=npm%20run%20build&startCommand=npm%20start&installCommand=npm%20install&buildDirectory=dist&nodeVersion=18&templateId=custom-template"
      );

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
      const { result } = setup({}, "http://localhost:3000/new-deployment?repoUrl=https://github.com/test/repo.git");

      expect(result.current.params.branch).toBeNull();
      expect(result.current.params.buildCommand).toBeNull();
      expect(result.current.params.startCommand).toBeNull();
      expect(result.current.params.installCommand).toBeNull();
      expect(result.current.params.buildDirectory).toBeNull();
      expect(result.current.params.nodeVersion).toBeNull();
      expect(result.current.params.templateId).toBeNull();
    });

    it("handles URL-encoded parameters in returnTo", () => {
      const { result } = setup({
        returnTo: "/new-deployment?repoUrl=https%3A%2F%2Fgithub.com%2Ftest%2Frepo.git&branch=main"
      });

      expect(result.current.params.repoUrl).toBe("https://github.com/test/repo.git");
      expect(result.current.params.branch).toBe("main");
    });

    it("handles URL-encoded parameters in from", () => {
      const { result } = setup({
        from: "/new-deployment?repoUrl=https%3A%2F%2Fgithub.com%2Ftest%2Frepo.git&buildCommand=npm%20run%20build"
      });

      expect(result.current.params.repoUrl).toBe("https://github.com/test/repo.git");
      expect(result.current.params.buildCommand).toBe("npm run build");
    });
  });

  describe("buildUrlParams", () => {
    it("returns only defined parameters", () => {
      const { result } = setup({}, "http://localhost:3000/new-deployment?repoUrl=https://github.com/test/repo.git&branch=main&buildCommand=npm%20run%20build");

      const urlParams = result.current.buildUrlParams();

      expect(urlParams).toEqual({
        repoUrl: "https://github.com/test/repo.git",
        branch: "main",
        buildCommand: "npm run build"
      });
    });

    it("excludes null parameters", () => {
      const { result } = setup({}, "http://localhost:3000/new-deployment?repoUrl=https://github.com/test/repo.git");

      const urlParams = result.current.buildUrlParams();

      expect(urlParams).toEqual({
        repoUrl: "https://github.com/test/repo.git"
      });
      expect(urlParams.branch).toBeUndefined();
      expect(urlParams.buildCommand).toBeUndefined();
    });

    it("returns empty object when not a deploy button flow", () => {
      const { result } = setup({});

      const urlParams = result.current.buildUrlParams();

      expect(urlParams).toEqual({});
    });
  });

  describe("buildReturnUrl", () => {
    it("builds return URL with default step and gitProvider for deploy button flow", () => {
      const { result } = setup({}, "http://localhost:3000/new-deployment?repoUrl=https://github.com/test/repo.git&branch=main");

      const returnUrl = result.current.buildReturnUrl();

      expect(returnUrl).toContain(`templateId=${CI_CD_TEMPLATE_ID}`);
      expect(returnUrl).toContain("repoUrl=https%3A%2F%2Fgithub.com%2Ftest%2Frepo.git");
      expect(returnUrl).toContain("branch=main");
      expect(returnUrl).toContain(`step=${RouteStep.editDeployment}`);
      expect(returnUrl).toContain("gitProvider=github");
    });

    it("builds return URL with custom step", () => {
      const { result } = setup({}, "http://localhost:3000/new-deployment?repoUrl=https://github.com/test/repo.git");

      const returnUrl = result.current.buildReturnUrl({
        step: RouteStep.createLeases
      });

      expect(returnUrl).toContain(`step=${RouteStep.createLeases}`);
    });

    it("builds return URL with custom gitProvider", () => {
      const { result } = setup({}, "http://localhost:3000/new-deployment?repoUrl=https://github.com/test/repo.git");

      const returnUrl = result.current.buildReturnUrl({
        gitProvider: "gitlab"
      });

      expect(returnUrl).toContain("gitProvider=gitlab");
    });

    it("includes all deploy button parameters in return URL", () => {
      const { result } = setup(
        {},
        "http://localhost:3000/new-deployment?repoUrl=https://github.com/test/repo.git&branch=main&buildCommand=npm%20run%20build&startCommand=npm%20start&installCommand=npm%20install&buildDirectory=dist&nodeVersion=18"
      );

      const returnUrl = result.current.buildReturnUrl();

      expect(returnUrl).toContain("repoUrl=");
      expect(returnUrl).toContain("branch=main");
      expect(returnUrl).toContain("buildCommand=npm");
      expect(returnUrl).toContain("run");
      expect(returnUrl).toContain("build");
      expect(returnUrl).toContain("startCommand=npm");
      expect(returnUrl).toContain("start");
      expect(returnUrl).toContain("installCommand=npm");
      expect(returnUrl).toContain("install");
      expect(returnUrl).toContain("buildDirectory=dist");
      expect(returnUrl).toContain("nodeVersion=18");
    });

    it("returns root path when not a deploy button flow", () => {
      const { result } = setup({});

      const returnUrl = result.current.buildReturnUrl();

      expect(returnUrl).toBe("/");
    });

    it("returns root path when repoUrl is null", () => {
      const { result } = setup({}, "http://localhost:3000/new-deployment?branch=main");

      const returnUrl = result.current.buildReturnUrl();

      expect(returnUrl).toBe("/");
    });
  });

  function setup(searchParams: Record<string, string | null>, windowHref?: string) {
    const mockWindow = {
      location: {
        href: windowHref || "http://localhost:3000/new-deployment",
        origin: windowHref ? new URL(windowHref).origin : "http://localhost:3000"
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
