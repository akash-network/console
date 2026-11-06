import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantConsentCard } from "../AssistantConsentCard/AssistantConsentCard";
import { ASSISTANT_CONSENT_COPY_VERSION } from "../assistantConsentCopy";
import type { AssistantConversation } from "../useAssistantConversation/useAssistantConversation";
import { ASSISTANT_PANEL_WIDTH_VAR, AssistantPanel, DEPENDENCIES } from "./AssistantPanel";

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

type Privacy = NonNullable<ReturnType<typeof DEPENDENCIES.useAssistantPrivacyQuery>["data"]>;

const CURRENT_CONSENT: Privacy["consent"] = {
  copyVersion: ASSISTANT_CONSENT_COPY_VERSION,
  processingAcceptedAt: "2026-11-04T00:00:00.000Z",
  reviewOptIn: false,
  updatedAt: "2026-11-04T00:00:00.000Z"
};

describe("AssistantPanel", () => {
  it("docks beside the page without a modal or backdrop, so the page stays usable", async () => {
    const { onPageAction } = setup({ consent: CURRENT_CONSENT });

    expect(screen.getByRole("complementary", { name: "Console assistant" })).not.toHaveAttribute("aria-modal");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Page action" }));
    expect(onPageAction).toHaveBeenCalledTimes(1);
  });

  it("makes room for itself beside the page while open", () => {
    const { rerenderOpen, unmount } = setup({ consent: CURRENT_CONSENT });
    expect(document.documentElement.style.getPropertyValue(ASSISTANT_PANEL_WIDTH_VAR)).toBe("440px");

    rerenderOpen(false);
    expect(document.documentElement.style.getPropertyValue(ASSISTANT_PANEL_WIDTH_VAR)).toBe("");

    rerenderOpen(true);
    unmount();
    expect(document.documentElement.style.getPropertyValue(ASSISTANT_PANEL_WIDTH_VAR)).toBe("");
  });

  it("moves focus into the panel when it opens and on every new open request", () => {
    const { rerenderOpen } = setup({ consent: CURRENT_CONSENT });
    expect(screen.getByRole("complementary", { name: "Console assistant" })).toHaveFocus();

    screen.getByRole("button", { name: "Page action" }).focus();
    rerenderOpen(true, 2);

    expect(screen.getByRole("complementary", { name: "Console assistant" })).toHaveFocus();
  });

  it("returns focus to where it was once closed, even after a new open request", () => {
    const { rerenderOpen } = setup({ consent: CURRENT_CONSENT, isOpen: false });
    const pageAction = screen.getByRole("button", { name: "Page action" });
    pageAction.focus();

    rerenderOpen(true);
    rerenderOpen(true, 2);
    expect(pageAction).not.toHaveFocus();
    rerenderOpen(false);

    expect(pageAction).toHaveFocus();
  });

  it("leaves focus where the user moved it before the panel closed", () => {
    const { rerenderOpen } = setup({ consent: CURRENT_CONSENT, isOpen: false });
    screen.getByRole("button", { name: "Page action" }).focus();
    rerenderOpen(true);
    const elsewhere = document.body.appendChild(document.createElement("input"));
    elsewhere.focus();

    rerenderOpen(false);

    expect(elsewhere).toHaveFocus();
    elsewhere.remove();
  });

  it("closes on Escape pressed inside the panel or on the page unless something handled it", () => {
    const { onOpenChange } = setup({ consent: CURRENT_CONSENT });
    const panel = screen.getByRole("complementary", { name: "Console assistant" });
    const handled = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    handled.preventDefault();

    fireEvent(panel, handled);
    fireEvent.keyDown(panel, { key: "Enter" });
    expect(onOpenChange).not.toHaveBeenCalled();

    expect(fireEvent.keyDown(panel, { key: "Escape" })).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    onOpenChange.mockClear();
    fireEvent.keyDown(screen.getByRole("button", { name: "Page action" }), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("leaves Escape to a page overlay that opened after the panel", () => {
    const { onOpenChange } = setup({ consent: CURRENT_CONSENT });
    const dismissOverlay = vi.fn((event: KeyboardEvent) => {
      if (!event.defaultPrevented) event.preventDefault();
    });
    document.addEventListener("keydown", dismissOverlay);

    fireEvent.keyDown(screen.getByRole("button", { name: "Page action" }), { key: "Escape" });
    document.removeEventListener("keydown", dismissOverlay);

    expect(dismissOverlay).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("stops listening for Escape once closed", () => {
    const { onOpenChange, rerenderOpen } = setup({ consent: CURRENT_CONSENT });

    rerenderOpen(false);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("asks for consent before the first message", () => {
    const { dependencies } = setup({ consent: null });

    expect(screen.getByRole("complementary", { name: "Console assistant" })).toBeInTheDocument();
    expect(dependencies.AssistantConsentCard).toHaveBeenCalled();
    expect(dependencies.AssistantTranscript).not.toHaveBeenCalled();
    expect(dependencies.AssistantComposer).not.toHaveBeenCalled();
  });

  it("asks again when the consent copy changed since the user agreed", () => {
    const { dependencies } = setup({ consent: { ...CURRENT_CONSENT, copyVersion: "2025-01" } });

    expect(dependencies.AssistantConsentCard).toHaveBeenCalled();
  });

  it("asks again when the api refuses the conversation for consent", () => {
    const { dependencies } = setup({ consent: CURRENT_CONSENT, problem: "consent" });

    expect(dependencies.AssistantConsentCard).toHaveBeenCalled();
    expect(dependencies.AssistantTranscript).not.toHaveBeenCalled();
  });

  it("records the agreement with the current copy version and the review choice", async () => {
    const { consentCardProps, updateConsent, conversation } = setup({ consent: null });

    await act(() => consentCardProps().onAgree({ reviewOptIn: true }));

    expect(updateConsent).toHaveBeenCalledWith({ data: { copyVersion: ASSISTANT_CONSENT_COPY_VERSION, reviewOptIn: true } });
    expect(conversation.clearProblem).toHaveBeenCalled();
    expect(consentCardProps().hasFailed).toBe(false);
  });

  it("tells the consent card when saving the agreement failed", async () => {
    const { consentCardProps, updateConsent, conversation } = setup({ consent: null });
    updateConsent.mockRejectedValue(new Error("offline"));

    await act(() => consentCardProps().onAgree({ reviewOptIn: false }));

    expect(consentCardProps().hasFailed).toBe(true);
    expect(conversation.clearProblem).not.toHaveBeenCalled();
  });

  it("closes when the user declines consent", () => {
    const { consentCardProps, onOpenChange } = setup({ consent: null });

    act(() => consentCardProps().onDecline());

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the conversation and a composer prefilled with the question once the user agreed", () => {
    const { dependencies, conversation } = setup({ consent: CURRENT_CONSENT, question: "Why no bids?" });

    expect(dependencies.AssistantConsentCard).not.toHaveBeenCalled();
    expect(dependencies.AssistantTranscript).toHaveBeenCalledWith(expect.objectContaining({ conversation }), expect.anything());
    expect(dependencies.AssistantComposer).toHaveBeenCalledWith(
      expect.objectContaining({ initialValue: "Why no bids?", isSending: false, onSend: conversation.send }),
      expect.anything()
    );
    expect(screen.getByText("Ask about your deployments, bids, logs, or billing. The assistant reads your account to answer.")).toBeInTheDocument();
  });

  it("asks the question at once, with an empty composer, when the user opened it from a button that asks", () => {
    const { dependencies, conversation, rerenderOpen } = setup({ consent: CURRENT_CONSENT, question: "Why no bids?", sendsQuestion: true });

    rerenderOpen(true);

    expect(conversation.send).toHaveBeenCalledTimes(1);
    expect(conversation.send).toHaveBeenCalledWith("Why no bids?");
    expect(dependencies.AssistantComposer).toHaveBeenLastCalledWith(expect.objectContaining({ initialValue: undefined }), expect.anything());
  });

  it("asks again on a new open request from a button that asks", () => {
    const { conversation, rerenderOpen } = setup({ consent: CURRENT_CONSENT, question: "Why no bids?", sendsQuestion: true });

    rerenderOpen(true, 2);

    expect(conversation.send).toHaveBeenCalledTimes(2);
  });

  it.each([
    { case: "the user has not agreed yet", consent: null, isAnswering: false },
    { case: "an answer is still streaming", consent: CURRENT_CONSENT, isAnswering: true }
  ])("waits to ask while $case", ({ consent, isAnswering }) => {
    const { conversation } = setup({ consent, question: "Why no bids?", sendsQuestion: true, isAnswering });

    expect(conversation.send).not.toHaveBeenCalled();
  });

  it.each([
    { case: "the button only prefills", question: "Why no bids?", sendsQuestion: false, isOpen: true },
    { case: "there is no question", question: undefined, sendsQuestion: true, isOpen: true },
    { case: "the panel is closed", question: "Why no bids?", sendsQuestion: true, isOpen: false }
  ])("sends nothing when $case", ({ question, sendsQuestion, isOpen }) => {
    const { conversation } = setup({ consent: CURRENT_CONSENT, question, sendsQuestion, isOpen });

    expect(conversation.send).not.toHaveBeenCalled();
  });

  it("drops the intro once the conversation has messages", () => {
    setup({ consent: CURRENT_CONSENT, hasMessages: true });

    expect(screen.queryByText(/Ask about your deployments/)).not.toBeInTheDocument();
  });

  it("loads consent only while open", () => {
    const { dependencies } = setup({ consent: null, isOpen: false });

    expect(dependencies.useAssistantPrivacyQuery).toHaveBeenCalledWith({ enabled: false });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("shows a loader while consent loads", () => {
    const { dependencies } = setup({ isLoading: true });

    expect(dependencies.AssistantConsentCard).not.toHaveBeenCalled();
    expect(dependencies.AssistantTranscript).not.toHaveBeenCalled();
  });

  it("points to Discord when consent cannot load", () => {
    const { dependencies } = setup({ isError: true });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load the assistant. Close the panel and try again.");
    expect(dependencies.DiscordHelpCard).toHaveBeenCalled();
  });

  it("closes from the close button", async () => {
    const { onOpenChange } = setup({ consent: CURRENT_CONSENT });

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  function setup(input: {
    consent?: Privacy["consent"];
    problem?: AssistantConversation["problem"];
    isOpen?: boolean;
    isLoading?: boolean;
    isError?: boolean;
    question?: string;
    sendsQuestion?: boolean;
    isAnswering?: boolean;
    hasMessages?: boolean;
  }) {
    const updateConsent = vi.fn(async (_input: unknown) => ({ data: { consent: CURRENT_CONSENT, storedConversationCount: 0 } }));
    const data = input.isLoading || input.isError ? undefined : { consent: input.consent ?? null, storedConversationCount: 0 };
    const privacy = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAssistantPrivacyQuery>>(), {
      data,
      isLoading: !!input.isLoading,
      isError: !!input.isError
    });
    const dependencies = MockComponents(DEPENDENCIES, {
      useAssistantPrivacyQuery: vi.fn(() => privacy),
      useUpdateAssistantConsentMutation: vi.fn(() =>
        mock<ReturnType<typeof DEPENDENCIES.useUpdateAssistantConsentMutation>>({ mutateAsync: updateConsent as never, isPending: false })
      )
    });
    const conversation = Object.assign(mock<AssistantConversation>(), {
      messages: input.hasMessages ? [{ id: "1", role: "user" as const, text: "Hi", reads: [], proposals: [], liveHelpReason: null }] : [],
      problem: input.problem ?? null,
      endedAs: null,
      isAnswering: !!input.isAnswering,
      send: vi.fn(),
      clearProblem: vi.fn()
    });
    const onOpenChange = vi.fn();
    const onPageAction = vi.fn();
    const renderAt = (isOpen: boolean, openedAt = 1) => (
      <>
        <button type="button" onClick={onPageAction}>
          Page action
        </button>
        <AssistantPanel
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          conversation={conversation}
          question={input.question}
          sendsQuestion={input.sendsQuestion}
          openedAt={openedAt}
          dependencies={dependencies}
        />
      </>
    );

    const view = render(renderAt(input.isOpen ?? true));
    const rerenderOpen = (isOpen: boolean, openedAt?: number) => view.rerender(renderAt(isOpen, openedAt));

    const consentCardProps = () => vi.mocked(dependencies.AssistantConsentCard).mock.lastCall![0] as ComponentProps<typeof AssistantConsentCard>;

    return { dependencies, conversation, updateConsent, onOpenChange, onPageAction, consentCardProps, rerenderOpen, unmount: view.unmount };
  }
});
