import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";

import { ProjectScopeProvider, useProjectScope } from "./ProjectScope";

import { renderHook } from "@testing-library/react";

describe(useProjectScope.name, () => {
  it("names no project outside a project page", () => {
    const { result } = renderHook(() => useProjectScope());

    expect(result.current).toBeNull();
  });

  it("names the project of the page it is rendered in", () => {
    const { result } = renderHook(() => useProjectScope(), {
      wrapper: ({ children }: PropsWithChildren) => <ProjectScopeProvider value="project-1">{children}</ProjectScopeProvider>
    });

    expect(result.current).toBe("project-1");
  });
});
