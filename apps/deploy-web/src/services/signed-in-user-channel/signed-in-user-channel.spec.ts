import { describe, expect, it, vi } from "vitest";

import { SignedInUserChannel } from "./signed-in-user-channel";

import { waitFor } from "@testing-library/react";

describe(SignedInUserChannel.name, () => {
  it("delivers a user announced in one tab to the others", async () => {
    const { thisTab, otherTab, close } = setup();
    const listener = vi.fn();
    otherTab.subscribe(listener);

    thisTab.announce("user-a");

    await waitFor(() => expect(listener).toHaveBeenCalledWith("user-a"));
    close();
  });

  it("ignores messages that are not a user id", async () => {
    const { otherTab, rawChannel, close } = setup();
    const listener = vi.fn();
    otherTab.subscribe(listener);

    rawChannel.postMessage({ userId: "user-a" });
    rawChannel.postMessage("user-b");

    await waitFor(() => expect(listener).toHaveBeenCalledWith("user-b"));
    expect(listener).toHaveBeenCalledTimes(1);
    close();
  });

  it("stops delivering once unsubscribed", async () => {
    const { thisTab, otherTab, close } = setup();
    const listener = vi.fn();
    const probe = vi.fn();
    const unsubscribe = otherTab.subscribe(listener);
    otherTab.subscribe(probe);

    unsubscribe();
    thisTab.announce("user-a");

    await waitFor(() => expect(probe).toHaveBeenCalledWith("user-a"));
    expect(listener).not.toHaveBeenCalled();
    close();
  });

  function setup() {
    const name = `signed-in-user-${crypto.randomUUID()}`;
    const channels = [new BroadcastChannel(name), new BroadcastChannel(name), new BroadcastChannel(name)];

    return {
      thisTab: new SignedInUserChannel(channels[0]),
      otherTab: new SignedInUserChannel(channels[1]),
      rawChannel: channels[2],
      close: () => channels.forEach(channel => channel.close())
    };
  }
});
