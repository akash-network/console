import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SignedInUserChannel } from "@src/services/signed-in-user-channel/signed-in-user-channel";
import type { CustomUserProfile } from "@src/types/user";
import type { DEPENDENCIES } from "./AccountSwitchSync";
import { AccountSwitchSync } from "./AccountSwitchSync";

import { act, render } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(AccountSwitchSync.name, () => {
  it("announces the signed-in user to the other tabs", () => {
    const { signedInUserChannel } = setup({ userId: "user-a" });

    expect(signedInUserChannel.announce).toHaveBeenCalledWith("user-a");
  });

  it("announces the user the tab switches to", () => {
    const { signedInUserChannel, rerenderAs } = setup({ userId: "user-a" });

    rerenderAs("user-b");

    expect(signedInUserChannel.announce).toHaveBeenLastCalledWith("user-b");
  });

  it("announces nothing while no user is signed in", () => {
    const { signedInUserChannel } = setup({ userId: undefined });

    expect(signedInUserChannel.announce).not.toHaveBeenCalled();
  });

  it("reloads when another tab signs in as someone else", () => {
    const { announceFromAnotherTab, reload } = setup({ userId: "user-a" });

    act(() => announceFromAnotherTab("user-b"));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("stays put when another tab announces the same user", () => {
    const { announceFromAnotherTab, reload } = setup({ userId: "user-a" });

    act(() => announceFromAnotherTab("user-a"));

    expect(reload).not.toHaveBeenCalled();
  });

  it("stays put while no user is signed in, so a signed-out tab follows its own login", () => {
    const { signedInUserChannel, reload } = setup({ userId: undefined });

    expect(signedInUserChannel.subscribe).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("compares against the user the tab holds now", () => {
    const { announceFromAnotherTab, reload, rerenderAs } = setup({ userId: "user-a" });

    rerenderAs("user-b");
    act(() => announceFromAnotherTab("user-b"));

    expect(reload).not.toHaveBeenCalled();
  });

  it("stops listening on unmount", () => {
    const { signedInUserChannel, unmount } = setup({ userId: "user-a" });
    const unsubscribe = signedInUserChannel.subscribe.mock.results[0].value;

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  function setup(input: { userId: string | undefined }) {
    const listeners: Array<(userId: string) => void> = [];
    const signedInUserChannel = mock<SignedInUserChannel>();
    signedInUserChannel.subscribe.mockImplementation(listener => {
      listeners.push(listener);
      return vi.fn(() => {
        listeners.splice(listeners.indexOf(listener), 1);
      });
    });
    const reload = vi.fn();
    const windowLocation = mock<Location>({ reload });
    const renderAs = (userId: string | undefined) => {
      const useUser: typeof DEPENDENCIES.useUser = () =>
        mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: userId ? mock<CustomUserProfile>({ id: userId }) : undefined });

      return (
        <TestContainerProvider services={{ signedInUserChannel: () => signedInUserChannel, windowLocation: () => windowLocation }}>
          <AccountSwitchSync dependencies={{ useUser }} />
        </TestContainerProvider>
      );
    };

    const { rerender, unmount } = render(renderAs(input.userId));

    return {
      signedInUserChannel,
      reload,
      unmount,
      rerenderAs: (userId: string) => rerender(renderAs(userId)),
      announceFromAnotherTab: (userId: string) => listeners.forEach(listener => listener(userId))
    };
  }
});
