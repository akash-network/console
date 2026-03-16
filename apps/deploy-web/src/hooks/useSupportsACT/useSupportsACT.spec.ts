import { describe, expect, it } from "vitest";

import type { SettingsContextType } from "@src/context/SettingsProvider";
import { useSupportsACT } from "./useSupportsACT";

import { renderHook } from "@testing-library/react";

describe(useSupportsACT.name, () => {
  it("returns true when appVersion is 2.0.0", () => {
    const { result } = setup({ appVersion: "2.0.0" });
    expect(result.current).toBe(true);
  });

  it("returns true when appVersion is greater than 2.0.0", () => {
    const { result } = setup({ appVersion: "2.1.0" });
    expect(result.current).toBe(true);
  });

  it("returns false when appVersion is less than 2.0.0", () => {
    const { result } = setup({ appVersion: "1.9.9" });
    expect(result.current).toBe(false);
  });

  it("returns false when appVersion is undefined", () => {
    const { result } = setup({ appVersion: undefined });
    expect(result.current).toBe(false);
  });

  it("returns false when selectedNode is null", () => {
    const { result } = setup({ selectedNode: null });
    expect(result.current).toBe(false);
  });

  it("returns true when isCustomNode and customNode appVersion is 2.0.0", () => {
    const { result } = setup({ isCustomNode: true, customNode: { appVersion: "2.0.0" } });
    expect(result.current).toBe(true);
  });

  it("returns true when isCustomNode and customNode appVersion is greater than 2.0.0", () => {
    const { result } = setup({ isCustomNode: true, customNode: { appVersion: "2.1.0" } });
    expect(result.current).toBe(true);
  });

  it("returns false when isCustomNode and customNode appVersion is less than 2.0.0", () => {
    const { result } = setup({ isCustomNode: true, customNode: { appVersion: "1.9.9" } });
    expect(result.current).toBe(false);
  });

  it("returns false when isCustomNode and customNode is null", () => {
    const { result } = setup({ isCustomNode: true, customNode: null });
    expect(result.current).toBe(false);
  });

  it("returns false when isCustomNode and customNode appVersion is undefined", () => {
    const { result } = setup({ isCustomNode: true, customNode: { appVersion: undefined } });
    expect(result.current).toBe(false);
  });

  function setup(input?: { appVersion?: string; selectedNode?: null; isCustomNode?: boolean; customNode?: { appVersion?: string } | null }) {
    const selectedNode =
      input?.selectedNode === null ? null : { api: "", rpc: "", status: "", latency: 0, id: "", nodeInfo: null, appVersion: input?.appVersion };
    const customNode =
      input?.customNode === null
        ? null
        : input?.customNode
          ? { api: "", rpc: "", status: "", id: "", nodeInfo: null, appVersion: input.customNode.appVersion }
          : null;

    const { result } = renderHook(() =>
      useSupportsACT({
        dependencies: {
          useSettings: () =>
            ({
              settings: {
                apiEndpoint: "",
                rpcEndpoint: "",
                isCustomNode: input?.isCustomNode ?? false,
                nodes: [],
                selectedNode,
                customNode,
                isBlockchainDown: false
              }
            }) as unknown as SettingsContextType
        }
      })
    );

    return { result };
  }
});
