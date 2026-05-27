import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UseProviderCredentialsResult } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { useProviderAccess } from "./useProviderAccess";

import { renderHook } from "@testing-library/react";

describe(useProviderAccess.name, () => {
  it("returns false while credentials are not usable", () => {
    const { result } = setup({ usable: false });

    expect(result.current).toBe(false);
  });

  it("returns true when credentials are usable from the start", () => {
    const { result } = setup({ usable: true });

    expect(result.current).toBe(true);
  });

  it("flips to true once credentials become usable", () => {
    const { result, rerender } = setup({ usable: false });
    expect(result.current).toBe(false);

    rerender({ credentials: buildCredentials({ usable: true }) });

    expect(result.current).toBe(true);
  });

  it("stays true after credentials become unusable again", () => {
    const { result, rerender } = setup({ usable: true });
    expect(result.current).toBe(true);

    rerender({ credentials: buildCredentials({ usable: false }) });

    expect(result.current).toBe(true);
  });

  function buildCredentials(input: { usable: boolean }) {
    return mock<UseProviderCredentialsResult>({
      details: mock<UseProviderCredentialsResult["details"]>({
        usable: input.usable,
        error: null
      })
    });
  }

  function setup(input: { usable: boolean }) {
    return renderHook(({ credentials }) => useProviderAccess(credentials), {
      initialProps: { credentials: buildCredentials(input) }
    });
  }
});
