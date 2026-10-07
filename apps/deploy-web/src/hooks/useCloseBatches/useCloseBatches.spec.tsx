import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";

import { useCloseBatchesBeingSent, useSendCloseBatch } from "./useCloseBatches";

import { act, renderHook } from "@testing-library/react";

describe(useSendCloseBatch.name, () => {
  it("names each bulk close with a fresh UUID", async () => {
    const { result } = setup();
    const batchIds: string[] = [];

    await act(async () => {
      await result.current.sendCloseBatch(async batchId => batchIds.push(batchId));
      await result.current.sendCloseBatch(async batchId => batchIds.push(batchId));
    });

    expect(batchIds).toHaveLength(2);
    expect(batchIds[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(batchIds[0]).not.toBe(batchIds[1]);
  });

  it("reports a bulk close as being sent until its requests have all answered", async () => {
    const { result } = setup();
    let answer: (value: string) => void = () => undefined;
    let sending: Promise<string> = Promise.resolve("");
    let batchId = "";

    act(() => {
      sending = result.current.sendCloseBatch(id => {
        batchId = id;
        return new Promise<string>(resolve => (answer = resolve));
      });
    });
    const whileSending = result.current.beingSent;
    await act(async () => {
      answer("answered");
      await sending;
    });

    expect(whileSending).toEqual(new Set([batchId]));
    expect(result.current.beingSent).toEqual(new Set());
    await expect(sending).resolves.toBe("answered");
  });

  it("stops reporting a bulk close as being sent when sending it fails", async () => {
    const { result } = setup();
    const failure = new Error("offline");

    await act(async () => {
      await expect(result.current.sendCloseBatch(async () => Promise.reject(failure))).rejects.toBe(failure);
    });

    expect(result.current.beingSent).toEqual(new Set());
  });

  it("keeps a bulk close being sent while another one finishes", async () => {
    const { result } = setup();
    let firstBatchId = "";

    act(() => {
      void result.current.sendCloseBatch(id => {
        firstBatchId = id;
        return new Promise(() => undefined);
      });
    });
    await act(async () => {
      await result.current.sendCloseBatch(async () => undefined);
    });

    expect(result.current.beingSent).toEqual(new Set([firstBatchId]));
  });

  function setup() {
    const store = createStore();

    return renderHook(() => ({ sendCloseBatch: useSendCloseBatch(), beingSent: useCloseBatchesBeingSent() }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    });
  }
});
