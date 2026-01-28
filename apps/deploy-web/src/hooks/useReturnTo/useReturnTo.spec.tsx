import { mock } from "jest-mock-extended";
import type { ReadonlyURLSearchParams } from "next/navigation";

import type { UrlReturnToStack } from "./UrlReturnToStack";
import { DEPENDENCIES, useReturnTo } from "./useReturnTo";

import { act, renderHook } from "@testing-library/react";

describe(useReturnTo.name, () => {
  it("computes returnTo from stack and navigates back", () => {
    const { result, routerPush, getReturnTo } = setup({
      pathname: "/foo",
      search: "a=1",
      stackReturnTo: "/bar?x=1"
    });

    expect(getReturnTo).toHaveBeenCalledWith("/foo?a=1");
    expect(result.current.returnTo).toBe("/bar?x=1");

    act(() => {
      result.current.navigateBack();
    });

    expect(routerPush).toHaveBeenCalledWith("/bar?x=1");
  });

  it("navigates with returnTo by pushing a returnable URL", () => {
    const { result, routerPush, createReturnable } = setup({
      pathname: "/current",
      search: "q=1",
      stackReturnTo: "/ignored"
    });

    createReturnable.mockReturnValue("/login?returnTo=%2Fcurrent%3Fq%3D1");

    act(() => {
      result.current.navigateWithReturnTo("/login", { fromSignup: "true" });
    });

    expect(createReturnable).toHaveBeenCalledWith("/current?q=1", "/login", { extraQueryParams: { fromSignup: "true" } });
    expect(routerPush).toHaveBeenCalledWith("/login?returnTo=%2Fcurrent%3Fq%3D1");
  });

  it("detects deployment returnTo", () => {
    const { result } = setup({
      pathname: "/foo",
      search: "",
      stackReturnTo: "/deployments/123?tab=logs"
    });

    expect(result.current.isDeploymentReturnTo).toBe(true);
  });

  it("falls back to defaultReturnTo when window is unavailable", () => {
    const { result, routerPush, getReturnTo } = setup({
      windowAvailable: false,
      defaultReturnTo: "/fallback",
      stackReturnTo: "/should-not-be-used"
    });

    expect(result.current.returnTo).toBe("/fallback");
    expect(getReturnTo).not.toHaveBeenCalled();

    act(() => {
      result.current.navigateWithReturnTo("/login", { fromSignup: "true" });
    });

    expect(routerPush).toHaveBeenCalledWith("/login");
  });

  it("throws on navigateBack when returnTo is falsy", () => {
    const { result } = setup({
      windowAvailable: false,
      stackReturnTo: "/ignored"
    });

    expect(() => {
      result.current.navigateBack();
    }).toThrow("No returnTo found");
  });

  function setup(input?: { pathname?: string; search?: string; stackReturnTo?: string; defaultReturnTo?: string; windowAvailable?: boolean }) {
    jest.clearAllMocks();

    const pathname = input?.pathname ?? "/";
    const search = input?.search ?? "";
    const stackReturnTo = input?.stackReturnTo ?? "/";
    const windowAvailable = input?.windowAvailable ?? true;

    type Router = ReturnType<typeof DEPENDENCIES.useRouter>;
    const routerPush = jest.fn<ReturnType<Router["push"]>, Parameters<Router["push"]>>();
    const router = mock<Router>({ push: routerPush });
    const useRouter = () => router;

    const params = new URLSearchParams(search);
    const useSearchParams = () => params as unknown as ReadonlyURLSearchParams;

    const getReturnTo = jest.fn(() => stackReturnTo);
    const createReturnable = jest.fn(() => "/target");
    const urlReturnToStack = mock<UrlReturnToStack>({
      getReturnTo,
      createReturnable
    });

    const useServices = jest.fn(() => ({ urlReturnToStack })) as unknown as typeof DEPENDENCIES.useServices;

    const mockWindow = windowAvailable
      ? ({
          location: {
            pathname,
            search: search ? `?${search}` : ""
          }
        } as Window & typeof globalThis)
      : undefined;

    const result = renderHook(() =>
      useReturnTo({
        defaultReturnTo: input?.defaultReturnTo,
        dependencies: {
          ...DEPENDENCIES,
          useRouter,
          useSearchParams,
          useServices,
          window: mockWindow
        }
      })
    );

    return { ...result, routerPush, getReturnTo, createReturnable };
  }
});
