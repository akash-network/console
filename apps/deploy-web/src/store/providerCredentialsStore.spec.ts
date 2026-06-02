import { createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";

import providerCredentialsStore from "./providerCredentialsStore";

describe("providerCredentialsStore", () => {
  describe("claimInFlightTokenRequest", () => {
    it("creates and stores a new promise when nothing is in flight", () => {
      const { store } = setup();
      const promise = Promise.resolve("token-1");
      const createPromise = vi.fn().mockReturnValue(promise);

      const result = store.set(providerCredentialsStore.claimInFlightTokenRequest, { address: "akash1aaa", createPromise });

      expect(result).toBe(promise);
      expect(createPromise).toHaveBeenCalledTimes(1);
      expect(store.get(providerCredentialsStore.inFlightTokenRequest)).toEqual({ address: "akash1aaa", promise });
    });

    it("returns the existing promise when the address matches", () => {
      const { store } = setup();
      const existing = Promise.resolve("existing-token");
      store.set(providerCredentialsStore.inFlightTokenRequest, { address: "akash1aaa", promise: existing });
      const createPromise = vi.fn();

      const result = store.set(providerCredentialsStore.claimInFlightTokenRequest, { address: "akash1aaa", createPromise });

      expect(result).toBe(existing);
      expect(createPromise).not.toHaveBeenCalled();
    });

    it("creates a new promise and overwrites when the address differs", () => {
      const { store } = setup();
      const existing = Promise.resolve("existing-token");
      store.set(providerCredentialsStore.inFlightTokenRequest, { address: "akash1aaa", promise: existing });
      const newPromise = Promise.resolve("new-token");
      const createPromise = vi.fn().mockReturnValue(newPromise);

      const result = store.set(providerCredentialsStore.claimInFlightTokenRequest, { address: "akash1bbb", createPromise });

      expect(result).toBe(newPromise);
      expect(createPromise).toHaveBeenCalledTimes(1);
      expect(store.get(providerCredentialsStore.inFlightTokenRequest)).toEqual({ address: "akash1bbb", promise: newPromise });
    });

    it("only calls createPromise once for parallel claims at the same address", () => {
      const { store } = setup();
      const promise = Promise.resolve("token");
      const createPromise = vi.fn().mockReturnValue(promise);

      const first = store.set(providerCredentialsStore.claimInFlightTokenRequest, { address: "akash1aaa", createPromise });
      const second = store.set(providerCredentialsStore.claimInFlightTokenRequest, { address: "akash1aaa", createPromise });

      expect(first).toBe(second);
      expect(createPromise).toHaveBeenCalledTimes(1);
    });
  });

  describe("releaseInFlightTokenRequest", () => {
    it("clears the in-flight entry when the released promise matches", () => {
      const { store } = setup();
      const promise = Promise.resolve("token");
      store.set(providerCredentialsStore.inFlightTokenRequest, { address: "akash1aaa", promise });

      store.set(providerCredentialsStore.releaseInFlightTokenRequest, promise);

      expect(store.get(providerCredentialsStore.inFlightTokenRequest)).toBeNull();
    });

    it("leaves the in-flight entry intact when a different promise is released", () => {
      const { store } = setup();
      const currentPromise = Promise.resolve("current");
      const otherPromise = Promise.resolve("other");
      const current = { address: "akash1aaa", promise: currentPromise };
      store.set(providerCredentialsStore.inFlightTokenRequest, current);

      store.set(providerCredentialsStore.releaseInFlightTokenRequest, otherPromise);

      expect(store.get(providerCredentialsStore.inFlightTokenRequest)).toEqual(current);
    });

    it("is a no-op when nothing is in flight", () => {
      const { store } = setup();
      const promise = Promise.resolve("token");

      store.set(providerCredentialsStore.releaseInFlightTokenRequest, promise);

      expect(store.get(providerCredentialsStore.inFlightTokenRequest)).toBeNull();
    });
  });

  describe("clearInFlightTokenRequestForOtherAddress", () => {
    it("clears the in-flight entry when the stored address differs", () => {
      const { store } = setup();
      store.set(providerCredentialsStore.inFlightTokenRequest, { address: "akash1aaa", promise: Promise.resolve("token") });

      store.set(providerCredentialsStore.clearInFlightTokenRequestForOtherAddress, "akash1bbb");

      expect(store.get(providerCredentialsStore.inFlightTokenRequest)).toBeNull();
    });

    it("preserves the in-flight entry when the stored address matches", () => {
      const { store } = setup();
      const current = { address: "akash1aaa", promise: Promise.resolve("token") };
      store.set(providerCredentialsStore.inFlightTokenRequest, current);

      store.set(providerCredentialsStore.clearInFlightTokenRequestForOtherAddress, "akash1aaa");

      expect(store.get(providerCredentialsStore.inFlightTokenRequest)).toEqual(current);
    });

    it("is a no-op when nothing is in flight", () => {
      const { store } = setup();

      store.set(providerCredentialsStore.clearInFlightTokenRequestForOtherAddress, "akash1aaa");

      expect(store.get(providerCredentialsStore.inFlightTokenRequest)).toBeNull();
    });
  });

  function setup() {
    return { store: createStore() };
  }
});
