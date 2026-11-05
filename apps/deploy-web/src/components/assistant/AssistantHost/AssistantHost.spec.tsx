import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantPanel } from "../AssistantPanel/AssistantPanel";
import type { AssistantConversation } from "../useAssistantConversation/useAssistantConversation";
import { AssistantHost, DEPENDENCIES, dseqOfPath } from "./AssistantHost";

import { act, render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AssistantHost.name, () => {
  it("renders nothing while the assistant is off or nobody is signed in", () => {
    expect(setup({ isEnabled: false }).dependencies.AssistantPanel).not.toHaveBeenCalled();
    expect(setup({ userId: null }).dependencies.AssistantPanel).not.toHaveBeenCalled();
  });

  it("hands the panel the open request and the conversation", () => {
    const { panelProps, conversation } = setup({ request: { question: "Why no bids?" }, isOpen: true, openedAt: 7 });

    expect(panelProps()).toEqual(expect.objectContaining({ isOpen: true, conversation, question: "Why no bids?", openedAt: 7 }));
  });

  it("gives the conversation the current page and the deployment the request is about", () => {
    const { dependencies } = setup({ pathname: "/new-deployment", request: { context: { dseq: "77" } } });

    expect(dependencies.useAssistantConversation).toHaveBeenCalledWith({ context: { page: "/new-deployment", dseq: "77" } });
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

  it("closes the panel when the user navigates, and only then", () => {
    const { close, rerenderAt } = setup({ pathname: "/deployments" });
    expect(close).not.toHaveBeenCalled();

    rerenderAt("/deployments");
    expect(close).not.toHaveBeenCalled();

    rerenderAt("/billing");
    expect(close).toHaveBeenCalledTimes(1);
  });

  describe(dseqOfPath.name, () => {
    it("finds the dseq of a deployment page only", () => {
      expect(dseqOfPath("/deployments/123")).toBe("123");
      expect(dseqOfPath("/deployments/123/logs")).toBe("123");
      expect(dseqOfPath("/deployments")).toBeUndefined();
      expect(dseqOfPath("/deployments/abc")).toBeUndefined();
      expect(dseqOfPath("/x/deployments/1")).toBeUndefined();
      expect(dseqOfPath(null)).toBeUndefined();
    });
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
