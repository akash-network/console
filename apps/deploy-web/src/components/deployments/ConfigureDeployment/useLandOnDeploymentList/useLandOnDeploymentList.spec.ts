import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useLandOnDeploymentList";
import { useLandOnDeploymentList } from "./useLandOnDeploymentList";

import { renderHook, waitFor } from "@testing-library/react";

describe(useLandOnDeploymentList.name, () => {
  it("stays put until the api took a deploy on", () => {
    const { replace, checkSession } = setup({ acceptedDseq: null });

    expect(replace).not.toHaveBeenCalled();
    expect(checkSession).not.toHaveBeenCalled();
  });

  it("lands the user on the deployments list once the api takes the deploy on", async () => {
    const { replace, rerender } = setup({ acceptedDseq: null });

    rerender({ acceptedDseq: "1000", isOnboarded: true });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/deployments"));
  });

  it("lands an onboarded user on the deployments list without reading their profile again", async () => {
    const { replace, checkSession } = setup({ acceptedDseq: "1000", isOnboarded: true });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/deployments"));
    expect(checkSession).not.toHaveBeenCalled();
  });

  it("reads a new user's profile again before landing them on the deployments list", async () => {
    const events: string[] = [];
    const { replace } = setup({
      acceptedDseq: "1000",
      isOnboarded: false,
      checkSession: async () => {
        events.push("checkSession");
      },
      onReplace: url => events.push(`replace ${url}`)
    });

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(events).toEqual(["checkSession", "replace /deployments"]);
  });

  it("still lands the user on the deployments list when their profile cannot be read again", async () => {
    const { replace } = setup({ acceptedDseq: "1000", isOnboarded: false, checkSession: () => Promise.reject(new Error("offline")) });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/deployments"));
  });

  it("lands only once for the same deploy, even once the profile says the user is onboarded", async () => {
    const { replace, rerender } = setup({ acceptedDseq: "1000", isOnboarded: false });
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));

    rerender({ acceptedDseq: "1000", isOnboarded: true });

    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
  });

  function setup(input: { acceptedDseq: string | null; isOnboarded?: boolean; checkSession?: () => Promise<void>; onReplace?: (url: string) => void }) {
    const replace = vi.fn((url: string) => input.onReplace?.(url));
    const checkSession = vi.fn(input.checkSession ?? (async () => undefined));
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace });
    const user = mock<ReturnType<typeof DEPENDENCIES.useUser>>({ checkSession });

    const view = renderHook(
      ({ acceptedDseq, isOnboarded }: { acceptedDseq: string | null; isOnboarded: boolean }) =>
        useLandOnDeploymentList(acceptedDseq, {
          useRouter: () => router,
          useUser: () => user,
          useIsOnboarded: () => isOnboarded
        }),
      { initialProps: { acceptedDseq: input.acceptedDseq, isOnboarded: input.isOnboarded ?? true } }
    );

    return { ...view, replace, checkSession };
  }
});
