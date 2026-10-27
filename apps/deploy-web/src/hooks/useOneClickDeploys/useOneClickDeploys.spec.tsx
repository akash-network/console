import type { PropsWithChildren } from "react";
import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";

import { useOneClickDeploys, useRecordOneClickDeploy } from "./useOneClickDeploys";

import { act, renderHook } from "@testing-library/react";

describe(useOneClickDeploys.name, () => {
  it("knows no one-click deploy before this tab sent one", () => {
    const { result } = setup();

    expect(result.current.oneClickDeploys.size).toBe(0);
  });

  it("keeps the link that runs each recorded deploy again, by deployment", () => {
    const { result } = setup();

    act(() => result.current.record("1000", "/new-deployment/configure?templateId=hello-world"));
    act(() => result.current.record("2000", "/new-deployment/configure?templateId=llama"));

    expect([...result.current.oneClickDeploys]).toEqual([
      ["1000", "/new-deployment/configure?templateId=hello-world"],
      ["2000", "/new-deployment/configure?templateId=llama"]
    ]);
  });

  function setup() {
    const store = createStore();

    return renderHook(() => ({ oneClickDeploys: useOneClickDeploys(), record: useRecordOneClickDeploy() }), {
      wrapper: ({ children }: PropsWithChildren) => <Provider store={store}>{children}</Provider>
    });
  }
});
