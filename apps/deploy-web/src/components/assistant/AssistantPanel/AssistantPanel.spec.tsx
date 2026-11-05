import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AssistantConsentCard } from "../AssistantConsentCard/AssistantConsentCard";
import { ASSISTANT_CONSENT_COPY_VERSION } from "../assistantConsentCopy";
import type { AssistantConversation } from "../useAssistantConversation/useAssistantConversation";
import { AssistantPanel, DEPENDENCIES } from "./AssistantPanel";

import { act, render, screen, waitFor } from "@testing-library/react";
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
  it("asks for consent before the first message", () => {
    const { dependencies } = setup({ consent: null });

    expect(screen.getByRole("dialog", { name: "Console assistant" })).toBeInTheDocument();
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

  it("drops the intro once the conversation has messages", () => {
    setup({ consent: CURRENT_CONSENT, hasMessages: true });

    expect(screen.queryByText(/Ask about your deployments/)).not.toBeInTheDocument();
  });

  it("loads consent only while open", () => {
    const { dependencies } = setup({ consent: null, isOpen: false });

    expect(dependencies.useAssistantPrivacyQuery).toHaveBeenCalledWith({ enabled: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  function setup(input: {
    consent?: Privacy["consent"];
    problem?: AssistantConversation["problem"];
    isOpen?: boolean;
    isLoading?: boolean;
    isError?: boolean;
    question?: string;
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
      messages: input.hasMessages ? [{ id: "1", role: "user" as const, text: "Hi", reads: [], proposals: [] }] : [],
      problem: input.problem ?? null,
      endedAs: null,
      isAnswering: false,
      send: vi.fn(),
      clearProblem: vi.fn()
    });
    const onOpenChange = vi.fn();

    render(
      <AssistantPanel
        isOpen={input.isOpen ?? true}
        onOpenChange={onOpenChange}
        conversation={conversation}
        question={input.question}
        openedAt={1}
        dependencies={dependencies}
      />
    );

    const consentCardProps = () => vi.mocked(dependencies.AssistantConsentCard).mock.lastCall![0] as ComponentProps<typeof AssistantConsentCard>;

    return { dependencies, conversation, updateConsent, onOpenChange, consentCardProps };
  }
});
