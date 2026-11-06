import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useFollowDeployment";
import { useFollowDeployment } from "./useFollowDeployment";

import { renderHook } from "@testing-library/react";

describe(useFollowDeployment.name, () => {
  it("takes the user to the deployment", () => {
    const { result, router } = setup({ pathname: "/new-deployment" });

    result.current("42");

    expect(router.push).toHaveBeenCalledWith("/deployments/42");
  });

  it("stays put when the user already looks at that deployment", () => {
    const { result, router } = setup({ pathname: "/deployments/42" });

    result.current("42");

    expect(router.push).not.toHaveBeenCalled();
  });

  it("goes by the page the user is on when the action finishes", () => {
    const { result, router, rerenderAt } = setup({ pathname: "/new-deployment" });
    const follow = result.current;

    rerenderAt("/deployments/42");
    follow("42");

    expect(router.push).not.toHaveBeenCalled();
  });

  function setup(input: { pathname: string }) {
    let pathname = input.pathname;
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    const dependencies: typeof DEPENDENCIES = { useRouter: () => router, usePathname: () => pathname };
    const hook = renderHook(() => useFollowDeployment(dependencies));
    const rerenderAt = (nextPathname: string) => {
      pathname = nextPathname;
      hook.rerender();
    };

    return { ...hook, router, rerenderAt };
  }
});
