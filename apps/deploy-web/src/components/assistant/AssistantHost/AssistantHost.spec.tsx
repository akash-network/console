import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantPanel } from "../AssistantPanel/AssistantPanel";
import type { AssistantConversation } from "../useAssistantConversation/useAssistantConversation";
import { AssistantHost, DEPENDENCIES } from "./AssistantHost";

import { act, render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AssistantHost.name, () => {
  it("renders nothing while the assistant is off or nobody is signed in", () => {
    const disabled = setup({ isEnabled: false });
    expect(disabled.dependencies.useFlag).toHaveBeenCalledWith("user_feedback_loop");
    expect(disabled.dependencies.AssistantPanel).not.toHaveBeenCalled();
    expect(disabled.dependencies.useAssistantConversation).not.toHaveBeenCalled();

    const signedOut = setup({ userId: null });
    expect(signedOut.dependencies.AssistantPanel).not.toHaveBeenCalled();
    expect(signedOut.dependencies.useAssistantConversation).not.toHaveBeenCalled();
  });

  it("hands the panel the open request and the conversation", () => {
    const { panelProps, conversation } = setup({ request: { question: "Why no bids?" }, isOpen: true, openedAt: 7 });

    expect(panelProps()).toEqual(expect.objectContaining({ isOpen: true, conversation, question: "Why no bids?", openedAt: 7 }));
  });

  it("gives the conversation the current page and the deployment the request is about", () => {
    const { dependencies } = setup({ pathname: "/new-deployment", request: { context: { dseq: "77" } } });

    expect(dependencies.useAssistantConversation).toHaveBeenCalledWith({ context: { page: "/new-deployment", dseq: "77" } });
  });

  it("prefers the deployment on the page, which the panel follows across navigation", () => {
    const { dependencies } = setup({ pathname: "/deployments/42", request: { context: { dseq: "77" } } });

    expect(dependencies.useAssistantConversation).toHaveBeenCalledWith({ context: { page: "/deployments/42", dseq: "42" } });
  });

  it("reads the deployment from the page when the request names none", () => {
    const { dependencies } = setup({ pathname: "/deployments/42" });

    expect(dependencies.useAssistantConversation).toHaveBeenCalledWith({ context: { page: "/deployments/42", dseq: "42" } });
  });

  it("closes the panel when it is dismissed but not when asked to open", () => {
    const { panelProps, close } = setup({ isOpen: true });

    act(() => panelProps().onOpenChange(true));
    expect(close).not.toHaveBeenCalled();

    act(() => panelProps().onOpenChange(false));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps the panel open with the same conversation while the user navigates", () => {
    const { close, conversation, panelProps, rerenderAt } = setup({ pathname: "/new-deployment", isOpen: true });

    rerenderAt("/deployments/42");

    expect(close).not.toHaveBeenCalled();
    expect(panelProps()).toEqual(expect.objectContaining({ isOpen: true, conversation }));
  });

  function setup(input: {
    isEnabled?: boolean;
    userId?: string | null;
    pathname?: string;
    isOpen?: boolean;
    openedAt?: number;
    request?: ReturnType<typeof DEPENDENCIES.useAssistantPanel>["request"];
  }) {
    let pathname = input.pathname ?? "/deployments";
    const close = vi.fn();
    const conversation = mock<AssistantConversation>();
    const user = input.userId === null ? undefined : { userId: input.userId ?? "user-1" };
    const dependencies = MockComponents(DEPENDENCIES, {
      useFlag: vi.fn(() => input.isEnabled ?? true),
      useUser: vi.fn(() => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: user as ReturnType<typeof DEPENDENCIES.useUser>["user"] })),
      usePathname: vi.fn(() => pathname),
      useAssistantPanel: vi.fn(() => ({
        isOpen: input.isOpen ?? false,
        request: input.request ?? {},
        openedAt: input.openedAt ?? 0,
        open: vi.fn(),
        close
      })),
      useAssistantConversation: vi.fn(() => conversation)
    });

    const view = render(<AssistantHost dependencies={dependencies} />);
    const rerenderAt = (nextPathname: string) => {
      pathname = nextPathname;
      view.rerender(<AssistantHost dependencies={dependencies} />);
    };
    const panelProps = () => vi.mocked(dependencies.AssistantPanel).mock.lastCall![0] as ComponentProps<typeof AssistantPanel>;

    return { dependencies, conversation, close, panelProps, rerenderAt };
  }
});
