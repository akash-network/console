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

  function setup(input?: { appVersion?: string; selectedNode?: null }) {
    const selectedNode =
      input?.selectedNode === null ? null : { api: "", rpc: "", status: "", latency: 0, id: "", nodeInfo: null, appVersion: input?.appVersion };

    const { result } = renderHook(() =>
      useSupportsACT({
        dependencies: {
          useSettings: () =>
            ({
              settings: {
                apiEndpoint: "",
                rpcEndpoint: "",
                isCustomNode: false,
                nodes: [],
                selectedNode,
                customNode: null,
                isBlockchainDown: false
              }
            }) as unknown as SettingsContextType
        }
      })
    );

    return { result };
  }
});
