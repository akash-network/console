import { describe, expect, it, vi } from "vitest";

import { useResumeAfterCredits } from "./useResumeAfterCredits";

import { renderHook } from "@testing-library/react";

describe(useResumeAfterCredits.name, () => {
  it("resumes while the refusal the credits were bought for still stands", () => {
    const { result, resume } = setup({ isRefusedForFunds: true });

    result.current();

    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("leaves a user who has moved past the refusal alone", () => {
    const { result, resume, rerender } = setup({ isRefusedForFunds: true });

    rerender({ isRefusedForFunds: false, resume });
    result.current();

    expect(resume).not.toHaveBeenCalled();
  });

  it("does nothing once the page that asked for the credits is gone", () => {
    const { result, resume, unmount } = setup({ isRefusedForFunds: true });

    unmount();
    result.current();

    expect(resume).not.toHaveBeenCalled();
  });

  it("runs the latest resume rather than the one captured when the sheet opened", () => {
    const { result, resume, rerender } = setup({ isRefusedForFunds: true });
    const latestResume = vi.fn();
    const callbackHandedToTheSheet = result.current;

    rerender({ isRefusedForFunds: true, resume: latestResume });
    callbackHandedToTheSheet();

    expect(latestResume).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
  });

  it("keeps handing out the same callback across renders", () => {
    const { result, resume, rerender } = setup({ isRefusedForFunds: true });
    const firstCallback = result.current;

    rerender({ isRefusedForFunds: false, resume });

    expect(result.current).toBe(firstCallback);
  });

  it("resumes a request left as it was at the refusal", () => {
    const { result, resume } = setup({ isRefusedForFunds: true, request: "sdl" });

    result.current();

    expect(resume).toHaveBeenCalledTimes(1);
  });

  it("leaves a request alone once the user has edited it since the refusal", () => {
    const { result, resume, editRequest } = setup({ isRefusedForFunds: true, request: "sdl" });

    editRequest("edited sdl");
    result.current();

    expect(resume).not.toHaveBeenCalled();
  });

  it("compares against the request as it stood at the latest refusal", () => {
    const { result, resume, rerender, editRequest, snapshotRequest } = setup({ isRefusedForFunds: true, request: "sdl" });

    rerender({ isRefusedForFunds: false, snapshotRequest, resume });
    editRequest("edited sdl");
    rerender({ isRefusedForFunds: true, snapshotRequest, resume });
    result.current();

    expect(resume).toHaveBeenCalledTimes(1);
  });

  function setup(input: { isRefusedForFunds: boolean; request?: string }) {
    const resume = vi.fn();
    let currentRequest = input.request;
    const snapshotRequest = input.request === undefined ? undefined : () => currentRequest ?? "";
    const initialProps: Parameters<typeof useResumeAfterCredits>[0] = { isRefusedForFunds: input.isRefusedForFunds, snapshotRequest, resume };
    const hook = renderHook(props => useResumeAfterCredits(props), { initialProps });
    return {
      ...hook,
      resume,
      snapshotRequest,
      editRequest: (request: string) => {
        currentRequest = request;
      }
    };
  }
});
