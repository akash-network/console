import { describe, expect, it, vi } from "vitest";

import { notifyEach } from "./notify-each";

describe(notifyEach.name, () => {
  it("sends to every contact", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const onFailure = vi.fn();

    await notifyEach(["alice", "bob"], send, onFailure);

    expect(send.mock.calls).toEqual([["alice"], ["bob"]]);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("keeps sending after a failed send and reports it without failing", async () => {
    const error = new Error("notifications unavailable");
    const send = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
    const onFailure = vi.fn();

    await notifyEach(["alice", "bob"], send, onFailure);

    expect(send).toHaveBeenCalledWith("bob");
    expect(onFailure).toHaveBeenCalledExactlyOnceWith("alice", error);
  });

  it("fails with the last error when no contact was reached", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("first")).mockRejectedValueOnce(new Error("last"));
    const onFailure = vi.fn();

    await expect(notifyEach(["alice", "bob"], send, onFailure)).rejects.toThrow("last");
    expect(onFailure).toHaveBeenCalledTimes(2);
  });

  it("does nothing for no contacts", async () => {
    const send = vi.fn();

    await expect(notifyEach([], send, vi.fn())).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});
