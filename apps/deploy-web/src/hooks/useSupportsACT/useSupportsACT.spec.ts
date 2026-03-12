import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SettingsContextType } from "@src/context/SettingsProvider";
import type { NodeStatus } from "@src/types/node";
import { useSupportsACT } from "./useSupportsACT";

import { renderHook } from "@testing-library/react";

describe(useSupportsACT.name, () => {
  it("returns true when network is testnet-8", () => {
    const { result } = setup({ network: "testnet-8" });
    expect(result.current).toBe(true);
  });

  it("returns true when network is testnet-oracle", () => {
    const { result } = setup({ network: "testnet-oracle" });
    expect(result.current).toBe(true);
  });

  it("returns false when network is mainnet", () => {
    const { result } = setup({ network: "mainnet" });
    expect(result.current).toBe(false);
  });

  it("returns false when selectedNode is null", () => {
    const { result } = setup({ selectedNode: null });
    expect(result.current).toBe(false);
  });

  it("returns false when nodeInfo is null", () => {
    const { result } = setup({ nodeInfo: null });
    expect(result.current).toBe(false);
  });

  function setup(input?: { network?: string; selectedNode?: null; nodeInfo?: null }) {
    const nodeInfo =
      input?.selectedNode === null || input?.nodeInfo === null ? null : mock<NodeStatus>({ node_info: { network: input?.network ?? "mainnet" } });

    const selectedNode = input?.selectedNode === null ? null : { api: "", rpc: "", status: "", latency: 0, id: "", nodeInfo };

    const { result } = renderHook(() =>
      useSupportsACT({
        dependencies: {
          useSettings: () =>
            ({
              settings: mock({
                selectedNode
              })
            }) as SettingsContextType
        }
      })
    );

    return { result };
  }
});
