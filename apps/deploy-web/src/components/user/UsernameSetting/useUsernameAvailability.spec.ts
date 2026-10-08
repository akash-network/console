import type { HttpClient } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { useUsernameAvailability } from "./useUsernameAvailability";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

describe(useUsernameAvailability.name, () => {
  it("skips the check when there is no username to check", () => {
    const { result, consoleApiHttpClient } = setup({ username: undefined });

    expect(result.current).toEqual({ isChecking: false, isAvailable: undefined });
    expect(consoleApiHttpClient.get).not.toHaveBeenCalled();
  });

  it("reports whether the username is free", async () => {
    const { result, consoleApiHttpClient } = setup({ username: "alice-dev", isAvailable: true });

    expect(result.current).toEqual({ isChecking: true, isAvailable: undefined });
    await vi.waitFor(() => expect(result.current).toEqual({ isChecking: false, isAvailable: true }));
    expect(consoleApiHttpClient.get).toHaveBeenCalledWith("/v1/user/checkUsernameAvailability/alice-dev");
  });

  it("reports a taken username", async () => {
    const { result } = setup({ username: "alice", isAvailable: false });

    await vi.waitFor(() => expect(result.current).toEqual({ isChecking: false, isAvailable: false }));
  });

  it("waits for typing to pause before checking the next username", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result, rerender, consoleApiHttpClient } = setup({ username: "alice", isAvailable: true });
    await vi.waitFor(() => expect(result.current).toEqual({ isChecking: false, isAvailable: true }));

    rerender({ username: "alice-d" });

    expect(result.current).toEqual({ isChecking: true, isAvailable: undefined });
    expect(consoleApiHttpClient.get).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(500));

    await vi.waitFor(() => expect(result.current).toEqual({ isChecking: false, isAvailable: true }));
    expect(consoleApiHttpClient.get).toHaveBeenLastCalledWith("/v1/user/checkUsernameAvailability/alice-d");
    vi.useRealTimers();
  });

  it("stops reporting once the username is cleared", async () => {
    const { result, rerender } = setup({ username: "alice", isAvailable: true });
    await vi.waitFor(() => expect(result.current.isAvailable).toBe(true));

    rerender({ username: undefined });

    expect(result.current).toEqual({ isChecking: false, isAvailable: undefined });
  });

  it("encodes the username into the request path", async () => {
    const { consoleApiHttpClient } = setup({ username: "a/b" });

    await vi.waitFor(() => expect(consoleApiHttpClient.get).toHaveBeenCalledWith("/v1/user/checkUsernameAvailability/a%2Fb"));
  });

  function setup(input: { username: string | undefined; isAvailable?: boolean }) {
    const consoleApiHttpClient = mock<HttpClient>();
    consoleApiHttpClient.get.mockResolvedValue({ data: { isAvailable: input.isAvailable ?? true } });
    let username = input.username;
    const { result, rerender } = setupQuery(() => useUsernameAvailability(username), {
      services: { consoleApiHttpClient: () => consoleApiHttpClient }
    });

    return {
      result,
      consoleApiHttpClient,
      rerender: (props: { username: string | undefined }) => {
        username = props.username;
        rerender();
      }
    };
  }
});
