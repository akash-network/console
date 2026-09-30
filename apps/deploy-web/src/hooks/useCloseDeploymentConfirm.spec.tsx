import { createProxy } from "@akashnetwork/react-query-proxy";
import { createStore, Provider as JotaiProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import { closeDeploymentRequestAtom } from "@src/store/closeDeploymentStore";
import { useCloseDeploymentConfirm } from "./useCloseDeploymentConfirm";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe(useCloseDeploymentConfirm.name, () => {
  it("asks the app-wide host to confirm the close and resolves with its answer", async () => {
    const { result, store } = setup();

    let answer: Promise<unknown> = Promise.resolve();
    act(() => {
      answer = result.current.confirmCloseDeployment({ dseqs: ["1786440078202"], name: "my-service" });
    });
    const request = store.get(closeDeploymentRequestAtom);
    request?.resolve({ closeReason: "no_longer_needed" });

    expect(request?.target).toEqual({ dseqs: ["1786440078202"], name: "my-service" });
    await expect(answer).resolves.toEqual({ closeReason: "no_longer_needed" });
  });

  it("records the reason on the settings of every closed deployment", async () => {
    const { result, updateDeploymentSetting } = setup();
    const reason = { closeReason: "other", closeReasonDetails: "Moved to our own cluster" } as const;

    act(() => result.current.recordCloseReason(["1", "2"], reason));

    await vi.waitFor(() => expect(updateDeploymentSetting).toHaveBeenCalledTimes(2));
    expect(updateDeploymentSetting).toHaveBeenCalledWith({ dseq: "1", data: reason });
    expect(updateDeploymentSetting).toHaveBeenCalledWith({ dseq: "2", data: reason });
  });

  function setup() {
    const store = createStore();
    const updateDeploymentSetting = vi.fn().mockResolvedValue({ data: {} });
    const api = createProxy({ v2: { updateDeploymentSetting } }) as unknown as AppDIContainer["api"];

    const { result } = setupQuery(() => useCloseDeploymentConfirm(), {
      services: { api: () => api },
      wrapper: ({ children }) => <JotaiProvider store={store}>{children}</JotaiProvider>
    });

    return { result, store, updateDeploymentSetting };
  }
});
