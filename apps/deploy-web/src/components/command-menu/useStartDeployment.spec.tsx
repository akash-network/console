import React from "react";
import type { usePopup } from "@akashnetwork/ui/context";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentStart } from "./useStartDeployment";
import { useStartDeployment } from "./useStartDeployment";

import { act, renderHook } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(useStartDeployment.name, () => {
  it.each<{ kind: DeploymentStart; url: string }>([
    { kind: "new-deployment", url: "/new-deployment" },
    { kind: "container", url: "/new-deployment/configure" },
    { kind: "linux", url: "/new-deployment/configure?vm=true" }
  ])("opens $url for $kind without asking anywhere but Configure", async ({ kind, url }) => {
    const { start, push, confirm, assign } = setup({ pathname: "/deployments" });

    await act(() => start(kind));

    expect(push).toHaveBeenCalledWith(url);
    expect(confirm).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not ask on the new deployment page", async () => {
    const { start, push, confirm } = setup({ pathname: "/new-deployment" });

    await act(() => start("container"));

    expect(confirm).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/new-deployment/configure");
  });

  it.each(["/new-deployment/configure", "/new-deployment/configure/123"])("asks before discarding the configuration on %s", async pathname => {
    const { start, confirm } = setup({ pathname, isConfirmed: false });

    await act(() => start("new-deployment"));

    expect(confirm).toHaveBeenCalledWith({
      title: "Leave this configuration?",
      message: "You'll start a new deployment, and your changes here won't carry over."
    });
  });

  it("leaves Configure for the new deployment page once confirmed", async () => {
    const { start, push, assign } = setup({ pathname: "/new-deployment/configure", isConfirmed: true });

    await act(() => start("new-deployment"));

    expect(push).toHaveBeenCalledWith("/new-deployment");
    expect(assign).not.toHaveBeenCalled();
  });

  it.each<{ kind: DeploymentStart; url: string }>([
    { kind: "container", url: "/new-deployment/configure" },
    { kind: "linux", url: "/new-deployment/configure?vm=true" }
  ])("reloads Configure from scratch for $kind once confirmed", async ({ kind, url }) => {
    const { start, push, assign } = setup({ pathname: "/new-deployment/configure", isConfirmed: true });

    await act(() => start(kind));

    expect(assign).toHaveBeenCalledWith(url);
    expect(push).not.toHaveBeenCalled();
  });

  it("stays on Configure when the user keeps their changes", async () => {
    const { start, push, assign } = setup({ pathname: "/new-deployment/configure", isConfirmed: false });

    await act(() => start("linux"));

    expect(push).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  function setup(input: { pathname: string; isConfirmed?: boolean }) {
    const push = vi.fn();
    const assign = vi.fn();
    const confirm = vi.fn(async () => input.isConfirmed ?? false);

    const { result } = renderHook(
      () =>
        useStartDeployment({
          useRouter: () => mock<AppRouterInstance>({ push }),
          usePathname: () => input.pathname,
          usePopup: () => mock<ReturnType<typeof usePopup>>({ confirm })
        }),
      {
        wrapper: ({ children }) => <TestContainerProvider services={{ windowLocation: () => mock<Location>({ assign }) }}>{children}</TestContainerProvider>
      }
    );

    return { start: result.current, push, assign, confirm };
  }
});
