import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useActionCardDecision";
import { useActionCardDecision } from "./useActionCardDecision";

import { act, renderHook } from "@testing-library/react";

describe(useActionCardDecision.name, () => {
  it("starts pending", () => {
    const { result } = setup({});

    expect(result.current.status).toBe("pending");
    expect(result.current.error).toBeNull();
  });

  it("runs the action on confirm and records that it succeeded", async () => {
    const { result, recordResult } = setup({});
    const run = vi.fn(async () => {});

    await act(() => result.current.confirm(run));

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("succeeded");
    expect(recordResult).toHaveBeenCalledWith({
      id: "c-1",
      data: { proposalId: "p-1", actionType: "send_manifest_again", decision: "confirmed", outcome: "succeeded" }
    });
  });

  it("follows the deployment the action acts on once it succeeds", async () => {
    const { result, followDeployment } = setup({ dseq: "42" });
    expect(result.current.deploymentDseq).toBeNull();

    await act(() => result.current.confirm(async () => {}));

    expect(result.current.deploymentDseq).toBe("42");
    expect(followDeployment).toHaveBeenCalledWith("42");
  });

  it("follows the deployment a confirm run created over the one the action named", async () => {
    const { result, followDeployment } = setup({ dseq: "42" });

    await act(() => result.current.confirm(async () => ({ dseq: "99" })));

    expect(result.current.deploymentDseq).toBe("99");
    expect(followDeployment).toHaveBeenCalledWith("99");
  });

  it("does not follow the deployment once the card is gone, as when the panel closed while the action ran", async () => {
    const { result, followDeployment, unmount } = setup({ dseq: "42" });
    const run = Promise.withResolvers<void>();
    let confirming: Promise<void> | undefined;
    act(() => {
      confirming = result.current.confirm(() => run.promise);
    });

    unmount();
    run.resolve();
    await confirming;

    expect(followDeployment).not.toHaveBeenCalled();
  });

  it("still links the deployment when nothing follows it", async () => {
    const { result } = setup({ dseq: "42", isFollowing: false });

    await act(() => result.current.confirm(async () => {}));

    expect(result.current.deploymentDseq).toBe("42");
  });

  it("follows nothing when the action fails or names no deployment", async () => {
    const failed = setup({ dseq: "42" });
    await act(() => failed.result.current.confirm(() => Promise.reject(new Error("Nope"))));
    expect(failed.result.current.deploymentDseq).toBeNull();
    expect(failed.followDeployment).not.toHaveBeenCalled();

    const withoutDeployment = setup({});
    await act(() => withoutDeployment.result.current.confirm(async () => {}));
    expect(withoutDeployment.result.current.deploymentDseq).toBeNull();
    expect(withoutDeployment.followDeployment).not.toHaveBeenCalled();
  });

  it("shows the api's message when the action fails and records the failure", async () => {
    const { result, recordResult } = setup({});

    await act(() => result.current.confirm(() => Promise.reject(new ApiError(400, { message: "The deployment is closed" }, "POST → 400"))));

    expect(result.current.status).toBe("failed");
    expect(result.current.error).toBe("The deployment is closed");
    expect(recordResult).toHaveBeenCalledWith({
      id: "c-1",
      data: expect.objectContaining({ decision: "confirmed", outcome: "failed", error: "The deployment is closed" })
    });
  });

  it("falls back to the error's own message, then to a generic one, and caps what it records", async () => {
    const { result, recordResult } = setup({});

    await act(() => result.current.confirm(() => Promise.reject(new Error("x".repeat(600)))));
    expect(result.current.error).toHaveLength(600);
    expect(recordResult.mock.lastCall?.[0].data.error).toHaveLength(500);

    await act(() => result.current.confirm(() => Promise.reject(new Error(""))));
    expect(result.current.error).toBe("Something went wrong. Try again in a moment.");

    await act(() => result.current.confirm(() => Promise.reject("not an error")));
    expect(result.current.error).toBe("Something went wrong. Try again in a moment.");
  });

  it("clears the previous error while trying again", async () => {
    const { result } = setup({});
    await act(() => result.current.confirm(() => Promise.reject(new Error("Nope"))));
    const retry = Promise.withResolvers<void>();

    act(() => void result.current.confirm(() => retry.promise));

    expect(result.current.status).toBe("running");
    expect(result.current.error).toBeNull();
    await act(async () => retry.resolve());
  });

  it("records a cancel", () => {
    const { result, recordResult } = setup({});

    act(() => result.current.cancel());

    expect(result.current.status).toBe("cancelled");
    expect(recordResult).toHaveBeenCalledWith({ id: "c-1", data: { proposalId: "p-1", actionType: "send_manifest_again", decision: "cancelled" } });
  });

  it("records an opened deep link as confirmed and done", () => {
    const { result, recordResult } = setup({});

    act(() => result.current.markOpened());

    expect(result.current.status).toBe("succeeded");
    expect(recordResult).toHaveBeenCalledWith({ id: "c-1", data: expect.objectContaining({ decision: "confirmed", outcome: "succeeded" }) });
  });

  it("records nothing without a conversation and never fails the card when recording fails", async () => {
    const withoutConversation = setup({ conversationId: null });
    act(() => withoutConversation.result.current.cancel());
    expect(withoutConversation.recordResult).not.toHaveBeenCalled();

    const failingRecord = setup({});
    failingRecord.recordResult.mockRejectedValue(new Error("offline"));
    await act(() => failingRecord.result.current.confirm(async () => {}));
    expect(failingRecord.result.current.status).toBe("succeeded");
  });

  function setup(input: { conversationId?: string | null; dseq?: string; isFollowing?: boolean }) {
    const followDeployment = vi.fn();
    const recordResult = vi.fn(async (_input: { id: string; data: Record<string, unknown> }) => ({ data: { recorded: true } }));
    const dependencies: typeof DEPENDENCIES = {
      useRecordAssistantActionResultMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useRecordAssistantActionResultMutation>>({ mutateAsync: recordResult as never })
    };

    const hook = renderHook(() =>
      useActionCardDecision(
        {
          conversationId: input.conversationId === undefined ? "c-1" : input.conversationId,
          proposalId: "p-1",
          actionType: "send_manifest_again",
          dseq: input.dseq,
          followDeployment: input.isFollowing === false ? undefined : followDeployment
        },
        dependencies
      )
    );

    return { ...hook, recordResult, followDeployment };
  }
});
