import type { ReactNode } from "react";
import { createStore, Provider as JotaiProvider } from "jotai";
import { describe, expect, it } from "vitest";

import { addCreditsRequestAtom } from "@src/store/addCreditsStore";
import { useAddCredits } from "./useAddCredits";

import { act, renderHook } from "@testing-library/react";

describe(useAddCredits.name, () => {
  it("publishes the request so the app-wide host opens the sheet", () => {
    const { result, store } = setup();

    act(() => result.current({ initialTab: "coupon", context: "hackathon" }));

    expect(store.get(addCreditsRequestAtom)).toEqual({ initialTab: "coupon", context: "hackathon" });
  });

  it("publishes an empty request when the call site has no preference", () => {
    const { result, store } = setup();

    act(() => result.current());

    expect(store.get(addCreditsRequestAtom)).toEqual({});
  });

  function setup() {
    const store = createStore();
    const wrapper = ({ children }: { children: ReactNode }) => <JotaiProvider store={store}>{children}</JotaiProvider>;

    return { ...renderHook(() => useAddCredits(), { wrapper }), store };
  }
});
